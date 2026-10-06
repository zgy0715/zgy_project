#include <gtest/gtest.h>

#include <cmath>
#include <stdexcept>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "engine/engine.h"

using deepagent::vector_engine::Engine;
using deepagent::vector_engine::EngineDocument;
using deepagent::vector_engine::EngineHit;

namespace {

constexpr int kDim = 8;

std::string filters(const std::string& json_text) {
    return json_text;
}

float l2_norm(const std::vector<float>& vector) {
    float sum = 0.0f;
    for (float value : vector) {
        sum += value * value;
    }
    return std::sqrt(sum);
}

/// Index a single document and return the number of documents indexed.
std::size_t index_one(Engine& engine, const std::string& id, const std::string& content,
                      const std::string& metadata, const std::string& collection) {
    return engine.index({EngineDocument{id, content, metadata}}, collection);
}

} // namespace

TEST(EngineConstruction, RejectsNonPositiveDimension) {
    EXPECT_THROW({ Engine engine(0); }, std::invalid_argument);
    EXPECT_THROW({ Engine engine(-4); }, std::invalid_argument);
    EXPECT_THROW({ Engine engine(kDim, "not-a-backend"); }, std::invalid_argument);
}

TEST(EngineEmbed, IsDeterministicAndNormalized) {
    Engine first(kDim);
    Engine second(kDim);

    const auto a = first.embed("def hello_world(): pass");
    const auto b = second.embed("def hello_world(): pass");

    ASSERT_EQ(a.size(), static_cast<std::size_t>(kDim));
    // Deterministic across instances (and, since the stub uses FNV-1a +
    // splitmix64 rather than std::hash, across processes and STL versions).
    EXPECT_EQ(a, b);
    EXPECT_NEAR(l2_norm(a), 1.0f, 1e-3f);
    EXPECT_NE(a, first.embed("a completely different text"));
}

TEST(EngineEmbedBatch, MatchesSingleEmbeddings) {
    Engine engine(kDim);
    const std::vector<std::string> texts = {"alpha", "beta", "gamma"};

    const auto batch = engine.embed_batch(texts);
    ASSERT_EQ(batch.size(), texts.size());
    for (std::size_t i = 0; i < texts.size(); ++i) {
        EXPECT_EQ(batch[i], engine.embed(texts[i]));
    }
}

TEST(EngineIndex, ReturnsCountAndSearchMatchesContract) {
    Engine engine(kDim);
    EXPECT_EQ(index_one(engine, "doc-1", "int add(int a, int b) { return a + b; }",
                        R"({"lang":"cpp","path":"math.cpp"})", "code"),
              1u);
    EXPECT_EQ(engine.collection_size("code"), 1u);
    EXPECT_EQ(engine.collections().size(), 1u);

    const auto hits = engine.search("int add(int a, int b) { return a + b; }", 5, "code", "");
    ASSERT_EQ(hits.size(), 1u);
    EXPECT_EQ(hits[0].id, "doc-1");
    EXPECT_EQ(hits[0].content, "int add(int a, int b) { return a + b; }");
    EXPECT_NEAR(hits[0].distance, 0.0f, 1e-3f);
    EXPECT_NEAR(hits[0].score, 1.0f, 1e-3f);
    // metadata is handed back as JSON of the caller's original object.
    EXPECT_EQ(nlohmann::json::parse(hits[0].metadata),
              nlohmann::json::parse(R"({"lang":"cpp","path":"math.cpp"})"));
}

TEST(EngineIndex, ReindexingAnExistingIdUpdatesInsteadOfDuplicating) {
    Engine engine(kDim);
    index_one(engine, "doc-1", "old content", R"({"rev":1})", "code");
    index_one(engine, "doc-1", "new content", R"({"rev":2})", "code");

    EXPECT_EQ(engine.collection_size("code"), 1u);

    const auto hits = engine.search("new content", 1, "code", "");
    ASSERT_EQ(hits.size(), 1u);
    EXPECT_EQ(hits[0].id, "doc-1");
    EXPECT_EQ(nlohmann::json::parse(hits[0].metadata)["rev"], 2);
}

TEST(EngineIndex, DocumentsWithoutAnIdGetAGeneratedOne) {
    Engine engine(kDim);
    ASSERT_EQ(index_one(engine, "", "anonymous document", "", "code"), 1u);

    const auto hits = engine.search("anonymous document", 1, "code", "");
    ASSERT_EQ(hits.size(), 1u);
    EXPECT_FALSE(hits[0].id.empty());
    EXPECT_EQ(hits[0].metadata, "{}");
}

TEST(EngineIndex, MultipleDocumentsWithoutIdsDoNotCollapse) {
    Engine engine(kDim);
    engine.index({
        EngineDocument{"", "first anonymous", ""},
        EngineDocument{"", "second anonymous", ""},
    }, "code");

    EXPECT_EQ(engine.collection_size("code"), 2u);

    const auto hits = engine.search("second anonymous", 2, "code", "");
    ASSERT_EQ(hits.size(), 2u);
    EXPECT_EQ(hits[0].content, "second anonymous");
    EXPECT_NE(hits[0].id, hits[1].id);
}

TEST(EngineSearch, FiltersOnMetadataEquality) {
    Engine engine(kDim);
    engine.index({
        EngineDocument{"cpp-1", "void render();", R"({"lang":"cpp"})"},
        EngineDocument{"py-1",  "def render(): pass", R"({"lang":"python"})"},
        EngineDocument{"cpp-2", "void render();", R"({"lang":"cpp"})"},
    }, "code");

    const auto filtered = engine.search("void render();", 10, "code", filters(R"({"lang":"python"})"));
    ASSERT_EQ(filtered.size(), 1u);
    EXPECT_EQ(filtered[0].id, "py-1");

    const auto cpp = engine.search("void render();", 10, "code", filters(R"({"lang":"cpp"})"));
    EXPECT_EQ(cpp.size(), 2u);

    // A filter that matches nothing returns no hits, never an error.
    EXPECT_TRUE(engine.search("void render();", 10, "code", filters(R"({"lang":"rust"})")).empty());
}

TEST(EngineSearch, DegenerateInputsReturnNoHits) {
    Engine engine(kDim);
    index_one(engine, "doc-1", "some content", "{}", "code");

    EXPECT_TRUE(engine.search("", 5, "code", "").empty());           // empty query
    EXPECT_TRUE(engine.search("content", 0, "code", "").empty());     // top_k == 0
    EXPECT_TRUE(engine.search("content", 5, "missing", "").empty());  // unknown collection
    EXPECT_EQ(engine.collection_size("missing"), 0u);
}
