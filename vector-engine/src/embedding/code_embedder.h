#pragma once

#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "embedding/tokenizer.h"

namespace deepagent::vector_engine {

/// Embedding model type.
enum class EmbedderBackend : uint8_t {
    Dummy,       ///< Zero-vector placeholder for testing
    ONNXRuntime, ///< ONNX Runtime inference (future)
    API,         ///< Remote API call (future)
};

/// Configuration for the code embedder.
struct EmbedderConfig {
    EmbedderBackend backend   = EmbedderBackend::Dummy;
    int             dim       = 128;       ///< Output embedding dimension
    std::string     model_path;            ///< Path to model file (if applicable)
    std::string     api_endpoint;          ///< Remote API endpoint (if applicable)
    SplitStrategy   split_strategy = SplitStrategy::ByFunction;
};

/// Code embedder that converts source code into dense vector representations.
///
/// The embedder first tokenizes source code using a configurable strategy,
/// then produces an embedding vector for each token / chunk.
class CodeEmbedder {
public:
    /// Construct with the given configuration.
    explicit CodeEmbedder(const EmbedderConfig& config);

    ~CodeEmbedder();

    // Non-copyable, movable
    CodeEmbedder(const CodeEmbedder&) = delete;
    CodeEmbedder& operator=(const CodeEmbedder&) = delete;
    CodeEmbedder(CodeEmbedder&&) noexcept;
    CodeEmbedder& operator=(CodeEmbedder&&) noexcept;

    /// Embed a single text string.
    /// @param text  Source code or natural language text
    /// @return Embedding vector of size config.dim
    [[nodiscard]] std::vector<float> embed(std::string_view text) const;

    /// Embed multiple text strings in batch.
    /// @param texts  Vector of text strings
    /// @return Vector of embedding vectors
    [[nodiscard]] std::vector<std::vector<float>> embed_batch(
        const std::vector<std::string>& texts) const;

    /// Tokenize source code and embed each chunk.
    /// @param source    Full source code
    /// @param language  Language hint
    /// @return Pair of (tokens, embeddings)
    [[nodiscard]] std::pair<std::vector<CodeToken>, std::vector<std::vector<float>>>
    embed_code(std::string_view source, std::string_view language = "cpp") const;

    /// Get the embedding dimension.
    [[nodiscard]] int dim() const;

    /// Get the current configuration.
    [[nodiscard]] const EmbedderConfig& config() const;

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace deepagent::vector_engine
