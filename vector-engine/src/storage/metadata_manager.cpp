#include "storage/metadata_manager.h"

#include <filesystem>
#include <fstream>
#include <nlohmann/json.hpp>
#include <stdexcept>

namespace deepagent::vector_engine {

using json = nlohmann::json;

namespace {

/// Parse a metadata payload leniently: anything that is not valid JSON is
/// stored as a JSON string instead of aborting the whole save.
json parse_metadata(const std::string& metadata) {
    if (metadata.empty()) {
        return json::object();
    }
    try {
        return json::parse(metadata);
    } catch (const json::exception&) {
        return json(metadata);
    }
}

/// Parse an id key; returns false for non-numeric keys (e.g. future format
/// markers) so a load can skip them instead of throwing.
bool parse_id(const std::string& key, int64_t& id) {
    try {
        std::size_t consumed = 0;
        id = std::stoll(key, &consumed);
        return consumed == key.size();
    } catch (const std::exception&) {
        return false;
    }
}

} // namespace

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
    for (const auto& entry : store_) {
        ids.push_back(entry.first);
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
    for (const auto& entry : store_) {
        j[std::to_string(entry.first)] = parse_metadata(entry.second);
    }

    // Write to a temporary file and rename it into place, so a failure cannot
    // leave a truncated/empty metadata file behind.
    const std::string tmp_path = path + ".tmp";
    {
        std::ofstream ofs(tmp_path, std::ios::binary | std::ios::trunc);
        if (!ofs) {
            throw std::runtime_error("Cannot open file for writing: " + tmp_path);
        }
        ofs << j.dump(2);
        ofs.flush();
        if (!ofs) {
            throw std::runtime_error("Failed to write metadata file: " + tmp_path);
        }
    }

    std::error_code ec;
    std::filesystem::rename(tmp_path, path, ec);
    if (ec) {
        std::filesystem::remove(tmp_path, ec);
        throw std::runtime_error("Failed to replace metadata file: " + path);
    }
}

void MetadataManager::load(const std::string& path) {
    std::ifstream ifs(path, std::ios::binary);
    if (!ifs) {
        throw std::runtime_error("Cannot open file for reading: " + path);
    }

    json j;
    try {
        ifs >> j;
    } catch (const json::exception& e) {
        throw std::runtime_error("Corrupt metadata file '" + path + "': " + e.what());
    }
    if (!j.is_object()) {
        throw std::runtime_error("Corrupt metadata file '" + path + "': expected a JSON object");
    }

    // Build the new state first so a parse failure leaves the old state intact.
    std::unordered_map<int64_t, std::string> loaded;
    loaded.reserve(j.size());
    for (auto it = j.begin(); it != j.end(); ++it) {
        int64_t id = 0;
        if (!parse_id(it.key(), id)) {
            continue; // skip non-numeric keys
        }
        loaded[id] = it.value().dump();
    }
    store_.swap(loaded);
}

} // namespace deepagent::vector_engine
