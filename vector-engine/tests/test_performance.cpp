/**
 * Performance benchmarks for the Vector Engine.
 *
 * Measures:
 * - HNSW index build time (various sizes)
 * - Search latency (various k values)
 * - Insert throughput
 * - Batch operations
 * - Distance computation throughput
 */

#include <gtest/gtest.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <numeric>
#include <random>
#include <vector>

#include "embedding/code_embedder.h"
#include "hnsw/hnsw_index.h"
#include "hnsw/index_config.h"
#include "storage/vector_store.h"
#include "utils/distance.h"
#include "utils/thread_pool.h"

using namespace deepagent::vector_engine;

namespace {

// ── Performance thresholds (milliseconds) ──────────────────────────────────

constexpr double HNSW_BUILD_1K_MS   = 5000.0;   // Build 1K vectors in < 5s
constexpr double HNSW_BUILD_10K_MS  = 60000.0;  // Build 10K vectors in < 60s
constexpr double HNSW_SEARCH_MS     = 10.0;      // Single search in < 10ms
constexpr double HNSW_INSERT_MS     = 1.0;       // Single insert in < 1ms
constexpr double EMBED_BATCH_MS     = 100.0;     // Batch embed 100 in < 100ms
constexpr double DISTANCE_THROUGHPUT_US = 1.0;   // Single distance < 1us (128-dim)

// ── Helpers ────────────────────────────────────────────────────────────────

/// Generate random float vectors.
std::vector<float> generate_random_vectors(size_t count, int dim, unsigned seed = 42) {
    std::mt19937 rng(seed);
    std::normal_distribution<float> dist(0.0f, 1.0f);
    std::vector<float> data(count * dim);
    for (auto& v : data) v = dist(rng);
    return data;
}

/// Generate random strings for embedder benchmarks.
std::vector<std::string> generate_random_strings(size_t count, size_t length = 64) {
    static const char alphanum[] =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    std::mt19937 rng(99);
    std::uniform_int_distribution<size_t> pick(0, sizeof(alphanum) - 2);

    std::vector<std::string> texts;
    texts.reserve(count);
    for (size_t i = 0; i < count; ++i) {
        std::string s(length, '\0');
        for (size_t j = 0; j < length; ++j) {
            s[j] = alphanum[pick(rng)];
        }
        texts.push_back(std::move(s));
    }
    return texts;
}

/// RAII timer for benchmark scopes.
class ScopedTimer {
public:
    explicit ScopedTimer(const std::string& label)
        : label_(label), start_(std::chrono::high_resolution_clock::now()) {}

    ~ScopedTimer() {
        auto end = std::chrono::high_resolution_clock::now();
        auto ms = std::chrono::duration<double, std::milli>(end - start_).count();
        // Output is captured by gtest
        std::cout << "[  BENCH  ] " << label_ << ": " << ms << " ms\n";
    }

    double elapsed_ms() const {
        auto now = std::chrono::high_resolution_clock::now();
        return std::chrono::duration<double, std::milli>(now - start_).count();
    }

private:
    std::string label_;
    std::chrono::high_resolution_clock::time_point start_;
};

/// Compute statistics from a list of durations (in ms).
struct BenchStats {
    double mean;
    double median;
    double p95;
    double min_val;
    double max_val;

    explicit BenchStats(std::vector<double> durations) {
        std::sort(durations.begin(), durations.end());
        size_t n = durations.size();
        mean = std::accumulate(durations.begin(), durations.end(), 0.0) / n;
        median = durations[n / 2];
        p95 = durations[static_cast<size_t>(n * 0.95)];
        min_val = durations.front();
        max_val = durations.back();
    }
};

/// Run a callable N times and return timing stats in milliseconds.
template <typename F>
BenchStats run_benchmark(const std::string& label, F&& func, int iterations = 20) {
    std::vector<double> durations;
    durations.reserve(iterations);

    // Warm-up run
    func();

    for (int i = 0; i < iterations; ++i) {
        auto start = std::chrono::high_resolution_clock::now();
        func();
        auto end = std::chrono::high_resolution_clock::now();
        durations.push_back(
            std::chrono::duration<double, std::milli>(end - start).count());
    }

    BenchStats stats(durations);
    std::cout << "[  BENCH  ] " << label
              << ": mean=" << stats.mean << "ms, median=" << stats.median
              << "ms, p95=" << stats.p95 << "ms\n";
    return stats;
}

} // anonymous namespace

