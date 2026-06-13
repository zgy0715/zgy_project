#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/functional.h>

#include "hnsw/hnsw_index.h"
#include "hnsw/index_config.h"
#include "embedding/code_embedder.h"
#include "embedding/tokenizer.h"
#include "storage/vector_store.h"
#include "utils/distance.h"

namespace py = pybind11;
using namespace deepagent::vector_engine;

PYBIND11_MODULE(vector_engine, m) {
    m.doc() = "DeepAgent Vector Engine — HNSW-based approximate nearest neighbor search";

    // ── Enums ────────────────────────────────────────────────────────────
    py::enum_<MetricType>(m, "MetricType")
        .value("Cosine",       MetricType::Cosine)
        .value("Euclidean",    MetricType::Euclidean)
        .value("InnerProduct", MetricType::InnerProduct)
        .export_values();

    py::enum_<SplitStrategy>(m, "SplitStrategy")
        .value("ByFunction", SplitStrategy::ByFunction)
        .value("ByClass",    SplitStrategy::ByClass)
        .value("ByBlock",    SplitStrategy::ByBlock)
        .value("ByLine",     SplitStrategy::ByLine)
        .export_values();

    py::enum_<EmbedderBackend>(m, "EmbedderBackend")
        .value("Dummy",       EmbedderBackend::Dummy)
        .value("ONNXRuntime", EmbedderBackend::ONNXRuntime)
        .value("API",         EmbedderBackend::API)
        .export_values();

    py::enum_<DistanceMetric>(m, "DistanceMetric")
        .value("Cosine",       DistanceMetric::Cosine)
        .value("Euclidean",    DistanceMetric::Euclidean)
        .value("InnerProduct", DistanceMetric::InnerProduct)
        .export_values();

    // ── IndexConfig ──────────────────────────────────────────────────────
    py::class_<IndexConfig>(m, "IndexConfig")
        .def(py::init<>())
        .def_readwrite("M",               &IndexConfig::M)
        .def_readwrite("ef_construction",  &IndexConfig::ef_construction)
        .def_readwrite("ef_search",        &IndexConfig::ef_search)
        .def_readwrite("max_elements",     &IndexConfig::max_elements)
        .def_readwrite("metric_type",      &IndexConfig::metric_type)
        .def_readwrite("dim",              &IndexConfig::dim)
        .def_readwrite("seed",             &IndexConfig::seed)
        .def("to_json",   &IndexConfig::to_json)
        .def_static("from_json", &IndexConfig::from_json);

    // ── SearchResult ─────────────────────────────────────────────────────
    py::class_<SearchResult>(m, "SearchResult")
        .def_readonly("id",       &SearchResult::id)
        .def_readonly("distance", &SearchResult::distance)
        .def("__repr__", [](const SearchResult& r) {
            return "SearchResult(id=" + std::to_string(r.id) +
                   ", distance=" + std::to_string(r.distance) + ")";
        });

    // ── HNSWIndex ────────────────────────────────────────────────────────
    py::class_<HNSWIndex>(m, "HNSWIndex")
        .def(py::init<const IndexConfig&>(), py::arg("config"))
        .def("build", [](HNSWIndex& idx, const std::vector<float>& data,
                         std::size_t num_vectors, int dim) {
            idx.build(data.data(), num_vectors, dim);
        }, py::arg("data"), py::arg("num_vectors"), py::arg("dim"))
        .def("insert", [](HNSWIndex& idx, const std::vector<float>& vec,
                          std::optional<int64_t> id) {
            return idx.insert(vec.data(), id);
        }, py::arg("vector"), py::arg("id") = std::nullopt)
        .def("batch_insert", [](HNSWIndex& idx, const std::vector<float>& data,
                                std::size_t num_vectors, int64_t start_id) {
            idx.batch_insert(data.data(), num_vectors, start_id);
        }, py::arg("data"), py::arg("num_vectors"), py::arg("start_id") = 0)
        .def("search", [](HNSWIndex& idx, const std::vector<float>& query,
                          std::size_t k) {
            return idx.search(query.data(), k);
        }, py::arg("query"), py::arg("k"))
        .def("search_with_ef", [](HNSWIndex& idx, const std::vector<float>& query,
                                  std::size_t k, int ef) {
            return idx.search(query.data(), k, ef);
        }, py::arg("query"), py::arg("k"), py::arg("ef"))
        .def("save",    &HNSWIndex::save,    py::arg("path"))
        .def("load",    &HNSWIndex::load,    py::arg("path"))
        .def("size",    &HNSWIndex::size)
        .def("capacity",&HNSWIndex::capacity)
        .def("config",  &HNSWIndex::config, py::return_value_policy::reference)
        .def("resize",  &HNSWIndex::resize, py::arg("new_max_elements"));

    // ── CodeToken ────────────────────────────────────────────────────────
    py::class_<CodeToken>(m, "CodeToken")
        .def_readonly("text",       &CodeToken::text)
        .def_readonly("language",   &CodeToken::language)
        .def_readonly("start_line", &CodeToken::start_line)
        .def_readonly("end_line",   &CodeToken::end_line)
        .def_readonly("name",       &CodeToken::name)
        .def("__repr__", [](const CodeToken& t) {
            return "CodeToken(name='" + t.name + "', lines=" +
                   std::to_string(t.start_line) + "-" +
                   std::to_string(t.end_line) + ")";
        });

    // ── EmbedderConfig ───────────────────────────────────────────────────
    py::class_<EmbedderConfig>(m, "EmbedderConfig")
        .def(py::init<>())
        .def_readwrite("backend",       &EmbedderConfig::backend)
        .def_readwrite("dim",           &EmbedderConfig::dim)
        .def_readwrite("model_path",    &EmbedderConfig::model_path)
        .def_readwrite("api_endpoint",  &EmbedderConfig::api_endpoint)
        .def_readwrite("split_strategy",&EmbedderConfig::split_strategy);

    // ── CodeEmbedder ─────────────────────────────────────────────────────
    py::class_<CodeEmbedder>(m, "CodeEmbedder")
        .def(py::init<const EmbedderConfig&>(), py::arg("config"))
        .def("embed",      &CodeEmbedder::embed, py::arg("text"))
        .def("embed_batch", &CodeEmbedder::embed_batch, py::arg("texts"))
        .def("embed_code", &CodeEmbedder::embed_code,
             py::arg("source"), py::arg("language") = "cpp")
        .def("dim",    &CodeEmbedder::dim)
        .def("config", &CodeEmbedder::config, py::return_value_policy::reference);

    // ── VectorRecord ─────────────────────────────────────────────────────
    py::class_<VectorRecord>(m, "VectorRecord")
        .def_readonly("id",       &VectorRecord::id)
        .def_readonly("vector",   &VectorRecord::vector)
        .def_readonly("metadata", &VectorRecord::metadata)
        .def("__repr__", [](const VectorRecord& r) {
            return "VectorRecord(id=" + std::to_string(r.id) +
                   ", dim=" + std::to_string(r.vector.size()) + ")";
        });

    // ── SearchHit ────────────────────────────────────────────────────────
    py::class_<VectorStore::SearchHit>(m, "SearchHit")
        .def_readonly("id",       &VectorStore::SearchHit::id)
        .def_readonly("distance", &VectorStore::SearchHit::distance)
        .def_readonly("metadata", &VectorStore::SearchHit::metadata)
        .def("__repr__", [](const VectorStore::SearchHit& h) {
            return "SearchHit(id=" + std::to_string(h.id) +
                   ", distance=" + std::to_string(h.distance) + ")";
        });

    // ── VectorStore ──────────────────────────────────────────────────────
    py::class_<VectorStore>(m, "VectorStore")
        .def(py::init<const IndexConfig&>(), py::arg("config"))
        .def("insert",       &VectorStore::insert,
             py::arg("vector"), py::arg("metadata") = "{}")
        .def("batch_insert", &VectorStore::batch_insert, py::arg("records"))
        .def("update",       &VectorStore::update,
             py::arg("id"), py::arg("vector"), py::arg("metadata") = "{}")
        .def("remove",       &VectorStore::remove, py::arg("id"))
        .def("get",          &VectorStore::get,    py::arg("id"))
        .def("search",       py::overload_cast<const std::vector<float>&, std::size_t>(
             &VectorStore::search, py::const_),
             py::arg("query"), py::arg("k"))
        .def("search_with_ef", [](const VectorStore& store,
                                  const std::vector<float>& query,
                                  std::size_t k, int ef) {
            return store.search(query, k, ef);
        }, py::arg("query"), py::arg("k"), py::arg("ef"))
        .def("save",     &VectorStore::save,     py::arg("directory"))
        .def("load",     &VectorStore::load,     py::arg("directory"))
        .def("size",     &VectorStore::size)
        .def("capacity", &VectorStore::capacity)
        .def("config",   &VectorStore::config, py::return_value_policy::reference);

    // ── Distance utilities ───────────────────────────────────────────────
    m.def("cosine_distance", [](const std::vector<float>& a,
                                const std::vector<float>& b) {
        return cosine_distance(a.data(), b.data(), a.size());
    }, py::arg("a"), py::arg("b"));

    m.def("euclidean_distance", [](const std::vector<float>& a,
                                   const std::vector<float>& b) {
        return euclidean_distance(a.data(), b.data(), a.size());
    }, py::arg("a"), py::arg("b"));

    m.def("inner_product_distance", [](const std::vector<float>& a,
                                       const std::vector<float>& b) {
        return inner_product_distance(a.data(), b.data(), a.size());
    }, py::arg("a"), py::arg("b"));

    m.def("cosine_similarity", [](const std::vector<float>& a,
                                  const std::vector<float>& b) {
        return cosine_similarity(a.data(), b.data(), a.size());
    }, py::arg("a"), py::arg("b"));

    m.def("normalize", [](const std::vector<float>& v) {
        return normalized(v.data(), v.size());
    }, py::arg("vector"));

    // ── Version ──────────────────────────────────────────────────────────
    m.attr("__version__") = "0.1.0";
}
