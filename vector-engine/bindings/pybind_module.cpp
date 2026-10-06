#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/functional.h>

#include <cstddef>
#include <stdexcept>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "engine/engine.h"
#include "hnsw/hnsw_index.h"
#include "hnsw/index_config.h"
#include "embedding/code_embedder.h"
#include "embedding/tokenizer.h"
#include "storage/vector_store.h"
#include "utils/distance.h"

namespace py = pybind11;
using namespace deepagent::vector_engine;

namespace {

using json = nlohmann::json;

/// Nesting guard for the hand written Python <-> JSON converter, so a
/// self-referential container cannot blow the C++ stack.
constexpr int kMaxDepth = 32;

json from_python(const py::handle& value, int depth);

/// Convert a Python key/value container into JSON. Only the types that can be
/// represented in JSON are accepted; anything else raises a TypeError.
json from_python(const py::handle& value, int depth) {
    if (depth > kMaxDepth) {
        throw py::value_error("value is nested too deeply to convert to JSON");
    }
    if (value.is_none()) {
        return json();
    }
    if (py::isinstance<py::bool_>(value)) {
        return py::cast<bool>(value);
    }
    if (py::isinstance<py::int_>(value)) {
        return py::cast<int64_t>(value);
    }
    if (py::isinstance<py::float_>(value)) {
        return py::cast<double>(value);
    }
    if (py::isinstance<py::str>(value)) {
        return py::cast<std::string>(value);
    }
    if (py::isinstance<py::list>(value) || py::isinstance<py::tuple>(value)) {
        json array = json::array();
        for (auto item : value) {
            array.push_back(from_python(item, depth + 1));
        }
        return array;
    }
    if (py::isinstance<py::dict>(value)) {
        json object = json::object();
        py::object items = py::reinterpret_borrow<py::object>(value).attr("items")();
        for (auto entry : items) {
            py::tuple pair = py::reinterpret_borrow<py::tuple>(entry);
            if (!py::isinstance<py::str>(pair[0])) {
                throw py::type_error("metadata keys must be strings");
            }
            object[pair[0].cast<std::string>()] = from_python(pair[1], depth + 1);
        }
        return object;
    }
    throw py::type_error("unsupported value type in metadata: " +
                         py::cast<std::string>(py::str(py::type::of(value))));
}

/// Convert JSON back into Python objects (dicts for objects, lists for arrays).
py::object to_python(const json& value) {
    switch (value.type()) {
        case json::value_t::null:            return py::none();
        case json::value_t::boolean:         return py::bool_(value.get<bool>());
        case json::value_t::number_integer:
        case json::value_t::number_unsigned: return py::int_(value.get<int64_t>());
        case json::value_t::number_float:    return py::float_(value.get<double>());
        case json::value_t::string:          return py::str(value.get<std::string>());
        case json::value_t::array: {
            py::list list;
            for (const auto& item : value) {
                list.append(to_python(item));
            }
            return list;
        }
        case json::value_t::object: {
            py::dict dict;
            for (auto it = value.begin(); it != value.end(); ++it) {
                dict[py::str(it.key())] = to_python(it.value());
            }
            return dict;
        }
        default: break;
    }
    return py::none();
}

/// Parse a metadata JSON string into a dict, falling back to an empty dict.
py::dict metadata_to_dict(const std::string& text) {
    if (text.empty()) {
        return py::dict();
    }
    try {
        py::object parsed = to_python(json::parse(text));
        if (py::isinstance<py::dict>(parsed)) {
            return py::reinterpret_borrow<py::dict>(parsed);
        }
    } catch (const std::exception&) {
        // Fall through to an empty dict: corrupted metadata never breaks a search.
    }
    return py::dict();
}

/// Build the Python representation of a search result, matching the contract
/// the Python service expects: {"id", "content", "metadata", "score", "distance"}.
py::list hits_to_list(const std::vector<EngineHit>& hits) {
    py::list out;
    for (const auto& hit : hits) {
        py::dict entry;
        entry["id"]       = py::str(hit.id);
        entry["content"]  = py::str(hit.content);
        entry["metadata"] = metadata_to_dict(hit.metadata);
        entry["score"]    = py::float_(hit.score);
        entry["distance"] = py::float_(hit.distance);
        out.append(entry);
    }
    return out;
}

/// Convert one Python document dict into an EngineDocument.
EngineDocument document_from_dict(const py::handle& item) {
    if (!py::isinstance<py::dict>(item)) {
        throw py::type_error("each document must be a dict");
    }
    py::dict dict = py::reinterpret_borrow<py::dict>(item);

    EngineDocument document;
    py::object id = dict.attr("get")(py::str("id"));
    if (!id.is_none()) {
        document.id = py::cast<std::string>(id);
    }
    py::object content = dict.attr("get")(py::str("content"));
    if (!content.is_none()) {
        document.content = py::cast<std::string>(content);
    }
    py::object metadata = dict.attr("get")(py::str("metadata"));
    if (!metadata.is_none()) {
        document.metadata = from_python(metadata, 0).dump();
    }
    return document;
}

/// Turn the optional filters argument into a JSON string ("{}"/"" means none).
std::string filters_to_json(const py::handle& filters) {
    if (filters.is_none()) {
        return std::string();
    }
    json parsed = from_python(filters, 0);
    if (!parsed.is_object()) {
        throw py::type_error("filters must be a dict");
    }
    return parsed.dump();
}

/// Reject buffers that are too short before handing them to C++ code that
/// indexes them, so a wrong length can never become an out of bounds read.
void require_buffer(const std::vector<float>& data, std::size_t num_vectors, int dim) {
    if (dim <= 0 || num_vectors == 0) {
        throw py::value_error("num_vectors and dim must be positive");
    }
    const std::size_t needed = num_vectors * static_cast<std::size_t>(dim);
    if (data.size() < needed) {
        throw py::value_error("data is too short: expected at least " +
                              std::to_string(needed) + " floats, got " +
                              std::to_string(data.size()));
    }
}

void require_same_size(const std::vector<float>& a, const std::vector<float>& b) {
    if (a.size() != b.size()) {
        throw py::value_error("vectors must have the same length (" +
                              std::to_string(a.size()) + " != " +
                              std::to_string(b.size()) + ")");
    }
    if (a.empty()) {
        throw py::value_error("vectors must not be empty");
    }
}

/// Reject vectors whose length does not match the index dimension. The C++
/// entry points take a raw pointer and cannot know the caller's length, so a
/// short Python list would otherwise be read out of bounds.
void require_dim(const std::vector<float>& vector, int expected, const char* what) {
    if (vector.size() != static_cast<std::size_t>(expected)) {
        throw py::value_error(std::string(what) + " must have " +
                              std::to_string(expected) + " elements, got " +
                              std::to_string(vector.size()));
    }
}

} // namespace