// ═══════════════════════════════════════════════════════════════════════════
// HNSW Index Build Performance
// ═══════════════════════════════════════════════════════════════════════════

class HNSWBuildPerformance : public ::testing::Test {
protected:
    void SetUp() override {
        config_.dim = 128;
        config_.M = 16;
        config_.ef_construction = 200;
        config_.ef_search = 50;
        config_.max_elements = 20000;
        config_.metric_type = MetricType::Cosine;
    }

    IndexConfig config_;
};

TEST_F(HNSWBuildPerformance, Build1KVectors) {
    auto data = generate_random_vectors(1000, config_.dim);

    auto stats = run_benchmark("HNSW build 1K vectors", [&]() {
        HNSWIndex index(config_);
        index.build(data.data(), 1000, config_.dim);
    }, 5);

    EXPECT_LT(stats.mean, HNSW_BUILD_1K_MS)
        << "Building 1K vectors took " << stats.mean << "ms (threshold: "
        << HNSW_BUILD_1K_MS << "ms)";
}

TEST_F(HNSWBuildPerformance, Build10KVectors) {
    auto data = generate_random_vectors(10000, config_.dim);
    config_.max_elements = 20000;

    auto stats = run_benchmark("HNSW build 10K vectors", [&]() {
        HNSWIndex index(config_);
        index.build(data.data(), 10000, config_.dim);
    }, 3);

    EXPECT_LT(stats.mean, HNSW_BUILD_10K_MS)
        << "Building 10K vectors took " << stats.mean << "ms (threshold: "
        << HNSW_BUILD_10K_MS << "ms)";
}

// ═══════════════════════════════════════════════════════════════════════════
// HNSW Search Performance
// ═══════════════════════════════════════════════════════════════════════════

class HNSWSearchPerformance : public ::testing::Test {
protected:
    void SetUp() override {
        config_.dim = 128;
        config_.M = 16;
        config_.ef_construction = 200;
        config_.ef_search = 50;
        config_.max_elements = 2000;
        config_.metric_type = MetricType::Cosine;

        data_ = generate_random_vectors(1000, config_.dim);
        index_ = std::make_unique<HNSWIndex>(config_);
        index_->build(data_.data(), 1000, config_.dim);
    }

    IndexConfig config_;
    std::vector<float> data_;
    std::unique_ptr<HNSWIndex> index_;
};

TEST_F(HNSWSearchPerformance, SearchK1) {
    auto stats = run_benchmark("HNSW search k=1", [&]() {
        auto results = index_->search(data_.data(), 1);
        // Prevent optimizer from removing the call
        EXPECT_FALSE(results.empty());
    }, 50);

    EXPECT_LT(stats.p95, HNSW_SEARCH_MS)
        << "Search k=1 p95=" << stats.p95 << "ms exceeds threshold "
        << HNSW_SEARCH_MS << "ms";
}

TEST_F(HNSWSearchPerformance, SearchK10) {
    auto stats = run_benchmark("HNSW search k=10", [&]() {
        auto results = index_->search(data_.data(), 10);
        EXPECT_GE(results.size(), 1u);
    }, 50);

    EXPECT_LT(stats.p95, HNSW_SEARCH_MS)
        << "Search k=10 p95=" << stats.p95 << "ms exceeds threshold "
        << HNSW_SEARCH_MS << "ms";
}

TEST_F(HNSWSearchPerformance, SearchK100) {
    auto stats = run_benchmark("HNSW search k=100", [&]() {
        auto results = index_->search(data_.data(), 100);
        EXPECT_GE(results.size(), 1u);
    }, 50);

    // k=100 is more demanding; allow 2x threshold
    EXPECT_LT(stats.p95, HNSW_SEARCH_MS * 2)
        << "Search k=100 p95=" << stats.p95 << "ms exceeds threshold "
        << HNSW_SEARCH_MS * 2 << "ms";
}

// ═══════════════════════════════════════════════════════════════════════════
// HNSW Insert Performance
// ═══════════════════════════════════════════════════════════════════════════

class HNSWInsertPerformance : public ::testing::Test {
protected:
    void SetUp() override {
        config_.dim = 128;
        config_.M = 16;
        config_.ef_construction = 200;
        config_.ef_search = 50;
        config_.max_elements = 2000;
        config_.metric_type = MetricType::Cosine;
    }

    IndexConfig config_;
};

