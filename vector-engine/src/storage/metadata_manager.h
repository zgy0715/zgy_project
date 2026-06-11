#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace deepagent::vector_engine {

/// Manages metadata associated with vector ids.
///
/// Provides a simple key-value mapping from vector id to a JSON metadata
/// string, with persistence support.
class MetadataManager {
public:
    /// Construct with an expected capacity hint.
    explicit MetadataManager(std::size_t reserve_capacity = 100000);

    /// Store metadata for a given id (insert or update).
    void put(int64_t id, const std::string& metadata);

    /// Retrieve metadata for a given id.
    /// @return The metadata string, or std::nullopt if not found
    [[nodiscard]] std::optional<std::string> get(int64_t id) const;

    /// Check whether metadata exists for a given id.
    [[nodiscard]] bool exists(int64_t id) const;

    /// Remove metadata for a given id.
    /// @return true if the entry existed and was removed
    bool remove(int64_t id);

    /// Get all ids currently stored.
    [[nodiscard]] std::vector<int64_t> all_ids() const;

    /// Number of metadata entries.
    [[nodiscard]] std::size_t size() const;

    /// Clear all metadata.
    void clear();

    // ── Persistence ──────────────────────────────────────────────────────

    /// Save metadata to a JSON file.
    void save(const std::string& path) const;

    /// Load metadata from a JSON file (replaces current state).
    void load(const std::string& path);

private:
    std::unordered_map<int64_t, std::string> store_;
};

} // namespace deepagent::vector_engine
