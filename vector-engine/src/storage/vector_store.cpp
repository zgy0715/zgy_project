#include "storage/vector_store.h"
#include "storage/metadata_manager.h"
#include "hnsw/hnsw_index.h"

#include <filesystem>
#include <fstream>
#include <mutex>
#include <shared_mutex>
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
        check_dim(vector);
        std::unique_lock<std::shared_mutex> lock(mutex_);
        // Let the index hand out the id: it keeps its own monotonic label
        // counter that is also restored on load, so ids are never reused.
        auto id = index_.insert(vector.data(), std::nullopt);
        meta_.put(id, metadata);
        vectors_[id] = vector;
        return id;
    }

    std::vector<int64_t> batch_insert(
        const std::vector<std::pair<std::vector<float>, std::string>>& records)
    {
        std::unique_lock<std::shared_mutex> lock(mutex_);
        ensure_capacity_locked(index_.size() + records.size());
        std::vector<int64_t> ids;
        ids.reserve(records.size());
        for (const auto& record : records) {
            check_dim(record.first);
            auto id = index_.insert(record.first.data(), std::nullopt);
            meta_.put(id, record.second);
            vectors_[id] = record.first;
            ids.push_back(id);
        }
        return ids;
    }

    void ensure_capacity(std::size_t required) {
        std::unique_lock<std::shared_mutex> lock(mutex_);
        ensure_capacity_locked(required);
    }

    bool update(int64_t id, const std::vector<float>& vector,
                const std::string& metadata)
    {
        check_dim(vector);
        std::unique_lock<std::shared_mutex> lock(mutex_);
        if (!meta_.exists(id)) return false;
        // hnswlib's addPoint() updates an existing label in place and repairs
        // the graph links, so the new vector is visible to searches.
        index_.insert(vector.data(), id);
        meta_.put(id, metadata);
        vectors_[id] = vector;
        return true;
    }

    bool remove(int64_t id) {
        std::unique_lock<std::shared_mutex> lock(mutex_);
        if (!meta_.exists(id)) return false;
        meta_.remove(id);
        vectors_.erase(id);
        index_.markDelete(id);
        return true;
    }

    std::optional<VectorRecord> get(int64_t id) const {
        std::shared_lock<std::shared_mutex> lock(mutex_);
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
                                   std::size_t k) const {
        check_dim(query);
        std::shared_lock<std::shared_mutex> lock(mutex_);
        return collect(index_.search(query.data(), k));
    }

    std::vector<SearchHit> search(const std::vector<float>& query,
                                   std::size_t k, int ef) const {
        check_dim(query);
        std::shared_lock<std::shared_mutex> lock(mutex_);
        return collect(index_.search(query.data(), k, ef));
    }

    void save(const std::string& directory) const {
        std::shared_lock<std::shared_mutex> lock(mutex_);

        std::error_code ec;
        fs::create_directories(directory, ec);
        if (ec && !fs::is_directory(directory)) {
            throw std::runtime_error("Cannot create store directory: " + directory);
        }

        index_.save((fs::path(directory) / "index.bin").string());
        meta_.save((fs::path(directory) / "metadata.json").string());

        // Persist the raw vectors so get() survives a reload.
        nlohmann::json vectors_json = nlohmann::json::object();
        for (const auto& entry : vectors_) {
            nlohmann::json vec_json = nlohmann::json::array();
            for (float v : entry.second) {
                vec_json.push_back(v);
            }
            vectors_json[std::to_string(entry.first)] = std::move(vec_json);
        }

        const std::string vectors_path = (fs::path(directory) / "vectors.json").string();
        std::ofstream ofs(vectors_path, std::ios::binary | std::ios::trunc);
        if (!ofs) {
            throw std::runtime_error("Cannot open file for writing: " + vectors_path);
        }
        ofs << vectors_json.dump(2);
        ofs.flush();
        if (!ofs) {
            throw std::runtime_error("Failed to write vectors file: " + vectors_path);
        }
    }

    void load(const std::string& directory) {
        std::unique_lock<std::shared_mutex> lock(mutex_);

        index_.load((fs::path(directory) / "index.bin").string());
        meta_.load((fs::path(directory) / "metadata.json").string());

        const std::string vectors_path = (fs::path(directory) / "vectors.json").string();
        std::ifstream ifs(vectors_path, std::ios::binary);
        if (!ifs) {
            // Older saves may not contain vectors.json: metadata still works,
            // get() will simply have no raw vector to return.
            vectors_.clear();
            return;
        }

        nlohmann::json vectors_json;
        try {
            ifs >> vectors_json;
        } catch (const nlohmann::json::exception& e) {
            throw std::runtime_error("Corrupt vectors file '" + vectors_path + "': " + e.what());
        }
        if (!vectors_json.is_object()) {
            throw std::runtime_error("Corrupt vectors file '" + vectors_path +
                                     "': expected a JSON object");
        }

        std::unordered_map<int64_t, std::vector<float>> loaded;
        loaded.reserve(vectors_json.size());
        for (auto it = vectors_json.begin(); it != vectors_json.end(); ++it) {
            int64_t id = 0;
            if (!parse_id(it.key(), id)) {
                continue; // skip non-numeric keys
            }
            if (!it.value().is_array() ||
                it.value().size() != static_cast<std::size_t>(config().dim)) {
                throw std::runtime_error("Corrupt vectors file '" + vectors_path +
                                         "': entry " + it.key() + " has an unexpected dimension");
            }
            std::vector<float> vec;
            vec.reserve(it.value().size());
            for (const auto& v : it.value()) {
                vec.push_back(v.get<float>());
            }
            loaded[id] = std::move(vec);
        }
        vectors_.swap(loaded);
    }

    std::size_t size() const {
        std::shared_lock<std::shared_mutex> lock(mutex_);
        return index_.size();
    }

    std::size_t capacity() const {
        std::shared_lock<std::shared_mutex> lock(mutex_);
        return index_.capacity();
    }

    const IndexConfig& config() const { return index_.config(); }

private:
    HNSWIndex                          index_;
    MetadataManager                    meta_;
    std::unordered_map<int64_t, std::vector<float>> vectors_;

    /// Guards index_, meta_ and vectors_: shared for reads (search/get),
    /// exclusive for mutations (insert/update/remove/load/save).
    mutable std::shared_mutex mutex_;

    void check_dim(const std::vector<float>& vector) const {
        if (vector.size() != static_cast<std::size_t>(config().dim)) {
            throw std::invalid_argument(
                "Vector dimension mismatch: expected " + std::to_string(config().dim) +
                ", got " + std::to_string(vector.size()));
        }
    }

    /// Grow the index capacity so that @p required elements fit. The caller
    /// must already hold the unique lock.
    void ensure_capacity_locked(std::size_t required) {
        std::size_t target = index_.capacity();
        if (required <= target) return;
        if (target == 0) target = required;
        while (target < required) {
            target *= 2;
        }
        index_.resize(target);
    }

    std::vector<SearchHit> collect(const std::vector<SearchResult>& results) const {
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

    static bool parse_id(const std::string& key, int64_t& id) {
        try {
            std::size_t consumed = 0;
            id = std::stoll(key, &consumed);
            return consumed == key.size();
        } catch (const std::exception&) {
            return false;
        }
    }
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
    return impl_->search(query, k);
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

void VectorStore::ensure_capacity(std::size_t required) {
    impl_->ensure_capacity(required);
}

std::size_t VectorStore::size() const { return impl_->size(); }
std::size_t VectorStore::capacity() const { return impl_->capacity(); }
const IndexConfig& VectorStore::config() const { return impl_->config(); }

} // namespace deepagent::vector_engine
