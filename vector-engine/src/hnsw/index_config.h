#pragma once

#include <cstdint>
#include <string>
#include <variant>

namespace deepagent::vector_engine {

/// Distance metric used for vector comparison.
enum class MetricType : uint8_t {
    Cosine,    ///< Cosine similarity (1 - cos_angle)
    Euclidean, ///< L2 distance
    InnerProduct ///< Negative inner product
};

/// Configuration for building / tuning an HNSW index.
struct IndexConfig {
    /// Connectivity parameter (number of neighbors per layer).
    /// Higher M = better recall but more memory. Typical range [4, 64].
    int M = 16;

    /// Size of the dynamic candidate list during construction.
    /// Higher ef_construction = better graph quality but slower build.
    int ef_construction = 200;

    /// Size of the dynamic candidate list during search.
    /// Higher ef_search = better recall but slower query.
    int ef_search = 50;

    /// Maximum number of elements the index can hold.
    std::size_t max_elements = 100000;

    /// Distance metric.
    MetricType metric_type = MetricType::Cosine;

    /// Dimensionality of the vectors.
    int dim = 128;

    /// Random seed for reproducibility.
    uint64_t seed = 42;

    /// Serialize config to JSON string.
    [[nodiscard]] std::string to_json() const;

    /// Deserialize config from JSON string.
    static IndexConfig from_json(const std::string& json_str);
};

} // namespace deepagent::vector_engine
