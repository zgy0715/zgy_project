#include "hnsw/hnsw_index.h"

#include <stdexcept>
#include <utility>

#include <hnswlib/hnswlib.h>
#include <nlohmann/json.hpp>

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
        init_space();
        init_index();
    }

    explicit Impl(const std::string& path)
    {
        // We need to know the config before loading; read metadata first.
        // For now, load with a default and overwrite.
        throw std::runtime_error("Load-from-path constructor requires config; use load() instead");
    }

    void init_space() {
        switch (config_.metric_type) {
            case MetricType::Cosine:
                space_ = std::make_unique<hnswlib::CosineSpace>(config_.dim);
                break;
            case MetricType::Euclidean:
                space_ = std::make_unique<hnswlib::L2Space>(config_.dim);
                break;
            case MetricType::InnerProduct:
                space_ = std::make_unique<hnswlib::InnerProductSpace>(config_.dim);
                break;
        }
    }

    void init_index() {
        index_ = std::make_unique<hnswlib::HierarchicalNSW<float>>(
            space_.get(), config_.max_elements, config_.M,
            config_.ef_construction, config_.seed);
        index_->setEf(config_.ef_search);
    }

    void build(const float* data, std::size_t num_vectors, int dim) {
        if (dim != config_.dim) {
            throw std::invalid_argument("Dimension mismatch: expected " +
                std::to_string(config_.dim) + ", got " + std::to_string(dim));
        }
        // Re-create index to start fresh
        init_index();
        for (std::size_t i = 0; i < num_vectors; ++i) {
            index_->addPoint(data + i * config_.dim, static_cast<hnswlib::labeltype>(i));
        }
    }

    int64_t insert(const float* vector, std::optional<int64_t> id) {
        auto label = id.value_or(static_cast<int64_t>(index_->getCurrentElementCount()));
        index_->addPoint(vector, static_cast<hnswlib::labeltype>(label));
        return label;
    }

    void batch_insert(const float* data, std::size_t num_vectors, int64_t start_id) {
        for (std::size_t i = 0; i < num_vectors; ++i) {
            index_->addPoint(data + i * config_.dim,
                             static_cast<hnswlib::labeltype>(start_id + static_cast<int64_t>(i)));
        }
    }

    std::vector<SearchResult> search(const float* query, std::size_t k, int ef) const {
        int old_ef = index_->getEf();
        if (ef != old_ef) {
            index_->setEf(ef);
        }
        auto result = index_->searchKnn(query, k);
        if (ef != old_ef) {
            index_->setEf(old_ef);
        }

        std::vector<SearchResult> out;
        out.reserve(result.size());
        while (!result.empty()) {
            auto& top = result.top();
            out.push_back({static_cast<int64_t>(top.second), top.first});
            result.pop();
        }
        // hnswlib returns max-heap; reverse for ascending distance
        std::reverse(out.begin(), out.end());
        return out;
    }

    void save(const std::string& path) const {
        index_->saveIndex(path);
    }

    void load(const std::string& path) {
        init_space();
        init_index();
        index_->loadIndex(path, space_.get(), config_.max_elements);
    }

    std::size_t size() const {
        return index_->getCurrentElementCount();
    }

    std::size_t capacity() const {
        return config_.max_elements;
    }

    const IndexConfig& config() const { return config_; }

    void resize(std::size_t new_max) {
        index_->resizeIndex(new_max);
        config_.max_elements = new_max;
    }

private:
    IndexConfig config_;
    std::unique_ptr<hnswlib::SpaceInterface<float>> space_;
    std::unique_ptr<hnswlib::HierarchicalNSW<float>> index_;
};

// ── HNSWIndex forwarding ────────────────────────────────────────────────────

HNSWIndex::HNSWIndex(const IndexConfig& config)
    : impl_(std::make_unique<Impl>(config)) {}

HNSWIndex::HNSWIndex(const std::string& path)
    : impl_(std::make_unique<Impl>(path)) {}

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

std::vector<SearchResult> HNSWIndex::search(const float* query, std::size_t k) const {
    return impl_->search(query, k, impl_->config().ef_search);
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
