#include <gtest/gtest.h>

#include <cmath>
#include <vector>

#include "hnsw/hnsw_index.h"
#include "hnsw/index_config.h"

using namespace deepagent::vector_engine;

namespace {

/// Generate a random float vector of the given dimension.
std::vector<float> random_vector(int dim, unsigned seed = 42) {
    std::vector<float> v(dim);
    std::srand(seed);
    for (auto& x : v) x = static_cast<float>(std::rand()) / RAND_MAX;
    return v;
}

/// Generate a batch of random vectors.
std::vector<float> random_batch(int n, int dim, unsigned seed = 42) {
    std::vector<float> data(n * dim);
    std::srand(seed);
    for (auto& x : data) x = static_cast<float>(std::rand()) / RAND_MAX;
    return data;
}

} // anonymous namespace

// ── IndexConfig tests ───────────────────────────────────────────────────────

TEST(IndexConfigTest, DefaultValues) {
    IndexConfig cfg;
    EXPECT_EQ(cfg.M, 16);
    EXPECT_EQ(cfg.ef_construction, 200);
    EXPECT_EQ(cfg.ef_search, 50);
    EXPECT_EQ(cfg.max_elements, 100000u);
    EXPECT_EQ(cfg.metric_type, MetricType::Cosine);
    EXPECT_EQ(cfg.dim, 128);
}

TEST(IndexConfigTest, JsonRoundTrip) {
    IndexConfig cfg;
    cfg.M = 32;
    cfg.ef_construction = 400;
    cfg.ef_search = 100;
    cfg.metric_type = MetricType::Euclidean;
    cfg.dim = 256;

    auto json_str = cfg.to_json();
    auto cfg2 = IndexConfig::from_json(json_str);

    EXPECT_EQ(cfg2.M, 32);
    EXPECT_EQ(cfg2.ef_construction, 400);
    EXPECT_EQ(cfg2.ef_search, 100);
    EXPECT_EQ(cfg2.metric_type, MetricType::Euclidean);
    EXPECT_EQ(cfg2.dim, 256);
}

// ── HNSWIndex tests ─────────────────────────────────────────────────────────

class HNSWIndexTest : public ::testing::Test {
protected:
    void SetUp() override {
        config_.dim = 8;
        config_.M = 8;
        config_.ef_construction = 50;
        config_.ef_search = 50;
        config_.max_elements = 1000;
        config_.metric_type = MetricType::Cosine;
    }

    IndexConfig config_;
};

TEST_F(HNSWIndexTest, BuildAndSearch) {
    HNSWIndex index(config_);

    int n = 100;
    auto data = random_batch(n, config_.dim);
    index.build(data.data(), n, config_.dim);

    EXPECT_EQ(index.size(), static_cast<std::size_t>(n));
    EXPECT_GE(index.capacity(), static_cast<std::size_t>(n));

    // Search for the first vector — it should be its own nearest neighbor
    auto results = index.search(data.data(), 1);
    ASSERT_FALSE(results.empty());
    EXPECT_EQ(results[0].id, 0);
    EXPECT_NEAR(results[0].distance, 0.0f, 1e-4f);
}

TEST_F(HNSWIndexTest, InsertAndSearch) {
    HNSWIndex index(config_);

    auto v0 = random_vector(config_.dim, 1);
    auto v1 = random_vector(config_.dim, 2);
    auto v2 = random_vector(config_.dim, 3);

    auto id0 = index.insert(v0.data());
    auto id1 = index.insert(v1.data());
    auto id2 = index.insert(v2.data());

    EXPECT_EQ(index.size(), 3u);

    // Search for v0
    auto results = index.search(v0.data(), 1);
    ASSERT_FALSE(results.empty());
    EXPECT_EQ(results[0].id, id0);
}

TEST_F(HNSWIndexTest, BatchInsert) {
    HNSWIndex index(config_);

    int n = 50;
    auto data = random_batch(n, config_.dim);
    index.batch_insert(data.data(), n, 0);

    EXPECT_EQ(index.size(), static_cast<std::size_t>(n));

    auto results = index.search(data.data(), 5);
    EXPECT_EQ(results.size(), 5u);
}

TEST_F(HNSWIndexTest, SearchWithCustomEf) {
    HNSWIndex index(config_);

    int n = 100;
    auto data = random_batch(n, config_.dim);
    index.build(data.data(), n, config_.dim);

    // Higher ef should give at least as good results
    auto results_low  = index.search(data.data(), 1, 10);
    auto results_high = index.search(data.data(), 1, 200);

    ASSERT_FALSE(results_high.empty());
    EXPECT_NEAR(results_high[0].distance, 0.0f, 1e-4f);
}

TEST_F(HNSWIndexTest, SaveAndLoad) {
    HNSWIndex index(config_);

    int n = 50;
    auto data = random_batch(n, config_.dim);
    index.build(data.data(), n, config_.dim);

    // Save
    std::string path = "test_index.bin";
    index.save(path);

    // Load into a new index
    HNSWIndex index2(config_);
    index2.load(path);

    EXPECT_EQ(index2.size(), static_cast<std::size_t>(n));

    // Search should return similar results
    auto results1 = index.search(data.data(), 5);
    auto results2 = index2.search(data.data(), 5);

    EXPECT_EQ(results1.size(), results2.size());
}

TEST_F(HNSWIndexTest, Resize) {
    HNSWIndex index(config_);

    int n = 50;
    auto data = random_batch(n, config_.dim);
    index.build(data.data(), n, config_.dim);

    index.resize(2000);
    EXPECT_EQ(index.capacity(), 2000u);
}

TEST_F(HNSWIndexTest, EuclideanMetric) {
    IndexConfig cfg = config_;
    cfg.metric_type = MetricType::Euclidean;

    HNSWIndex index(cfg);
    int n = 50;
    auto data = random_batch(n, cfg.dim);
    index.build(data.data(), n, cfg.dim);

    auto results = index.search(data.data(), 1);
    ASSERT_FALSE(results.empty());
    EXPECT_NEAR(results[0].distance, 0.0f, 1e-2f);
}

TEST_F(HNSWIndexTest, InnerProductMetric) {
    IndexConfig cfg = config_;
    cfg.metric_type = MetricType::InnerProduct;

    HNSWIndex index(cfg);
    int n = 50;
    auto data = random_batch(n, cfg.dim);
    index.build(data.data(), n, cfg.dim);

    auto results = index.search(data.data(), 1);
    ASSERT_FALSE(results.empty());
    // Inner product distance is negative dot product; self-search should be
    // the most negative (closest)
    EXPECT_LT(results[0].distance, 0.0f);
}
