#include "hnsw/hnsw_index.h"

#include <algorithm>
#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <fstream>
#include <mutex>
#include <shared_mutex>
#include <sstream>
#include <stdexcept>
#include <utility>

#include <hnswlib/hnswlib.h>
#include <nlohmann/json.hpp>

#include "utils/distance.h"

namespace deepagent::vector_engine {

// ── IndexConfig serialization ────────────────────────────────────────────────

using json = nlohmann::json;

static std::string metric_to_string(MetricType m) {
    switch (m) {
        case MetricType::Cosine:      return "cosine";
        case MetricType::Euclidean:   return "euclidean";
        case MetricType::InnerProduct: return "inner_product";
    }
    return "cosine";
}

static MetricType string_to_metric(const std::string& s) {
    if (s == "euclidean")     return MetricType::Euclidean;
    if (s == "inner_product") return MetricType::InnerProduct;
    return MetricType::Cosine;
}

std::string IndexConfig::to_json() const {
    json j;
    j["M"]               = M;
    j["ef_construction"] = ef_construction;
    j["ef_search"]       = ef_search;
    j["max_elements"]    = max_elements;
    j["metric_type"]     = metric_to_string(metric_type);
    j["dim"]             = dim;
    j["seed"]            = seed;
    return j.dump(2);
}

IndexConfig IndexConfig::from_json(const std::string& json_str) {
    auto j = json::parse(json_str);
    IndexConfig cfg;
    cfg.M               = j.value("M", 16);
    cfg.ef_construction = j.value("ef_construction", 200);
    cfg.ef_search       = j.value("ef_search", 50);
    cfg.max_elements    = j.value("max_elements", std::size_t(100000));
    cfg.metric_type     = string_to_metric(j.value("metric_type", std::string("cosine")));
    cfg.dim             = j.value("dim", 128);
    cfg.seed            = j.value("seed", uint64_t(42));
    return cfg;
}

// ── HNSWIndex::Impl ─────────────────────────────────────────────────────────

class HNSWIndex::Impl {
public:
    explicit Impl(const IndexConfig& config)
        : config_(config)
    {
        if (config_.dim <= 0) {
            throw std::invalid_argument("IndexConfig::dim must be positive");
        }
        init_space();
        init_index();
    }

    /// Load index from a previously saved file.
    /// @param path  Path to the saved index file
    void load_from_file(const std::string& path) {
        std::unique_lock<std::shared_mutex> lock(mutex_);

        // Load metadata from the JSON sidecar file if it exists
        std::string meta_path = path + ".meta.json";
        std::ifstream meta_file(meta_path);
        if (meta_file.good()) {
            std::stringstream buffer;
            buffer << meta_file.rdbuf();
            try {
                config_ = IndexConfig::from_json(buffer.str());
            } catch (const std::exception& e) {
                throw std::runtime_error("Corrupt index metadata file '" + meta_path +
                                         "': " + e.what());
            }
        } else {
            // No sidecar: fall back to the configuration the caller supplied.
            // The caller is responsible for a matching dim / metric.
            log_warn("No metadata file found at %s — using current config", meta_path.c_str());
        }

        if (config_.dim <= 0) {
            throw std::invalid_argument("IndexConfig::dim must be positive");
        }

        init_space();
        // A fresh HierarchicalNSW is created first so that loadIndex() has
        // something to fill; hnswlib replaces its internal state.
        init_index();
        try {
            index_->loadIndex(path, space_.get(), config_.max_elements);
        } catch (const std::exception& e) {
            throw std::runtime_error("Failed to load HNSW index '" + path + "': " + e.what());
        }

        // loadIndex() resets ef_ to 10 and may silently keep the file's larger
        // max_elements, so re-apply both from the (possibly sidecar) config.
        index_->setEf(static_cast<std::size_t>(config_.ef_search));
        config_.max_elements = static_cast<std::size_t>(index_->getMaxElements());
        refresh_next_label();
    }

