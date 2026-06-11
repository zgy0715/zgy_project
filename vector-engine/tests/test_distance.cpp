#include <gtest/gtest.h>

#include <cmath>
#include <vector>

#include "utils/distance.h"

using namespace deepagent::vector_engine;

namespace {

/// Tolerance for floating-point comparisons.
constexpr float kTol = 1e-5f;

} // anonymous namespace

// ── Cosine similarity / distance ────────────────────────────────────────────

TEST(DistanceTest, CosineSimilarityIdentical) {
    std::vector<float> a = {1.0f, 0.0f, 0.0f};
    float sim = cosine_similarity(a.data(), a.data(), 3);
    EXPECT_NEAR(sim, 1.0f, kTol);
}

TEST(DistanceTest, CosineSimilarityOrthogonal) {
    std::vector<float> a = {1.0f, 0.0f, 0.0f};
    std::vector<float> b = {0.0f, 1.0f, 0.0f};
    float sim = cosine_similarity(a.data(), b.data(), 3);
    EXPECT_NEAR(sim, 0.0f, kTol);
}

TEST(DistanceTest, CosineSimilarityOpposite) {
    std::vector<float> a = {1.0f, 0.0f};
    std::vector<float> b = {-1.0f, 0.0f};
    float sim = cosine_similarity(a.data(), b.data(), 2);
    EXPECT_NEAR(sim, -1.0f, kTol);
}

TEST(DistanceTest, CosineDistanceIdentical) {
    std::vector<float> a = {1.0f, 2.0f, 3.0f};
    float dist = cosine_distance(a.data(), a.data(), 3);
    EXPECT_NEAR(dist, 0.0f, kTol);
}

TEST(DistanceTest, CosineDistanceOrthogonal) {
    std::vector<float> a = {1.0f, 0.0f};
    std::vector<float> b = {0.0f, 1.0f};
    float dist = cosine_distance(a.data(), b.data(), 2);
    EXPECT_NEAR(dist, 1.0f, kTol);
}

// ── Euclidean distance ──────────────────────────────────────────────────────

TEST(DistanceTest, EuclideanIdentical) {
    std::vector<float> a = {3.0f, 4.0f};
    float dist = euclidean_distance(a.data(), a.data(), 2);
    EXPECT_NEAR(dist, 0.0f, kTol);
}

TEST(DistanceTest, EuclideanBasic) {
    std::vector<float> a = {0.0f, 0.0f};
    std::vector<float> b = {3.0f, 4.0f};
    float dist = euclidean_distance(a.data(), b.data(), 2);
    EXPECT_NEAR(dist, 5.0f, kTol);
}

TEST(DistanceTest, Euclidean3D) {
    std::vector<float> a = {1.0f, 2.0f, 3.0f};
    std::vector<float> b = {4.0f, 6.0f, 3.0f};
    float dist = euclidean_distance(a.data(), b.data(), 3);
    // sqrt((3)^2 + (4)^2 + 0^2) = 5
    EXPECT_NEAR(dist, 5.0f, kTol);
}

// ── Inner product distance ──────────────────────────────────────────────────

TEST(DistanceTest, InnerProductBasic) {
    std::vector<float> a = {1.0f, 2.0f, 3.0f};
    std::vector<float> b = {4.0f, 5.0f, 6.0f};
    // dot = 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
    float dist = inner_product_distance(a.data(), b.data(), 3);
    EXPECT_NEAR(dist, -32.0f, kTol);
}

TEST(DistanceTest, InnerProductSelf) {
    std::vector<float> a = {2.0f, 3.0f};
    // dot = 2*2 + 3*3 = 13
    float dist = inner_product_distance(a.data(), a.data(), 2);
    EXPECT_NEAR(dist, -13.0f, kTol);
}

// ── compute_distance dispatch ───────────────────────────────────────────────

TEST(DistanceTest, ComputeDistanceCosine) {
    std::vector<float> a = {1.0f, 0.0f};
    std::vector<float> b = {0.0f, 1.0f};
    float dist = compute_distance(a.data(), b.data(), 2, DistanceMetric::Cosine);
    EXPECT_NEAR(dist, 1.0f, kTol);
}

TEST(DistanceTest, ComputeDistanceEuclidean) {
    std::vector<float> a = {0.0f, 0.0f};
    std::vector<float> b = {3.0f, 4.0f};
    float dist = compute_distance(a.data(), b.data(), 2, DistanceMetric::Euclidean);
    EXPECT_NEAR(dist, 5.0f, kTol);
}

TEST(DistanceTest, ComputeDistanceInnerProduct) {
    std::vector<float> a = {1.0f, 2.0f};
    std::vector<float> b = {3.0f, 4.0f};
    float dist = compute_distance(a.data(), b.data(), 2, DistanceMetric::InnerProduct);
    // dot = 1*3 + 2*4 = 11
    EXPECT_NEAR(dist, -11.0f, kTol);
}

// ── Normalize ───────────────────────────────────────────────────────────────

TEST(DistanceTest, NormalizeInPlace) {
    std::vector<float> v = {3.0f, 4.0f};
    normalize(v.data(), 2);
    EXPECT_NEAR(v[0], 0.6f, kTol);
    EXPECT_NEAR(v[1], 0.8f, kTol);
}

TEST(DistanceTest, NormalizeReturnValue) {
    std::vector<float> v = {3.0f, 4.0f};
    auto n = normalized(v.data(), 2);
    EXPECT_NEAR(n[0], 0.6f, kTol);
    EXPECT_NEAR(n[1], 0.8f, kTol);
    // Original should be unchanged
    EXPECT_EQ(v[0], 3.0f);
    EXPECT_EQ(v[1], 4.0f);
}

TEST(DistanceTest, NormalizeZeroVector) {
    std::vector<float> v = {0.0f, 0.0f, 0.0f};
    normalize(v.data(), 3);
    // Should not produce NaN or inf
    for (auto x : v) {
        EXPECT_TRUE(std::isfinite(x));
    }
}

// ── Pairwise distances ──────────────────────────────────────────────────────

TEST(DistanceTest, PairwiseDistances) {
    // Two vectors in a, one vector in b
    std::vector<float> a = {1.0f, 0.0f, 0.0f, 1.0f};  // 2 x 2
    std::vector<float> b = {0.0f, 1.0f};                // 1 x 2

    auto dists = pairwise_distances(a.data(), b.data(), 2, 1, 2, DistanceMetric::Euclidean);
    ASSERT_EQ(dists.size(), 2u);
    // Both should be sqrt(2)
    EXPECT_NEAR(dists[0], std::sqrt(2.0f), kTol);
    EXPECT_NEAR(dists[1], std::sqrt(2.0f), kTol);
}