TEST_F(HNSWInsertPerformance, SingleInsertThroughput) {
    HNSWIndex index(config_);
    auto vectors = generate_random_vectors(100, config_.dim);

    // Measure individual insert times
    std::vector<double> insert_times;
    insert_times.reserve(100);

    for (size_t i = 0; i < 100; ++i) {
        auto start = std::chrono::high_resolution_clock::now();
        index.insert(vectors.data() + i * config_.dim);
        auto end = std::chrono::high_resolution_clock::now();
        insert_times.push_back(
            std::chrono::duration<double, std::milli>(end - start).count());
    }

    BenchStats stats(insert_times);
    std::cout << "[  BENCH  ] HNSW single insert: mean=" << stats.mean
              << "ms, p95=" << stats.p95 << "ms\n";

    EXPECT_LT(stats.p95, HNSW_INSERT_MS)
        << "Single insert p95=" << stats.p95 << "ms exceeds threshold "
        << HNSW_INSERT_MS << "ms";
}

TEST_F(HNSWInsertPerformance, BatchInsertThroughput) {
    HNSWIndex index(config_);
    auto data = generate_random_vectors(500, config_.dim);

    auto stats = run_benchmark("HNSW batch insert 500", [&]() {
        HNSWIndex temp_index(config_);
        temp_index.batch_insert(data.data(), 500, 0);
    }, 5);

    // Batch insert should be faster per vector than individual inserts
    double per_vector_ms = stats.mean / 500.0;
    EXPECT_LT(per_vector_ms, HNSW_INSERT_MS)
        << "Batch insert per-vector=" << per_vector_ms << "ms exceeds threshold "
        << HNSW_INSERT_MS << "ms";
}

// ═══════════════════════════════════════════════════════════════════════════
// VectorStore CRUD Performance
// ═══════════════════════════════════════════════════════════════════════════

class VectorStoreCRUDPerformance : public ::testing::Test {
protected:
    void SetUp() override {
        config_.dim = 128;
        config_.M = 16;
        config_.ef_construction = 200;
        config_.ef_search = 50;
        config_.max_elements = 2000;
        config_.metric_type = MetricType::Cosine;
    }

    IndexConfig config_;
};

TEST_F(VectorStoreCRUDPerformance, FullCRUDCycle) {
    VectorStore store(config_);
    auto vec = generate_random_vectors(1, config_.dim);

    // Insert
    auto insert_stats = run_benchmark("VectorStore insert", [&]() {
        VectorStore s(config_);
        s.insert(std::vector<float>(vec.begin(), vec.end()), R"({"test":true})");
    }, 20);

    // Insert a vector for get/search benchmarks
    auto id = store.insert(std::vector<float>(vec.begin(), vec.end()), R"({"test":true})");

    // Get
    auto get_stats = run_benchmark("VectorStore get", [&]() {
        auto record = store.get(id);
        EXPECT_TRUE(record.has_value());
    }, 50);

    // Search
    auto search_stats = run_benchmark("VectorStore search k=10", [&]() {
        auto hits = store.search(std::vector<float>(vec.begin(), vec.end()), 10);
        EXPECT_FALSE(hits.empty());
    }, 50);

    // Update
    auto update_stats = run_benchmark("VectorStore update", [&]() {
        store.update(id, std::vector<float>(vec.begin(), vec.end()), R"({"updated":true})");
    }, 20);

    // Remove
    VectorStore store2(config_);
    auto id2 = store2.insert(std::vector<float>(vec.begin(), vec.end()));
    auto remove_stats = run_benchmark("VectorStore remove", [&]() {
        VectorStore s(config_);
        auto rid = s.insert(std::vector<float>(vec.begin(), vec.end()));
        s.remove(rid);
    }, 20);
}

// ═══════════════════════════════════════════════════════════════════════════
// CodeEmbedder Performance
// ═══════════════════════════════════════════════════════════════════════════

class CodeEmbedderPerformance : public ::testing::Test {
protected:
    void SetUp() override {
        EmbedderConfig config;
        config.backend = EmbedderBackend::Dummy;
        config.dim = 128;
        config.split_strategy = SplitStrategy::ByFunction;
        embedder_ = std::make_unique<CodeEmbedder>(config);
    }

    std::unique_ptr<CodeEmbedder> embedder_;
};