    void init_space() {
        switch (config_.metric_type) {
            case MetricType::Cosine:
                // hnswlib has no cosine space. Like hnswlib's own Python
                // bindings, cosine is implemented as the inner product space
                // over L2-normalized vectors: distance == 1 - cos exactly.
                space_ = std::make_unique<hnswlib::InnerProductSpace>(
                    static_cast<std::size_t>(config_.dim));
                break;
            case MetricType::Euclidean:
                space_ = std::make_unique<hnswlib::L2Space>(
                    static_cast<std::size_t>(config_.dim));
                break;
            case MetricType::InnerProduct:
                space_ = std::make_unique<hnswlib::InnerProductSpace>(
                    static_cast<std::size_t>(config_.dim));
                break;
        }
    }

    void init_index() {
        index_ = std::make_unique<hnswlib::HierarchicalNSW<float>>(
            space_.get(), config_.max_elements, config_.M,
            config_.ef_construction, config_.seed);
        index_->setEf(static_cast<std::size_t>(config_.ef_search));
        next_label_ = 0;
    }

    void build(const float* data, std::size_t num_vectors, int dim) {
        check_dim(dim);
        if (num_vectors != 0 && data == nullptr) {
            throw std::invalid_argument("build(): data must not be null");
        }

        std::unique_lock<std::shared_mutex> lock(mutex_);
        // Re-create index to start fresh
        init_index();
        for (std::size_t i = 0; i < num_vectors; ++i) {
            auto vec = prepare(data + i * static_cast<std::size_t>(config_.dim));
            index_->addPoint(vec.data(), static_cast<hnswlib::labeltype>(i));
        }
        next_label_ = static_cast<int64_t>(num_vectors);
    }

    int64_t insert(const float* vector, std::optional<int64_t> id) {
        if (vector == nullptr) {
            throw std::invalid_argument("insert(): vector must not be null");
        }
        if (id.has_value() && *id < 0) {
            throw std::invalid_argument("insert(): id must not be negative");
        }

        std::unique_lock<std::shared_mutex> lock(mutex_);
        // Labels are assigned monotonically; a label is never reused unless the
        // caller explicitly passes one.
        const int64_t label = id.has_value() ? *id : next_label_;
        next_label_ = std::max(next_label_, label + 1);

        auto vec = prepare(vector);
        index_->addPoint(vec.data(), static_cast<hnswlib::labeltype>(label));
        return label;
    }

    void batch_insert(const float* data, std::size_t num_vectors, int64_t start_id) {
        if (num_vectors != 0 && data == nullptr) {
            throw std::invalid_argument("batch_insert(): data must not be null");
        }
        if (start_id < 0) {
            throw std::invalid_argument("batch_insert(): start_id must not be negative");
        }

        std::unique_lock<std::shared_mutex> lock(mutex_);
        for (std::size_t i = 0; i < num_vectors; ++i) {
            auto vec = prepare(data + i * static_cast<std::size_t>(config_.dim));
            index_->addPoint(vec.data(),
                             static_cast<hnswlib::labeltype>(start_id + static_cast<int64_t>(i)));
        }
        // Keep auto-numbering ahead of every label handed out here.
        next_label_ = std::max(next_label_, start_id + static_cast<int64_t>(num_vectors));
    }

    /// Soft-delete a label. Unknown labels are ignored (hnswlib throws instead,
    /// which would make VectorStore::remove() unusable for stale ids).
    void markDelete(int64_t id) {
        std::unique_lock<std::shared_mutex> lock(mutex_);
        if (index_->label_lookup_.find(static_cast<hnswlib::labeltype>(id)) ==
            index_->label_lookup_.end()) {
            return;
        }
        index_->markDelete(static_cast<hnswlib::labeltype>(id));
    }

