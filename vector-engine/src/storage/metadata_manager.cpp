#include "storage/metadata_manager.h"

#include <fstream>
#include <nlohmann/json.hpp>

namespace deepagent::vector_engine {

using json = nlohmann::json;

MetadataManager::MetadataManager(std::size_t reserve_capacity) {
    store_.reserve(reserve_capacity);
}

void MetadataManager::put(int64_t id, const std::string& metadata) {
    store_[id] = metadata;
}

std::optional<std::string> MetadataManager::get(int64_t id) const {
    auto it = store_.find(id);
    if (it == store_.end()) return std::nullopt;
    return it->second;
}

bool MetadataManager::exists(int64_t id) const {
    return store_.find(id) != store_.end();
}

bool MetadataManager::remove(int64_t id) {
    return store_.erase(id) > 0;
}

std::vector<int64_t> MetadataManager::all_ids() const {
    std::vector<int64_t> ids;
    ids.reserve(store_.size());
    for (const auto& [id, _] : store_) {
        ids.push_back(id);
    }
    return ids;
}

std::size_t MetadataManager::size() const {
    return store_.size();
}

void MetadataManager::clear() {
    store_.clear();
}

void MetadataManager::save(const std::string& path) const {
    json j = json::object();
    for (const auto& [id, meta] : store_) {
        j[std::to_string(id)] = json::parse(meta);
    }

    std::ofstream ofs(path);
    if (!ofs) {
        throw std::runtime_error("Cannot open file for writing: " + path);
    }
    ofs << j.dump(2);
}

void MetadataManager::load(const std::string& path) {
    std::ifstream ifs(path);
    if (!ifs) {
        throw std::runtime_error("Cannot open file for reading: " + path);
    }

    json j;
    ifs >> j;

    store_.clear();
    for (auto it = j.begin(); it != j.end(); ++it) {
        int64_t id = std::stoll(it.key());
        store_[id] = it.value().dump();
    }
}

} // namespace deepagent::vector_engine
