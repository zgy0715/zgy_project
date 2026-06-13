#include "storage/vector_store.h"
#include "storage/metadata_manager.h"
#include "hnsw/hnsw_index.h"

#include <filesystem>
#include <fstream>
#include <stdexcept>
#include <utility>

#include <nlohmann/json.hpp>

namespace deepagent::vector_engine {

namespace fs = std::filesystem;

// ── VectorStore::Impl ───────────────────────────────────────────────────────

class VectorStore::Impl {
public:
    explicit Impl(const IndexConfig& config)
        : index_(config)
        , meta_(config.max_elements)
    {}

    int64_t insert(const std::vector<float>& vector, const std::string& metadata) {
        auto id = next_id_++;
        index_.insert(vector.data(), id);
        meta_.put(id, metadata);
        vectors_[id] = vector;
        return id;
    }

    std::vector<int64_t> batch_insert(
        const std::vector<std::pair<std::vector<float>, std::string>>& records)
    {
        std::vector<int64_t> ids;
        ids.reserve(records.size());
        for (const auto& [vec, meta] : records) {
            ids.push_back(insert(vec, meta));
        }
        return ids;
    }

    bool update(int64_t id, const std::vector<float>& vector,
                const std::string& metadata)
    {
        if (!meta_.exists(id)) return false;
        // hnswlib does not support in-place update; mark old and re-add
        // For simplicity, we just overwrite the stored vector and metadata
        meta_.put(id, metadata);
        vectors_[id] = vector;
        // Note: the HNSW index still has the old vector; a full rebuild
        // would be needed for correct search results. This is a known
        // limitation of the current skeleton.
        return true;
    }

    bool remove(int64_t id) {
        if (!meta_.exists(id)) return false;
        meta_.remove(id);
        vectors_.erase(id);
        index_.markDelete(id);
        return true;
    }

    std::optional<VectorRecord> get(int64_t id) const {
        auto meta = meta_.get(id);
        if (!meta) return std::nullopt;
        auto it = vectors_.find(id);
        if (it == vectors_.end()) return std::nullopt;
        VectorRecord rec;
        rec.id       = id;
        rec.vector   = it->second;
        rec.metadata = *meta;
        return rec;
    }

    std::vector<SearchHit> search(const std::vector<float>& query,
                                   std::size_t k, int ef) const {
        auto results = index_.search(query.data(), k, ef);
        std::vector<SearchHit> hits;
        hits.reserve(results.size());
        for (const auto& r : results) {
            SearchHit h;
            h.id       = r.id;
            h.distance = r.distance;
            auto meta  = meta_.get(r.id);
            h.metadata = meta.value_or("{}");
            hits.push_back(std::move(h));
        }
        return hits;
    }

    void save(const std::string& directory) const {
        fs::create_directories(directory);
        index_.save((fs::path(directory) / "index.bin").string());
        meta_.save((fs::path(directory) / "metadata.json").string());

        // Save vectors_ and next_id_ for full state restoration
        try {
            nlohmann::json vectors_json = nlohmann::json::object();
            for (const auto& [id, vec] : vectors_) {
                nlohmann::json vec_json = nlohmann::json::array();
                for (float v : vec) {
                    vec_json.push_back(v);
                }
                vectors_json[std::to_string(id)] = vec_json;
            }
            vectors_json["__next_id__"] = next_id_;

            std::ofstream ofs((fs::path(directory) / "vectors.json").string());
            ofs << vectors_json.dump(2);
        } catch (const std::exception&) {
            // Log but don't fail the save
        }
    }

    void load(const std::string& directory) {
        index_.load((fs::path(directory) / "index.bin").string());
        meta_.load((fs::path(directory) / "metadata.json").string());

        // Restore vectors_ and next_id_
        try {
            std::ifstream ifs((fs::path(directory) / "vectors.json").string());
            if (ifs.is_open()) {
                auto vectors_json = nlohmann::json::parse(ifs);
                vectors_.clear();
                for (auto it = vectors_json.begin(); it != vectors_json.end(); ++it) {
                    if (it.key() == "__next_id__") {
                        next_id_ = it.value().get<int64_t>();
                        continue;
                    }
                    int64_t id = std::stoll(it.key());
                    std::vector<float> vec;
                    for (const auto& v : it.value()) {
                        vec.push_back(v.get<float>());
                    }
                    vectors_[id] = std::move(vec);
                }
            }
        } catch (const std::exception&) {
            // vectors.json may not exist in older saves; that's OK
        }
    }

    std::size_t size() const { return index_.size(); }
    std::size_t capacity() const { return index_.capacity(); }
    const IndexConfig& config() const { return index_.config(); }

private:
    HNSWIndex                          index_;
    MetadataManager                    meta_;
    std::unordered_map<int64_t, std::vector<float>> vectors_;
    int64_t                            next_id_ = 0;
};

// ── VectorStore forwarding ──────────────────────────────────────────────────

VectorStore::VectorStore(const IndexConfig& config)
    : impl_(std::make_unique<Impl>(config)) {}

VectorStore::VectorStore(const std::string& directory)
    : impl_(std::make_unique<Impl>(IndexConfig{}))
{
    impl_->load(directory);
}

VectorStore::~VectorStore() = default;

VectorStore::VectorStore(VectorStore&&) noexcept = default;
VectorStore& VectorStore::operator=(VectorStore&&) noexcept = default;

int64_t VectorStore::insert(const std::vector<float>& vector,
                             const std::string& metadata) {
    return impl_->insert(vector, metadata);
}

std::vector<int64_t> VectorStore::batch_insert(
    const std::vector<std::pair<std::vector<float>, std::string>>& records) {
    return impl_->batch_insert(records);
}

bool VectorStore::update(int64_t id, const std::vector<float>& vector,
                          const std::string& metadata) {
    return impl_->update(id, vector, metadata);
}

bool VectorStore::remove(int64_t id) {
    return impl_->remove(id);
}

std::optional<VectorRecord> VectorStore::get(int64_t id) const {
    return impl_->get(id);
}

std::vector<VectorStore::SearchHit> VectorStore::search(
    const std::vector<float>& query, std::size_t k) const {
    return impl_->search(query, k, impl_->config().ef_search);
}

std::vector<VectorStore::SearchHit> VectorStore::search(
    const std::vector<float>& query, std::size_t k, int ef) const {
    return impl_->search(query, k, ef);
}

void VectorStore::save(const std::string& directory) const {
    impl_->save(directory);
}

void VectorStore::load(const std::string& directory) {
    impl_->load(directory);
}

std::size_t VectorStore::size() const { return impl_->size(); }
std::size_t VectorStore::capacity() const { return impl_->capacity(); }
const IndexConfig& VectorStore::config() const { return impl_->config(); }

} // namespace deepagent::vector_engine