    /// Search with the configured ef_search.
    std::vector<SearchResult> search(const float* query, std::size_t k) const {
        std::shared_lock<std::shared_mutex> lock(mutex_);
        return search_unlocked(query, k, config_.ef_search);
    }

    /// Search with a caller supplied ef, without racing on hnswlib's shared
    /// (non-atomic) `ef_` member: the exclusive lock is only taken when the
    /// value actually has to change, so ordinary searches stay concurrent.
    std::vector<SearchResult> search(const float* query, std::size_t k, int ef) const {
        if (ef <= 0 || ef == config_.ef_search) {
            return search(query, k);
        }

        std::unique_lock<std::shared_mutex> lock(mutex_);
        index_->setEf(static_cast<std::size_t>(ef));
        auto out = search_unlocked(query, k, ef);
        index_->setEf(static_cast<std::size_t>(config_.ef_search));
        return out;
    }

    void save(const std::string& path) const {
        std::shared_lock<std::shared_mutex> lock(mutex_);

        try {
            index_->saveIndex(path);
        } catch (const std::exception& e) {
            throw std::runtime_error("Failed to save HNSW index to '" + path + "': " + e.what());
        }

        // Save metadata alongside the index for future loading
        std::string meta_path = path + ".meta.json";
        std::ofstream meta_file(meta_path);
        if (!meta_file) {
            throw std::runtime_error("Cannot open index metadata file for writing: " + meta_path);
        }
        meta_file << config_.to_json();
        meta_file.flush();
        if (!meta_file) {
            throw std::runtime_error("Failed to write index metadata file: " + meta_path);
        }
    }

    void load(const std::string& path) {
        load_from_file(path);
    }

    std::size_t size() const {
        // cur_element_count is atomic inside hnswlib, no lock required.
        return index_->getCurrentElementCount();
    }

    std::size_t capacity() const {
        std::shared_lock<std::shared_mutex> lock(mutex_);
        return config_.max_elements;
    }

    const IndexConfig& config() const { return config_; }

    void resize(std::size_t new_max) {
        std::unique_lock<std::shared_mutex> lock(mutex_);
        if (new_max < index_->getCurrentElementCount()) {
            throw std::invalid_argument(
                "resize(): new_max_elements (" + std::to_string(new_max) +
                ") is smaller than the current element count (" +
                std::to_string(index_->getCurrentElementCount()) + ")");
        }
        index_->resizeIndex(new_max);
        config_.max_elements = new_max;
    }

private:
    IndexConfig config_;
    std::unique_ptr<hnswlib::SpaceInterface<float>> space_;
    std::unique_ptr<hnswlib::HierarchicalNSW<float>> index_;

    /// Guards `index_` and `config_`: shared for searches, exclusive for
    /// mutations (insert / build / load / resize / markDelete).
    mutable std::shared_mutex mutex_;

    /// Next label handed out by insert(); always strictly greater than every
    /// label in use, so it can never silently overwrite an existing element.
    int64_t next_label_ = 0;

    void check_dim(int dim) const {
        if (dim != config_.dim) {
            throw std::invalid_argument("Dimension mismatch: expected " +
                std::to_string(config_.dim) + ", got " + std::to_string(dim));
        }
    }

    /// hnswlib has no cosine space: for MetricType::Cosine the vectors are
    /// L2-normalized before they enter the (inner product) index, so the raw
    /// hnswlib distance is already the cosine distance 1 - cos.
    std::vector<float> prepare(const float* v) const {
        std::vector<float> out(v, v + config_.dim);
        if (config_.metric_type == MetricType::Cosine) {
            normalize(out.data(), out.size());
        }
        return out;
    }