TEST_F(CodeEmbedderPerformance, SingleEmbedLatency) {
    std::string text = "def hello_world(): print('Hello, World!')";

    auto stats = run_benchmark("CodeEmbedder embed (single)", [&]() {
        auto vec = embedder_->embed(text);
        EXPECT_EQ(static_cast<int>(vec.size()), embedder_->dim());
    }, 50);

    // Dummy embedder should be very fast
    EXPECT_LT(stats.p95, 5.0)
        << "Single embed p95=" << stats.p95 << "ms exceeds 5ms";
}

TEST_F(CodeEmbedderPerformance, BatchEmbedLatency) {
    auto texts = generate_random_strings(100);

    auto stats = run_benchmark("CodeEmbedder embed_batch (100 texts)", [&]() {
        auto results = embedder_->embed_batch(texts);
        EXPECT_EQ(results.size(), texts.size());
    }, 10);

    EXPECT_LT(stats.mean, EMBED_BATCH_MS)
        << "Batch embed 100 texts took " << stats.mean << "ms (threshold: "
        << EMBED_BATCH_MS << "ms)";
}

TEST_F(CodeEmbedderPerformance, EmbedCodeLatency) {
    std::string source = R"(
#include <iostream>
#include <vector>

int main() {
    std::vector<int> data = {1, 2, 3, 4, 5};
    for (const auto& x : data) {
        std::cout << x << std::endl;
    }
    return 0;
}
)";

    auto stats = run_benchmark("CodeEmbedder embed_code", [&]() {
        auto [tokens, embeddings] = embedder_->embed_code(source, "cpp");
        EXPECT_FALSE(tokens.empty());
        EXPECT_EQ(tokens.size(), embeddings.size());
    }, 20);

    EXPECT_LT(stats.p95, 50.0)
        << "Embed code p95=" << stats.p95 << "ms exceeds 50ms";
}

// ═══════════════════════════════════════════════════════════════════════════
// Distance Computation Performance
// ═══════════════════════════════════════════════════════════════════════════

class DistanceComputationPerformance : public ::testing::Test {
protected:
    void SetUp() override {
        dim_ = 128;
        a_ = generate_random_vectors(1, dim_);
        b_ = generate_random_vectors(1, dim_);
    }

    int dim_;
    std::vector<float> a_;
    std::vector<float> b_;
};

TEST_F(DistanceComputationPerformance, CosineDistanceThroughput) {
    auto stats = run_benchmark("cosine_distance (128-dim)", [&]() {
        float d = cosine_distance(a_.data(), b_.data(), dim_);
        EXPECT_TRUE(std::isfinite(d));
    }, 1000);

    // Should be sub-millisecond
    EXPECT_LT(stats.mean, 0.1)
        << "Cosine distance mean=" << stats.mean << "ms exceeds 0.1ms";
}

TEST_F(DistanceComputationPerformance, EuclideanDistanceThroughput) {
    auto stats = run_benchmark("euclidean_distance (128-dim)", [&]() {
        float d = euclidean_distance(a_.data(), b_.data(), dim_);
        EXPECT_TRUE(std::isfinite(d));
    }, 1000);

    EXPECT_LT(stats.mean, 0.1)
        << "Euclidean distance mean=" << stats.mean << "ms exceeds 0.1ms";
}

TEST_F(DistanceComputationPerformance, PairwiseDistancesThroughput) {
    int n = 100, m = 50;
    auto a_batch = generate_random_vectors(n, dim_);
    auto b_batch = generate_random_vectors(m, dim_);

    auto stats = run_benchmark("pairwise_distances (100x50, 128-dim)", [&]() {
        auto dists = pairwise_distances(
            a_batch.data(), b_batch.data(), n, m, dim_,
            DistanceMetric::Cosine);
        EXPECT_EQ(dists.size(), static_cast<size_t>(n * m));
    }, 20);

    EXPECT_LT(stats.mean, 100.0)
        << "Pairwise distances mean=" << stats.mean << "ms exceeds 100ms";
}

TEST_F(DistanceComputationPerformance, NormalizeThroughput) {
    auto vec = generate_random_vectors(1, dim_);

    auto stats = run_benchmark("normalize (128-dim)", [&]() {
        auto v = normalized(vec.data(), dim_);
        EXPECT_EQ(v.size(), static_cast<size_t>(dim_));
    }, 1000);

    EXPECT_LT(stats.mean, 0.05)
        << "Normalize mean=" << stats.mean << "ms exceeds 0.05ms";
}
