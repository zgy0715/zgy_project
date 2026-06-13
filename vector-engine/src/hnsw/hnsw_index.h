#pragma once

#include <cstddef>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "hnsw/index_config.h"

namespace deepagent::vector_engine {

/// Search result for a single nearest neighbor.
struct SearchResult {
    int64_t id;         ///< Internal element id
    float   distance;   ///< Distance to the query vector
};

/// HNSW-based approximate nearest neighbor index.
///
/// Wraps hnswlib and provides build / search / insert / save / load
/// operations with a Pimpl idiom to hide implementation details.
class HNSWIndex {
public:
    /// Construct an index with the given configuration.
    explicit HNSWIndex(const IndexConfig& config);

    /// Construct from a serialized index file.
    explicit HNSWIndex(const std::string& path);

    /// Destructor — defined in the .cpp where Impl is complete.
    ~HNSWIndex();

    // Non-copyable, movable
    HNSWIndex(const HNSWIndex&) = delete;
    HNSWIndex& operator=(const HNSWIndex&) = delete;
    HNSWIndex(HNSWIndex&&) noexcept;
    HNSWIndex& operator=(HNSWIndex&&) noexcept;

    // ── Index operations ─────────────────────────────────────────────────

    /// Build the index from a batch of vectors.
    /// @param data  Row-major float array of size num_vectors * dim
    /// @param num_vectors  Number of vectors
    /// @param dim  Dimensionality (must match config)
    void build(const float* data, std::size_t num_vectors, int dim);

    /// Insert a single vector into the index.
    /// @param vector  Float array of size dim
    /// @param id      Optional external id; if omitted an auto-incremented id is used
    /// @return The internal id assigned to the vector
    int64_t insert(const float* vector, std::optional<int64_t> id = std::nullopt);

    /// Batch insert multiple vectors.
    /// @param data  Row-major float array of size num_vectors * dim
    /// @param num_vectors  Number of vectors
    /// @param start_id  Starting id for auto-numbering
    void batch_insert(const float* data, std::size_t num_vectors, int64_t start_id = 0);

    /// Mark an element as deleted (soft delete; space is not reclaimed).
    void markDelete(int64_t id);

    /// Search for k nearest neighbors.
    /// @param query  Float array of size dim
    /// @param k      Number of neighbors to return
    /// @return Vector of SearchResult sorted by ascending distance
    [[nodiscard]] std::vector<SearchResult> search(const float* query, std::size_t k) const;

    /// Search with a custom ef value (overrides config.ef_search for this call).
    [[nodiscard]] std::vector<SearchResult> search(const float* query, std::size_t k, int ef) const;

    // ── Persistence ──────────────────────────────────────────────────────

    /// Save the index to disk.
    void save(const std::string& path) const;

    /// Load the index from disk (replaces current state).
    void load(const std::string& path);

    // ── Accessors ────────────────────────────────────────────────────────

    /// Current number of elements in the index.
    [[nodiscard]] std::size_t size() const;

    /// Maximum capacity.
    [[nodiscard]] std::size_t capacity() const;

    /// The configuration used to build this index.
    [[nodiscard]] const IndexConfig& config() const;

    /// Resize the index to hold at least new_max_elements.
    void resize(std::size_t new_max_elements);

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace deepagent::vector_engine