    /// Translate a raw hnswlib distance into the metric documented by
    /// IndexConfig / utils/distance.h:
    ///   Cosine       1 - cos   (raw value, already exact for unit vectors)
    ///   Euclidean    L2        (hnswlib L2Space returns the *squared* L2)
    ///   InnerProduct -dot      (hnswlib InnerProductSpace returns 1 - dot)
    float to_metric_distance(float raw) const {
        switch (config_.metric_type) {
            case MetricType::Cosine:
                return raw > 0.0f ? raw : 0.0f;
            case MetricType::Euclidean:
                return raw > 0.0f ? std::sqrt(raw) : 0.0f;
            case MetricType::InnerProduct:
                return raw - 1.0f;
        }
        return raw;
    }

    /// Shared body of search(); the caller must already hold `mutex_`.
    std::vector<SearchResult> search_unlocked(const float* query, std::size_t k,
                                              int /*ef*/) const {
        if (query == nullptr) {
            throw std::invalid_argument("search(): query must not be null");
        }
        if (k == 0) {
            return {};
        }

        auto vec = prepare(query);
        auto result = index_->searchKnn(vec.data(), k);

        std::vector<SearchResult> out;
        out.reserve(result.size());
        // hnswlib returns a max-heap by distance: pop largest-first ...
        while (!result.empty()) {
            auto& top = result.top();
            out.push_back({static_cast<int64_t>(top.second), to_metric_distance(top.first)});
            result.pop();
        }
        // ... then reverse for ascending distance.
        std::reverse(out.begin(), out.end());
        return out;
    }

    /// Recompute next_label_ from the labels actually present in the index.
    void refresh_next_label() {
        int64_t max_label = -1;
        for (const auto& entry : index_->label_lookup_) {
            max_label = std::max(max_label, static_cast<int64_t>(entry.first));
        }
        next_label_ = max_label + 1;
    }

    static void log_warn(const char* fmt, ...) {
        // Simple stub; in production, use a proper logger
        fprintf(stderr, "[HNSWIndex] WARNING: ");
        va_list args;
        va_start(args, fmt);
        vfprintf(stderr, fmt, args);
        va_end(args);
        fprintf(stderr, "\n");
    }
};

// ── HNSWIndex forwarding ────────────────────────────────────────────────────

HNSWIndex::HNSWIndex(const IndexConfig& config)
    : impl_(std::make_unique<Impl>(config)) {}

HNSWIndex::HNSWIndex(const std::string& path, const IndexConfig& config)
    : impl_(std::make_unique<Impl>(config)) {
    impl_->load(path);
}

HNSWIndex::~HNSWIndex() = default;

HNSWIndex::HNSWIndex(HNSWIndex&&) noexcept = default;
HNSWIndex& HNSWIndex::operator=(HNSWIndex&&) noexcept = default;

void HNSWIndex::build(const float* data, std::size_t num_vectors, int dim) {
    impl_->build(data, num_vectors, dim);
}

int64_t HNSWIndex::insert(const float* vector, std::optional<int64_t> id) {
    return impl_->insert(vector, id);
}

void HNSWIndex::batch_insert(const float* data, std::size_t num_vectors, int64_t start_id) {
    impl_->batch_insert(data, num_vectors, start_id);
}

void HNSWIndex::markDelete(int64_t id) {
    impl_->markDelete(id);
}

std::vector<SearchResult> HNSWIndex::search(const float* query, std::size_t k) const {
    return impl_->search(query, k);
}

std::vector<SearchResult> HNSWIndex::search(const float* query, std::size_t k, int ef) const {
    return impl_->search(query, k, ef);
}

void HNSWIndex::save(const std::string& path) const {
    impl_->save(path);
}

void HNSWIndex::load(const std::string& path) {
    impl_->load(path);
}

std::size_t HNSWIndex::size() const {
    return impl_->size();
}

std::size_t HNSWIndex::capacity() const {
    return impl_->capacity();
}

const IndexConfig& HNSWIndex::config() const {
    return impl_->config();
}

void HNSWIndex::resize(std::size_t new_max_elements) {
    impl_->resize(new_max_elements);
}

} // namespace deepagent::vector_engine
