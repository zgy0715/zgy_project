#include "engine/engine.h"

#include <algorithm>
#include <cstdint>
#include <mutex>
#include <shared_mutex>
#include <stdexcept>
#include <unordered_map>
#include <utility>

#include <nlohmann/json.hpp>

#include "embedding/code_embedder.h"
#include "hnsw/index_config.h"
#include "storage/vector_store.h"

namespace deepagent::vector_engine {

namespace {

using json = nlohmann::json;

/// Reserved keys used inside the JSON blob handed to VectorStore. Nesting the
/// caller's metadata under its own key means a user key can never collide with
/// the engine's own bookkeeping.
constexpr const char* kIdKey      = "__id";
constexpr const char* kContentKey = "__content";
constexpr const char* kMetaKey    = "__meta";

EmbedderBackend parse_backend(const std::string& name) {
    if (name.empty() || name == "dummy") return EmbedderBackend::Dummy;
    if (name == "onnx" || name == "onnxruntime") return EmbedderBackend::ONNXRuntime;
    if (name == "api" || name == "remote") return EmbedderBackend::API;
    throw std::invalid_argument("Unknown embedder backend: " + name +
                                " (expected 'dummy', 'onnx' or 'api')");
}

/// Parse a metadata payload that must be a JSON object.
json parse_metadata_object(const std::string& text) {
    if (text.empty()) return json::object();
    json parsed;
    try {
        parsed = json::parse(text);
    } catch (const json::exception& e) {
        throw std::invalid_argument(std::string("metadata is not valid JSON: ") + e.what());
    }
    if (!parsed.is_object()) {
        throw std::invalid_argument("metadata must be a JSON object");
    }
    return parsed;
}

/// Parse the optional filter argument: empty or "null" means "no filtering".
json parse_filters(const std::string& text) {
    if (text.empty() || text == "null") return json();
    json parsed;
    try {
        parsed = json::parse(text);
    } catch (const json::exception& e) {
        throw std::invalid_argument(std::string("filters is not valid JSON: ") + e.what());
    }
    if (!parsed.is_null() && !parsed.is_object()) {
        throw std::invalid_argument("filters must be a JSON object");
    }
    return parsed;
}

/// Every filter key must be present with an equal value in the metadata.
bool matches_filters(const json& metadata, const json& filters) {
    for (auto it = filters.begin(); it != filters.end(); ++it) {
        auto found = metadata.find(it.key());
        if (found == metadata.end() || *found != it.value()) {
            return false;
        }
    }
    return true;
}

} // namespace

// ── Engine::Impl ────────────────────────────────────────────────────────────

class Engine::Impl {
public:
    Impl(int embedding_dim, const std::string& backend)
        : dim_(embedding_dim)
    {
        if (dim_ <= 0) {
            throw std::invalid_argument("embedding_dim must be positive");
        }

        config_.dim         = dim_;
        config_.metric_type = MetricType::Cosine;

        EmbedderConfig embedder_config;
        embedder_config.dim     = dim_;
        embedder_config.backend = parse_backend(backend);
        embedder_ = std::make_unique<CodeEmbedder>(embedder_config);
    }

    std::vector<float> embed(const std::string& text) const {
        return embedder_->embed(text);
    }

    std::vector<std::vector<float>> embed_batch(const std::vector<std::string>& texts) const {
        return embedder_->embed_batch(texts);
    }

    std::size_t index(const std::vector<EngineDocument>& documents,
                      const std::string& collection) {
        if (documents.empty()) return 0;

        // Embed outside the lock: it is the expensive part and does not touch
        // the shared collection state.
        struct Prepared {
            const EngineDocument* doc = nullptr;
            std::vector<float>    vector;
            std::string           metadata;
        };

        std::vector<Prepared> prepared;
        prepared.reserve(documents.size());
        for (const auto& doc : documents) {
            Prepared item;
            item.doc      = &doc;
            item.vector   = embedder_->embed(doc.content);
            item.metadata = build_metadata(doc, doc.id);
            prepared.push_back(std::move(item));
        }

        std::unique_lock<std::shared_mutex> lock(stores_mutex_);
        VectorStore& store = get_or_create_locked(collection);
        auto& ids = id_maps_[collection];
        store.ensure_capacity(store.size() + prepared.size());

        std::size_t indexed = 0;
        for (auto& item : prepared) {
            const std::string& external = item.doc->id;
            auto existing = external.empty() ? ids.end() : ids.find(external);
            if (existing != ids.end()) {
                if (store.update(existing->second, item.vector, item.metadata)) {
                    ++indexed;
                }
                continue;
            }

            const int64_t internal = store.insert(item.vector, item.metadata);
            if (external.empty()) {
                // The caller did not supply an id, so use the freshly assigned
                // internal id as the stable external identifier.
                const std::string generated = std::to_string(internal);
                store.update(internal, item.vector, build_metadata(*item.doc, generated));
                ids.emplace(generated, internal);
            } else {
                ids.emplace(external, internal);
            }
            ++indexed;
        }
        return indexed;
    }

