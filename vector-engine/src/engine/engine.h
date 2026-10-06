#pragma once

#include <cstddef>
#include <memory>
#include <string>
#include <vector>

namespace deepagent::vector_engine {

/// A document handed to Engine::index().
struct EngineDocument {
    std::string id;       ///< Caller supplied identifier (may be empty)
    std::string content;  ///< Text that is embedded
    std::string metadata; ///< JSON object, or empty for no metadata
};

/// A single search hit returned by Engine::search().
struct EngineHit {
    std::string id;        ///< The caller supplied identifier
    std::string content;   ///< The indexed content
    std::string metadata;  ///< JSON object with the caller's metadata
    float       score    = 0.0f; ///< Similarity score, higher is better
    float       distance = 0.0f; ///< Distance in the configured metric
};

/// High level, binding-friendly facade over the embedder and the vector store.
///
/// This is the surface the Python bindings expose as `vector_engine.Engine`.
/// It intentionally has no Python or pybind11 dependency so it can be linked
/// and tested from C++ as well.
class Engine {
public:
    /// Construct an engine for vectors of @p embedding_dim dimensions.
    /// @param backend  "dummy" (default, deterministic stub), "onnx" or "api"
    explicit Engine(int embedding_dim, const std::string& backend = "dummy");

    ~Engine();

    // Non-copyable, movable
    Engine(const Engine&) = delete;
    Engine& operator=(const Engine&) = delete;
    Engine(Engine&&) noexcept;
    Engine& operator=(Engine&&) noexcept;

    /// Embed a single text.
    [[nodiscard]] std::vector<float> embed(const std::string& text) const;

    /// Embed a batch of texts.
    [[nodiscard]] std::vector<std::vector<float>> embed_batch(
        const std::vector<std::string>& texts) const;

    /// Index (or re-index) documents into a collection.
    /// Documents whose id already exists in the collection are updated.
    /// @return Number of documents indexed
    std::size_t index(const std::vector<EngineDocument>& documents,
                      const std::string& collection);

    /// Search a collection.
    /// @param filters_json  JSON object of metadata equalities, or empty
    /// @return Hits ordered by ascending distance, at most @p top_k of them
    [[nodiscard]] std::vector<EngineHit> search(const std::string& query,
                                                std::size_t top_k,
                                                const std::string& collection,
                                                const std::string& filters_json = "") const;

    /// Embedding dimension this engine was created with.
    [[nodiscard]] int dim() const;

    /// Number of documents in a collection (0 for unknown collections).
    [[nodiscard]] std::size_t collection_size(const std::string& collection) const;

    /// Names of all collections that have been created.
    [[nodiscard]] std::vector<std::string> collections() const;

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace deepagent::vector_engine
