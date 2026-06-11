#pragma once

#include <cstddef>
#include <vector>

namespace deepagent::vector_engine {

/// Supported distance metrics.
enum class DistanceMetric {
    Cosine,        ///< 1 - cos(a, b)
    Euclidean,     ///< L2 distance
    InnerProduct,  ///< Negative dot product
};

/// Compute the distance between two vectors.
/// @param a  Pointer to first vector (size dim)
/// @param b  Pointer to second vector (size dim)
/// @param dim  Dimensionality
/// @param metric  Distance metric to use
/// @return The computed distance
float compute_distance(const float* a, const float* b, std::size_t dim,
                       DistanceMetric metric = DistanceMetric::Cosine);

/// Compute cosine distance (1 - cosine_similarity).
float cosine_distance(const float* a, const float* b, std::size_t dim);

/// Compute Euclidean (L2) distance.
float euclidean_distance(const float* a, const float* b, std::size_t dim);

/// Compute inner product distance (negative dot product).
float inner_product_distance(const float* a, const float* b, std::size_t dim);

/// Compute cosine similarity (range [-1, 1]).
float cosine_similarity(const float* a, const float* b, std::size_t dim);

/// L2-normalize a vector in-place.
void normalize(float* v, std::size_t dim);

/// L2-normalize a vector, returning a new vector.
[[nodiscard]] std::vector<float> normalized(const float* v, std::size_t dim);

/// Compute pairwise distances between two sets of vectors.
/// @param a  Row-major matrix of size n x dim
/// @param b  Row-major matrix of size m x dim
/// @param n  Number of vectors in a
/// @param m  Number of vectors in b
/// @param dim  Dimensionality
/// @param metric  Distance metric
/// @return n x m distance matrix (row-major)
[[nodiscard]] std::vector<float> pairwise_distances(
    const float* a, const float* b,
    std::size_t n, std::size_t m, std::size_t dim,
    DistanceMetric metric = DistanceMetric::Cosine);

} // namespace deepagent::vector_engine