    std::vector<EngineHit> search(const std::string& query, std::size_t top_k,
                                  const std::string& collection,
                                  const std::string& filters_json) const {
        if (query.empty() || top_k == 0) return {};

        const std::vector<float> query_vector = embedder_->embed(query);
        VectorStore* store = find_store(collection);
        if (store == nullptr) return {};

        const json filters  = parse_filters(filters_json);
        const bool filtered = filters.is_object() && !filters.empty();

        // With filters the top_k nearest neighbours may all be filtered out,
        // so fetch a bounded superset before applying them.
        const std::size_t total = store->size();
        std::size_t fetch = top_k;
        if (filtered) {
            fetch = std::min(total, std::max<std::size_t>(top_k * 8, 64));
        } else {
            fetch = std::min(total, top_k);
        }

        std::vector<EngineHit> hits;
        for (auto& raw : store->search(query_vector, fetch)) {
            json stored;
            try {
                stored = json::parse(raw.metadata);
            } catch (const json::exception&) {
                stored = json::object();
            }

            json user_metadata = json::object();
            auto meta_it = stored.find(kMetaKey);
            if (meta_it != stored.end() && meta_it->is_object()) {
                user_metadata = *meta_it;
            }
            if (filtered && !matches_filters(user_metadata, filters)) {
                continue;
            }

            EngineHit hit;
            auto id_it = stored.find(kIdKey);
            hit.id = (id_it != stored.end() && id_it->is_string())
                         ? id_it->get<std::string>()
                         : std::to_string(raw.id);
            auto content_it = stored.find(kContentKey);
            hit.content  = (content_it != stored.end() && content_it->is_string())
                               ? content_it->get<std::string>()
                               : std::string();
            hit.metadata = user_metadata.dump();
            hit.distance = raw.distance;
            hit.score    = score_from_distance(raw.distance);

            hits.push_back(std::move(hit));
            if (hits.size() >= top_k) break;
        }
        return hits;
    }

    int dim() const { return dim_; }

    std::size_t collection_size(const std::string& collection) const {
        std::shared_lock<std::shared_mutex> lock(stores_mutex_);
        auto it = stores_.find(collection);
        if (it == stores_.end()) return 0;
        const VectorStore* store = it->second.get();
        lock.unlock();
        return store->size();
    }

    std::vector<std::string> collections() const {
        std::shared_lock<std::shared_mutex> lock(stores_mutex_);
        std::vector<std::string> names;
        names.reserve(stores_.size());
        for (const auto& entry : stores_) {
            names.push_back(entry.first);
        }
        return names;
    }

private:
    int                                          dim_;
    IndexConfig                                  config_;
    std::unique_ptr<CodeEmbedder>                 embedder_;

    /// Guards stores_ and id_maps_. Collections are only ever added, so a
    /// VectorStore* obtained under the lock stays valid after it is released.
    mutable std::shared_mutex                     stores_mutex_;
    std::unordered_map<std::string, std::unique_ptr<VectorStore>> stores_;
    std::unordered_map<std::string, std::unordered_map<std::string, int64_t>> id_maps_;

    /// Build the JSON blob stored alongside the vector. The external id is
    /// generated from the internal id when the caller did not supply one.
    std::string build_metadata(const EngineDocument& doc, const std::string& id) const {
        json obj = json::object();
        obj[kIdKey]      = id;
        obj[kContentKey] = doc.content;
        obj[kMetaKey]    = parse_metadata_object(doc.metadata);
        return obj.dump();
    }

    /// Caller must hold the unique lock (or be inside index()).
    VectorStore& get_or_create_locked(const std::string& collection) {
        auto& slot = stores_[collection];
        if (!slot) {
            slot = std::make_unique<VectorStore>(config_);
        }
        return *slot;
    }

    VectorStore* find_store(const std::string& collection) const {
        std::shared_lock<std::shared_mutex> lock(stores_mutex_);
        auto it = stores_.find(collection);
        return it == stores_.end() ? nullptr : it->second.get();
    }

    float score_from_distance(float distance) const {
        switch (config_.metric_type) {
            case MetricType::Cosine:       return 1.0f - distance;
            case MetricType::Euclidean:    return 1.0f / (1.0f + distance);
            case MetricType::InnerProduct: return -distance; // distance == -dot
        }
        return 1.0f - distance;
    }
};

// ── Engine forwarding ───────────────────────────────────────────────────────

Engine::Engine(int embedding_dim, const std::string& backend)
    : impl_(std::make_unique<Impl>(embedding_dim, backend)) {}

Engine::~Engine() = default;

Engine::Engine(Engine&&) noexcept = default;
Engine& Engine::operator=(Engine&&) noexcept = default;

std::vector<float> Engine::embed(const std::string& text) const {
    return impl_->embed(text);
}

std::vector<std::vector<float>> Engine::embed_batch(
    const std::vector<std::string>& texts) const {
    return impl_->embed_batch(texts);
}

std::size_t Engine::index(const std::vector<EngineDocument>& documents,
                          const std::string& collection) {
    return impl_->index(documents, collection);
}

std::vector<EngineHit> Engine::search(const std::string& query, std::size_t top_k,
                                      const std::string& collection,
                                      const std::string& filters_json) const {
    return impl_->search(query, top_k, collection, filters_json);
}

int Engine::dim() const {
    return impl_->dim();
}

std::size_t Engine::collection_size(const std::string& collection) const {
    return impl_->collection_size(collection);
}

std::vector<std::string> Engine::collections() const {
    return impl_->collections();
}

} // namespace deepagent::vector_engine
