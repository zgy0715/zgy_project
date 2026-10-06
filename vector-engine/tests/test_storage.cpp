#include <gtest/gtest.h>

#include <cstdint>
#include <filesystem>
#include <fstream>
#include <stdexcept>
#include <string>
#include <system_error>
#include <vector>

#include <nlohmann/json.hpp>

#include "hnsw/hnsw_index.h"
#include "storage/vector_store.h"

namespace fs = std::filesystem;

using deepagent::vector_engine::HNSWIndex;
using deepagent::vector_engine::IndexConfig;
using deepagent::vector_engine::MetricType;
using deepagent::vector_engine::VectorStore;

namespace {

IndexConfig small_config(std::size_t max_elements = 64, int dim = 4) {
    IndexConfig config;
    config.dim               = dim;
    config.max_elements      = max_elements;
    config.M                 = 8;
    config.ef_construction   = 50;
    config.ef_search         = 20;
    config.metric_type       = MetricType::Cosine;
    return config;
}

std::vector<float> vec4(float a, float b, float c, float d) {
    return {a, b, c, d};
}

/// Per-test scratch directory, removed again on destruction.
class TempDir {
public:
    TempDir() {
        static int counter = 0;
        const ::testing::TestInfo* info =
            ::testing::UnitTest::GetInstance()->current_test_info();
        const std::string name = info != nullptr ? info->name() : "case";
        path_ = fs::temp_directory_path() /
                ("vector_engine_store_" + name + "_" + std::to_string(counter++));
        std::error_code ec;
        fs::remove_all(path_, ec);
        fs::create_directories(path_, ec);
    }

    ~TempDir() {
        std::error_code ec;
        fs::remove_all(path_, ec);
    }

    const fs::path& path() const { return path_; }
    std::string str() const { return path_.string(); }

private:
    fs::path path_;
};

} // namespace

// ── VectorStore persistence ─────────────────────────────────────────────────

TEST(VectorStorePersistence, SavesAndLoadsVectorsAndMetadata) {
    TempDir dir;
    {
        VectorStore store(small_config());
        store.insert(vec4(1.0f, 0.0f, 0.0f, 0.0f), R"({"name":"a"})");
        store.insert(vec4(0.0f, 1.0f, 0.0f, 0.0f), R"({"name":"b"})");
        store.insert(vec4(0.0f, 0.0f, 1.0f, 0.0f), R"({"name":"c"})");
        store.save(dir.str());
    }

    // The 1-argument constructor restores dim / metric from the sidecar.
    VectorStore loaded(dir.str());
    ASSERT_EQ(loaded.size(), 3u);

    auto record = loaded.get(1);
    ASSERT_TRUE(record.has_value());
    EXPECT_EQ(nlohmann::json::parse(record->metadata), nlohmann::json::parse(R"({"name":"b"})"));
    ASSERT_EQ(record->vector.size(), 4u);
    EXPECT_NEAR(record->vector[1], 1.0f, 1e-6f);

    const auto hits = loaded.search(vec4(0.0f, 0.0f, 1.0f, 0.0f), 1);
    ASSERT_EQ(hits.size(), 1u);
    EXPECT_EQ(hits[0].id, 2);
    EXPECT_NEAR(hits[0].distance, 0.0f, 1e-3f);
    EXPECT_EQ(nlohmann::json::parse(hits[0].metadata), nlohmann::json::parse(R"({"name":"c"})"));
}

TEST(VectorStorePersistence, MissingVectorsFileKeepsMetadataAndSearch) {
    TempDir dir;
    {
        VectorStore store(small_config());
        store.insert(vec4(1.0f, 0.0f, 0.0f, 0.0f), R"({"name":"a"})");
        store.save(dir.str());
    }

    std::error_code ec;
    fs::remove(fs::path(dir.path()) / "vectors.json", ec);

    VectorStore loaded(dir.str());
    EXPECT_EQ(loaded.size(), 1u);
    // Metadata survived, but the raw vector is gone, so get() has nothing to
    // return while search() still works off the index + metadata store.
    EXPECT_FALSE(loaded.get(0).has_value());

    const auto hits = loaded.search(vec4(1.0f, 0.0f, 0.0f, 0.0f), 1);
    ASSERT_EQ(hits.size(), 1u);
    EXPECT_EQ(hits[0].id, 0);
    EXPECT_EQ(nlohmann::json::parse(hits[0].metadata), nlohmann::json::parse(R"({"name":"a"})"));
}

