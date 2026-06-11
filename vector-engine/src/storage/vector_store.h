#pragma once

#include <cstddef>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "hnsw/index_config.h"

namespace deepagent::vector_engine {

/// A record stored in the vector store.
struct VectorRecord {
    int64_t              id;       ///< Unique identifier
    std::vector<float>   vector;   ///< Embedding vector
    std::string          metadata; ///< JSON-encoded metadata payload
};

/// Abstract storage layer for vectors with incremental update support.
///
/// Wraps the HNSW index and provides a higher-level CRUD interface
/// that also manages metadata alongside the raw vectors.
class VectorStore {
public:
    /// Construct a store with the given index configuration.
    explicit VectorStore(const IndexConfig& config);

    /// Construct from a persisted store directory.
    explicit VectorStore(const std::string& directory);

    ~VectorStore();

    // Non-copyable, movable
    VectorStore(const VectorStore&) = delete;
    VectorStore& operator=(const VectorStore&) = delete;
    VectorStore(VectorStore&&) noexcept;
    VectorStore& operator=(VectorStore&&) noexcept;

    // ── CRUD operations ──────────────────────────────────────────────────

    /// Insert a vector with optional metadata.
    /// @return The assigned id
    int64_t insert(const std::vector<float>& vector,
                   const std::string& metadata = "{}");

    /// Batch insert vectors.
    /// @param records  Vector of (vector, metadata) pairs
    /// @return Vector of assigned ids
    std::vector<int64_t> batch_insert(
        const std::vector<std::pair<std::vector<float>, std::string>>& records);

    /// Update an existing vector by id.
    /// @return true if the id existed and was updated
    bool update(int64_t id, const std::vector<float>& vector,
                const std::string& metadata = "{}");

    /// Remove a vector by id (marks as deleted; space is not reclaimed).
    /// @return true if the id existed and was removed
    bool remove(int64_t id);

    /// Look up a vector by id.
    [[nodiscard]] std::optional<VectorRecord> get(int64_t id) const;

    // ── Search ───────────────────────────────────────────────────────────

    /// Search for k nearest neighbors.
    struct SearchHit {
        int64_t     id;
        float       distance;
        std::string metadata;
    };

    [[nodiscard]] std::vector<SearchHit> search(
        const std::vector<float>& query, std::size_t k) const;

    /// Search with a custom ef value.
    [[nodiscard]] std::vector<SearchHit> search(
        const std::vector<float>& query, std::size_t k, int ef) const;

    // ── Persistence ──────────────────────────────────────────────────────

    /// Save index and metadata to a directory.
    void save(const std::string& directory) const;

    /// Load index and metadata from a directory.
    void load(const std::string& directory);

    // ── Accessors ────────────────────────────────────────────────────────

    [[nodiscard]] std::size_t size() const;
    [[nodiscard]] std::size_t capacity() const;
    [[nodiscard]] const IndexConfig& config() const;

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace deepagent::vector_engine