PYBIND11_MODULE(vector_engine, m) {
    m.doc() = "DeepAgent Vector Engine — HNSW-based approximate nearest neighbor search";

    // ── Enums ────────────────────────────────────────────────────────────
    // No export_values(): several enums share value names (Cosine, ...) and
    // exporting them all at module level would silently shadow each other.
    py::enum_<MetricType>(m, "MetricType")
        .value("Cosine",       MetricType::Cosine)
        .value("Euclidean",    MetricType::Euclidean)
        .value("InnerProduct", MetricType::InnerProduct);

    py::enum_<SplitStrategy>(m, "SplitStrategy")
        .value("ByFunction", SplitStrategy::ByFunction)
        .value("ByClass",    SplitStrategy::ByClass)
        .value("ByBlock",    SplitStrategy::ByBlock)
        .value("ByLine",     SplitStrategy::ByLine);

    py::enum_<EmbedderBackend>(m, "EmbedderBackend")
        .value("Dummy",       EmbedderBackend::Dummy)
        .value("ONNXRuntime", EmbedderBackend::ONNXRuntime)
        .value("API",         EmbedderBackend::API);

    py::enum_<DistanceMetric>(m, "DistanceMetric")
        .value("Cosine",       DistanceMetric::Cosine)
        .value("Euclidean",    DistanceMetric::Euclidean)
        .value("InnerProduct", DistanceMetric::InnerProduct);

    // ── IndexConfig ──────────────────────────────────────────────────────
    py::class_<IndexConfig>(m, "IndexConfig")
        .def(py::init<>())
        .def_readwrite("M",                &IndexConfig::M)
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
        .def(py::init<const std::string&, const IndexConfig&>(),
             py::arg("path"), py::arg("config"),
             "Load an index from a saved file with the given configuration")
        .def("build", [](HNSWIndex& idx, const std::vector<float>& data,
                         std::size_t num_vectors, int dim) {
            require_buffer(data, num_vectors, dim);
            idx.build(data.data(), num_vectors, dim);
        }, py::arg("data"), py::arg("num_vectors"), py::arg("dim"))
        .def("insert", [](HNSWIndex& idx, const std::vector<float>& vec,
                          std::optional<int64_t> id) {
            require_dim(vec, idx.config().dim, "vector");
            return idx.insert(vec.data(), id);
        }, py::arg("vector"), py::arg("id") = std::nullopt)
        .def("batch_insert", [](HNSWIndex& idx, const std::vector<float>& data,
                                std::size_t num_vectors, int64_t start_id) {
            require_buffer(data, num_vectors, idx.config().dim);
            idx.batch_insert(data.data(), num_vectors, start_id);
        }, py::arg("data"), py::arg("num_vectors"), py::arg("start_id") = 0)
        .def("search", [](HNSWIndex& idx, const std::vector<float>& query,
                          std::size_t k) {
            require_dim(query, idx.config().dim, "query");
            return idx.search(query.data(), k);
        }, py::arg("query"), py::arg("k"))
        .def("search_with_ef", [](HNSWIndex& idx, const std::vector<float>& query,
                                  std::size_t k, int ef) {
            require_dim(query, idx.config().dim, "query");
            return idx.search(query.data(), k, ef);
        }, py::arg("query"), py::arg("k"), py::arg("ef"))
        .def("save",     &HNSWIndex::save,     py::arg("path"))
        .def("load",     &HNSWIndex::load,     py::arg("path"))
        .def("size",     &HNSWIndex::size)
        .def("capacity", &HNSWIndex::capacity)
        .def("config",   &HNSWIndex::config, py::return_value_policy::reference)
        .def("resize",   &HNSWIndex::resize, py::arg("new_max_elements"));

    // ── CodeToken ────────────────────────────────────────────────────────
    py::class_<CodeToken>(m, "CodeToken")
        .def_readonly("text",       &CodeToken::text)
        .def_readonly("language",   &CodeToken::language)
        .def_readonly("start_line", &CodeToken::start_line)
        .def_readonly("end_line",   &CodeToken::end_line)
        .def_readonly("name",       &CodeToken::name)
        .def("__repr__", [](const CodeToken& t) {
            return "CodeToken(name=" + t.name + ", lines=" +
                   std::to_string(t.start_line) + "-" + std::to_string(t.end_line) + ")";
        });

    // ── Tokenizer ────────────────────────────────────────────────────────
    py::class_<Tokenizer>(m, "Tokenizer")
        .def(py::init<SplitStrategy>(), py::arg("strategy") = SplitStrategy::ByFunction)
        .def("tokenize", &Tokenizer::tokenize, py::arg("code"), py::arg("language") = "cpp")
        .def("strategy", &Tokenizer::strategy)
        .def("set_strategy", &Tokenizer::set_strategy, py::arg("strategy"));

    // ── EmbedderConfig ───────────────────────────────────────────────────
    py::class_<EmbedderConfig>(m, "EmbedderConfig")
        .def(py::init<>())
        .def_readwrite("backend",        &EmbedderConfig::backend)
        .def_readwrite("dim",            &EmbedderConfig::dim)
        .def_readwrite("model_path",     &EmbedderConfig::model_path)
        .def_readwrite("api_endpoint",   &EmbedderConfig::api_endpoint)
        .def_readwrite("split_strategy", &EmbedderConfig::split_strategy);

    // ── CodeEmbedder ─────────────────────────────────────────────────────
    py::class_<CodeEmbedder>(m, "CodeEmbedder")
        .def(py::init<const EmbedderConfig&>(), py::arg("config"))
        .def("embed",       &CodeEmbedder::embed,       py::arg("text"))
        .def("embed_batch", &CodeEmbedder::embed_batch, py::arg("texts"))
        .def("embed_code",  &CodeEmbedder::embed_code,
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
        .def(py::init<const std::string&>(), py::arg("directory"),
             "Open a store previously written with save(directory)")
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
        .def("ensure_capacity", &VectorStore::ensure_capacity, py::arg("required"))
        .def("save",     &VectorStore::save,     py::arg("directory"))
        .def("load",     &VectorStore::load,     py::arg("directory"))
        .def("size",     &VectorStore::size)
        .def("capacity", &VectorStore::capacity)
        .def("config",   &VectorStore::config, py::return_value_policy::reference);

    // ── Engine (the surface the Python service imports) ──────────────────
    py::class_<Engine>(m, "Engine", "High level embedding + vector search facade")
        .def(py::init<int, const std::string&>(),
             py::arg("embedding_dim"), py::arg("backend") = "dummy")
        .def("embed", &Engine::embed, py::arg("text"),
             "Embed a single text into a list of floats")
        .def("embed_batch", &Engine::embed_batch, py::arg("texts"),
             "Embed a batch of texts into a list of lists of floats")
        .def("index", [](Engine& self, py::sequence documents,
                         const std::string& collection) {
            std::vector<EngineDocument> docs;
            docs.reserve(static_cast<std::size_t>(py::len(documents)));
            for (auto item : documents) {
                docs.push_back(document_from_dict(item));
            }
            return self.index(docs, collection);
        }, py::arg("documents"), py::arg("collection"),
             "Index documents (list of dicts with 'id', 'content', 'metadata')")
        .def("search", [](const Engine& self, const std::string& query,
                          std::size_t top_k, const std::string& collection,
                          py::object filters) {
            return hits_to_list(self.search(query, top_k, collection,
                                            filters_to_json(filters)));
        }, py::arg("query"), py::arg("top_k") = 10,
           py::arg("collection") = "default", py::arg("filters") = py::none(),
           "Search a collection; returns a list of "
           "{'id','content','metadata','score','distance'}")
        .def("dim", &Engine::dim)
        .def("collection_size", &Engine::collection_size, py::arg("collection"))
        .def("collections", &Engine::collections);

    // ── Distance utilities ───────────────────────────────────────────────
    m.def("cosine_distance", [](const std::vector<float>& a,
                                const std::vector<float>& b) {
        require_same_size(a, b);
        return cosine_distance(a.data(), b.data(), a.size());
    }, py::arg("a"), py::arg("b"));

    m.def("euclidean_distance", [](const std::vector<float>& a,
                                   const std::vector<float>& b) {
        require_same_size(a, b);
        return euclidean_distance(a.data(), b.data(), a.size());
    }, py::arg("a"), py::arg("b"));

    m.def("inner_product_distance", [](const std::vector<float>& a,
                                       const std::vector<float>& b) {
        require_same_size(a, b);
        return inner_product_distance(a.data(), b.data(), a.size());
    }, py::arg("a"), py::arg("b"));

    m.def("cosine_similarity", [](const std::vector<float>& a,
                                  const std::vector<float>& b) {
        require_same_size(a, b);
        return cosine_similarity(a.data(), b.data(), a.size());
    }, py::arg("a"), py::arg("b"));

    m.def("normalize", [](const std::vector<float>& v) {
        return normalized(v.data(), v.size()); // returns a new vector
    }, py::arg("vector"));

    // ── Version ──────────────────────────────────────────────────────────
    m.attr("__version__") = "0.1.0";
}