TEST(VectorStorePersistence, CorruptVectorsFileIsReported) {
    TempDir dir;
    {
        VectorStore store(small_config());
        store.insert(vec4(1.0f, 0.0f, 0.0f, 0.0f), "{}");
        store.save(dir.str());
    }

    {
        std::ofstream out(fs::path(dir.path()) / "vectors.json", std::ios::trunc);
        out << "{ this is not valid json";
    }

    EXPECT_THROW({ VectorStore loaded(dir.str()); }, std::runtime_error);
}

TEST(VectorStorePersistence, NonNumericMetadataKeysAreSkipped) {
    TempDir dir;
    {
        VectorStore store(small_config());
        store.insert(vec4(1.0f, 0.0f, 0.0f, 0.0f), R"({"name":"a"})");
        store.save(dir.str());
    }

    // Inject a non-numeric key into the metadata file: loading must survive it.
    const fs::path meta_path = fs::path(dir.path()) / "metadata.json";
    nlohmann::json meta;
    {
        std::ifstream in(meta_path);
        in >> meta;
    }
    meta["not-a-number"] = "ignored";
    {
        std::ofstream out(meta_path, std::ios::trunc);
        out << meta.dump(2);
    }

    VectorStore loaded(dir.str());
    EXPECT_EQ(loaded.size(), 1u);
    ASSERT_TRUE(loaded.get(0).has_value());
}

// ── VectorStore update / validation / capacity ──────────────────────────────

TEST(VectorStoreUpdate, UpdatedVectorIsVisibleToSearch) {
    VectorStore store(small_config());
    const int64_t id = store.insert(vec4(1.0f, 0.0f, 0.0f, 0.0f), R"({"v":1})");
    ASSERT_EQ(id, 0);

    const auto before = store.search(vec4(0.0f, 1.0f, 0.0f, 0.0f), 1);
    ASSERT_EQ(before.size(), 1u);
    EXPECT_NEAR(before[0].distance, 1.0f, 1e-3f); // orthogonal unit vectors

    ASSERT_TRUE(store.update(id, vec4(0.0f, 1.0f, 0.0f, 0.0f), R"({"v":2})"));

    const auto after = store.search(vec4(0.0f, 1.0f, 0.0f, 0.0f), 1);
    ASSERT_EQ(after.size(), 1u);
    EXPECT_EQ(after[0].id, id);
    EXPECT_NEAR(after[0].distance, 0.0f, 1e-3f);

    auto record = store.get(id);
    ASSERT_TRUE(record.has_value());
    EXPECT_EQ(nlohmann::json::parse(record->metadata)["v"], 2);
    EXPECT_NEAR(record->vector[1], 1.0f, 1e-6f);
    EXPECT_EQ(store.size(), 1u); // update never adds a second element
}

TEST(VectorStoreUpdate, UnknownIdIsNotUpdated) {
    VectorStore store(small_config());
    EXPECT_FALSE(store.update(42, vec4(1.0f, 0.0f, 0.0f, 0.0f), "{}"));
}

TEST(VectorStoreValidation, WrongDimensionIsRejected) {
    VectorStore store(small_config(64, 4));
    EXPECT_THROW(store.insert({1.0f, 2.0f}, "{}"), std::invalid_argument);
    EXPECT_THROW(store.update(0, {1.0f}, "{}"), std::invalid_argument);
    EXPECT_THROW(store.search({1.0f, 2.0f}, 1), std::invalid_argument);
}

TEST(VectorStoreCapacity, EnsureCapacityMakesRoomForMoreElements) {
    VectorStore store(small_config(1, 4));
    store.ensure_capacity(8);
    EXPECT_GE(store.capacity(), 8u);

    for (int i = 0; i < 8; ++i) {
        store.insert(vec4(1.0f, static_cast<float>(i), 0.0f, 0.0f), "{}");
    }
    EXPECT_EQ(store.size(), 8u);
}

// ── HNSWIndex ids / persistence ─────────────────────────────────────────────

