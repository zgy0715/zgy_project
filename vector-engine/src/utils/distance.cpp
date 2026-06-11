#include "utils/distance.h"

#include <cmath>
#include <numeric>
#include <stdexcept>

namespace deepagent::vector_engine {

float compute_distance(const float* a, const float* b, std::size_t dim,
                       DistanceMetric metric)
{
    switch (metric) {
        case DistanceMetric::Cosine:       return cosine_distance(a, b, dim);
        case DistanceMetric::Euclidean:    return euclidean_distance(a, b, dim);
        case DistanceMetric::InnerProduct: return inner_product_distance(a, b, dim);
    }
    return cosine_distance(a, b, dim);
}

float cosine_similarity(const float* a, const float* b, std::size_t dim) {
    float dot   = 0.0f;
    float norm_a = 0.0f;
    float norm_b = 0.0f;

    for (std::size_t i = 0; i < dim; ++i) {
        dot    += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    auto denom = std::sqrt(norm_a) * std::sqrt(norm_b);
    if (denom < 1e-12f) return 0.0f;
    return dot / denom;
}

float cosine_distance(const float* a, const float* b, std::size_t dim) {
    return 1.0f - cosine_similarity(a, b, dim);
}

float euclidean_distance(const float* a, const float* b, std::size_t dim) {
    float sum = 0.0f;
    for (std::size_t i = 0; i < dim; ++i) {
        float d = a[i] - b[i];
        sum += d * d;
    }
    return std::sqrt(sum);
}

float inner_product_distance(const float* a, const float* b, std::size_t dim) {
    float dot = 0.0f;
    for (std::size_t i = 0; i < dim; ++i) {
        dot += a[i] * b[i];
    }
    return -dot;
}

void normalize(float* v, std::size_t dim) {
    float norm = std::sqrt(std::inner_product(v, v + dim, v, 0.0f));
    if (norm < 1e-12f) return;
    for (std::size_t i = 0; i < dim; ++i) {
        v[i] /= norm;
    }
}

std::vector<float> normalized(const float* v, std::size_t dim) {
    std::vector<float> result(v, v + dim);
    normalize(result.data(), dim);
    return result;
}

std::vector<float> pairwise_distances(
    const float* a, const float* b,
    std::size_t n, std::size_t m, std::size_t dim,
    DistanceMetric metric)
{
    std::vector<float> dists(n * m);
    for (std::size_t i = 0; i < n; ++i) {
        for (std::size_t j = 0; j < m; ++j) {
            dists[i * m + j] = compute_distance(
                a + i * dim, b + j * dim, dim, metric);
        }
    }
    return dists;
}

} // namespace deepagent::vector_engine
