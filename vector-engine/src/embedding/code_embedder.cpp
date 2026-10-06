#include "embedding/code_embedder.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <numeric>
#include <utility>

#include "utils/thread_pool.h"

namespace deepagent::vector_engine {

namespace {

/// FNV-1a 64-bit hash. std::hash is implementation defined, so using it would
/// make the stub embeddings differ between compilers/processes and break
/// comparisons of persisted vectors.
uint64_t fnv1a(std::string_view text) {
    uint64_t hash = 1469598103934665603ull; // FNV offset basis
    for (unsigned char c : text) {
        hash ^= static_cast<uint64_t>(c);
        hash *= 1099511628211ull;           // FNV prime
    }
    return hash;
}

/// splitmix64: tiny, fully portable PRNG, so the dummy embedding is identical
/// on every platform and STL implementation.
uint64_t splitmix64(uint64_t& state) {
    state += 0x9E3779B97F4A7C15ull;
    uint64_t z = state;
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ull;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBull;
    return z ^ (z >> 31);
}

} // namespace

// ── CodeEmbedder::Impl ──────────────────────────────────────────────────────

class CodeEmbedder::Impl {
public:
    explicit Impl(const EmbedderConfig& config)
        : config_(config)
        , tokenizer_(config.split_strategy)
    {
        // Only backends that do real work get a thread pool; the stub backend
        // has nothing to parallelize and must not spawn threads.
        if (config_.backend != EmbedderBackend::Dummy) {
            const unsigned hw = std::thread::hardware_concurrency();
            pool_ = std::make_unique<ThreadPool>(std::max(1u, hw));
        }
    }

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

        // For small batches (or when there is no pool) serial execution avoids
        // thread pool overhead
        if (n < 4 || !pool_) {
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
            futures.push_back(pool_->submit([this, text = texts[i]]() {
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
        if (n >= 4 && pool_) {
            std::vector<std::future<std::vector<float>>> futures;
            futures.reserve(n);

            for (std::size_t i = 0; i < n; ++i) {
                futures.push_back(pool_->submit([this, text = tokens[i].text]() {
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
    /// Dummy embedding: deterministic hash-based pseudo-random vector, then
    /// L2-normalize. Useful for testing the pipeline without a real model.
    /// The same text always maps to the same vector, on every platform.
    std::vector<float> dummy_embed(std::string_view text) const {
        std::vector<float> vec(config_.dim, 0.0f);

        uint64_t state = fnv1a(text);
        for (auto& v : vec) {
            // Map the top 53 bits to [0, 1) and then to [-1, 1).
            const double unit = static_cast<double>(splitmix64(state) >> 11) *
                                (1.0 / 9007199254740992.0);
            v = static_cast<float>(unit * 2.0 - 1.0);
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
    /// Only allocated for backends that actually compute; null means "run the
    /// batch serially" (see the constructor).
    std::unique_ptr<ThreadPool> pool_;
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