TEST(HNSWIndexIds, AutoIdsNeverCollideWithExplicitLabels) {
    HNSWIndex index(small_config());
    const auto a = vec4(1.0f, 0.0f, 0.0f, 0.0f);
    const auto b = vec4(0.0f, 1.0f, 0.0f, 0.0f);
    const auto c = vec4(0.0f, 0.0f, 1.0f, 0.0f);

    EXPECT_EQ(index.insert(a.data(), std::nullopt), 0);
    EXPECT_EQ(index.insert(b.data(), int64_t{1000}), 1000);
    EXPECT_EQ(index.insert(c.data(), std::nullopt), 1001); // not 1: no reuse

    HNSWIndex batched(small_config());
    const std::vector<float> data = {1.0f, 0.0f, 0.0f, 0.0f,
                                     0.0f, 1.0f, 0.0f, 0.0f};
    batched.batch_insert(data.data(), 2, 1000);
    EXPECT_EQ(batched.insert(a.data(), std::nullopt), 1002);
}

TEST(HNSWIndexIds, AutoIdsContinueAfterLoad) {
    TempDir dir;
    const fs::path index_path = dir.path() / "index.bin";
    const auto a = vec4(1.0f, 0.0f, 0.0f, 0.0f);
    const auto b = vec4(0.0f, 1.0f, 0.0f, 0.0f);

    {
        HNSWIndex index(small_config());
        index.insert(a.data(), int64_t{7});
        index.save(index_path.string());
    }

    HNSWIndex loaded(index_path.string(), small_config());
    ASSERT_EQ(loaded.size(), 1u);
    // Labels are restored from the file, so the next automatic id is 8.
    EXPECT_EQ(loaded.insert(b.data(), std::nullopt), 8);
}

TEST(HNSWIndexPersistence, TwoArgumentConstructorRestoresSidecarConfig) {
    TempDir dir;
    const fs::path index_path = dir.path() / "index.bin";
    const std::vector<float> data = {1.0f, 0.0f, 0.0f, 0.0f,
                                     0.0f, 1.0f, 0.0f, 0.0f,
                                     0.0f, 0.0f, 1.0f, 0.0f};
    {
        HNSWIndex index(small_config());
        index.build(data.data(), 3, 4);
        index.save(index_path.string());
    }

    IndexConfig fallback = small_config();
    fallback.metric_type = MetricType::Euclidean; // deliberately different
    HNSWIndex loaded(index_path.string(), fallback);

    EXPECT_EQ(loaded.size(), 3u);
    EXPECT_EQ(loaded.config().dim, 4);
    EXPECT_EQ(loaded.config().metric_type, MetricType::Cosine); // sidecar wins

    const auto hits = loaded.search(data.data() + 4, 1);
    ASSERT_EQ(hits.size(), 1u);
    EXPECT_EQ(hits[0].id, 1);
    EXPECT_NEAR(hits[0].distance, 0.0f, 1e-3f);
}

TEST(HNSWIndexPersistence, MissingSidecarFallsBackToCallerConfig) {
    TempDir dir;
    const fs::path index_path = dir.path() / "index.bin";
    const std::vector<float> data = {1.0f, 0.0f, 0.0f, 0.0f,
                                     0.0f, 1.0f, 0.0f, 0.0f};
    {
        HNSWIndex index(small_config());
        index.build(data.data(), 2, 4);
        index.save(index_path.string());
    }

    std::error_code ec;
    fs::remove(index_path.string() + ".meta.json", ec);

    HNSWIndex loaded(index_path.string(), small_config());
    EXPECT_EQ(loaded.size(), 2u);
    EXPECT_EQ(loaded.config().dim, 4);
}

TEST(HNSWIndexPersistence, BuildRejectsWrongDimension) {
    HNSWIndex index(small_config(64, 4));
    const std::vector<float> data = {1.0f, 0.0f, 0.0f, 0.0f};
    EXPECT_THROW(index.build(data.data(), 1, 3), std::invalid_argument);
}

TEST(HNSWIndexPersistence, ResizeBelowElementCountIsRejected) {
    HNSWIndex index(small_config(64, 4));
    const std::vector<float> data = {1.0f, 0.0f, 0.0f, 0.0f,
                                     0.0f, 1.0f, 0.0f, 0.0f};
    index.build(data.data(), 2, 4);
    EXPECT_THROW(index.resize(1), std::invalid_argument);
    EXPECT_NO_THROW(index.resize(8));
    EXPECT_GE(index.capacity(), 8u);
}
