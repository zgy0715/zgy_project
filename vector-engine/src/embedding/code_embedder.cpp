#include "embedding/code_embedder.h"

#include <cmath>
#include <numeric>
#include <random>
#include <utility>

#include "utils/thread_pool.h"

namespace deepagent::vector_engine {

// ── CodeEmbedder::Impl ──────────────────────────────────────────────────────

class CodeEmbedder::Impl {
public:
    explicit Impl(const EmbedderConfig& config)
        : config_(config)
        , tokenizer_(config.split_strategy)
        , rng_(std::random_device{}())
        , pool_(std::thread::hardware_concurrency())
    {}

    std::vector<float> embed(std::string_view text) const {
        switch (config_.backend) {
            case EmbedderBackend::Dummy:
                return dummy_embed(text);
            case EmbedderBackend::ONNXRuntime:
                // TODO: implement ONNX Runtime inference
                return dummy_embed(text);
            case EmbedderBackend::API:
                // TODO: implement remote API call
                return dummy_embed(text);
        }
        return dummy_embed(text);
    }

    std::vector<std::vector<float>> embed_batch(
        const std::vector<std::string>& texts) const
    {
        const std::size_t n = texts.size();
        if (n == 0) return {};

        // For small batches, serial execution avoids thread pool overhead
        if (n < 4) {
            std::vector<std::vector<float>> results;
            results.reserve(n);
            for (const auto& text : texts) {
                results.push_back(embed(text));
            }
            return results;
        }

        // Parallel execution using the thread pool
        std::vector<std::future<std::vector<float>>> futures;
        futures.reserve(n);

        for (std::size_t i = 0; i < n; ++i) {
            futures.push_back(pool_.submit([this, text = texts[i]]() {
                return embed(text);
            }));
        }

        std::vector<std::vector<float>> results;
        results.reserve(n);
        for (auto& f : futures) {
            results.push_back(f.get());
        }
        return results;
    }

    std::pair<std::vector<CodeToken>, std::vector<std::vector<float>>>
    embed_code(std::string_view source, std::string_view language) const {
        auto tokens = tokenizer_.tokenize(source, language);
        const std::size_t n = tokens.size();

        if (n == 0) {
            return {std::move(tokens), {}};
        }

        // Parallel embedding for token chunks
        if (n >= 4) {
            std::vector<std::future<std::vector<float>>> futures;
            futures.reserve(n);

            for (std::size_t i = 0; i < n; ++i) {
                futures.push_back(pool_.submit([this, text = tokens[i].text]() {
                    return embed(text);
                }));
            }

            std::vector<std::vector<float>> embeddings;
            embeddings.reserve(n);
            for (auto& f : futures) {
                embeddings.push_back(f.get());
            }
            return {std::move(tokens), std::move(embeddings)};
        }

        // Serial fallback for small token counts
        std::vector<std::vector<float>> embeddings;
        embeddings.reserve(n);
        for (const auto& tok : tokens) {
            embeddings.push_back(embed(tok.text));
        }
        return {std::move(tokens), std::move(embeddings)};
    }

    int dim() const { return config_.dim; }
    const EmbedderConfig& config() const { return config_; }

private:
    /// Dummy embedding: hash-based pseudo-random vector, then L2-normalize.
    /// Useful for testing the pipeline without a real model.
    std::vector<float> dummy_embed(std::string_view text) const {
        std::vector<float> vec(config_.dim, 0.0f);

        // Simple hash-based seeding for deterministic-ish output
        std::size_t h = std::hash<std::string_view>{}(text);
        std::mt19937 gen(static_cast<unsigned>(h));
        std::normal_distribution<float> dist(0.0f, 1.0f);

        for (auto& v : vec) {
            v = dist(gen);
        }

        // L2 normalize
        float norm = std::sqrt(std::inner_product(vec.begin(), vec.end(), vec.begin(), 0.0f));
        if (norm > 1e-8f) {
            for (auto& v : vec) v /= norm;
        }

        return vec;
    }

    EmbedderConfig config_;
    Tokenizer      tokenizer_;
    std::mt19937   rng_;
    mutable ThreadPool pool_;   // Thread pool for parallel batch embedding
};

// ── CodeEmbedder forwarding ─────────────────────────────────────────────────

CodeEmbedder::CodeEmbedder(const EmbedderConfig& config)
    : impl_(std::make_unique<Impl>(config)) {}

CodeEmbedder::~CodeEmbedder() = default;

CodeEmbedder::CodeEmbedder(CodeEmbedder&&) noexcept = default;
CodeEmbedder& CodeEmbedder::operator=(CodeEmbedder&&) noexcept = default;

std::vector<float> CodeEmbedder::embed(std::string_view text) const {
    return impl_->embed(text);
}

std::vector<std::vector<float>> CodeEmbedder::embed_batch(
    const std::vector<std::string>& texts) const
{
    return impl_->embed_batch(texts);
}

std::pair<std::vector<CodeToken>, std::vector<std::vector<float>>>
CodeEmbedder::embed_code(std::string_view source, std::string_view language) const {
    return impl_->embed_code(source, language);
}

int CodeEmbedder::dim() const {
    return impl_->dim();
}

const EmbedderConfig& CodeEmbedder::config() const {
    return impl_->config();
}

} // namespace deepagent::vector_engine
