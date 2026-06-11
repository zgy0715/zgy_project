#include <gtest/gtest.h>

#include <cmath>
#include <string>
#include <vector>

#include "embedding/code_embedder.h"
#include "embedding/tokenizer.h"

using namespace deepagent::vector_engine;

// ── Tokenizer tests ─────────────────────────────────────────────────────────

TEST(TokenizerTest, ByFunctionStrategy) {
    Tokenizer tok(SplitStrategy::ByFunction);

    std::string source = R"(
#include <iostream>

void hello() {
    std::cout << "Hello" << std::endl;
}

int add(int a, int b) {
    return a + b;
}
)";

    auto tokens = tok.tokenize(source, "cpp");
    ASSERT_FALSE(tokens.empty());
    // Should find at least the two functions
    EXPECT_GE(tokens.size(), 2u);
}

TEST(TokenizerTest, ByClassStrategy) {
    Tokenizer tok(SplitStrategy::ByClass);

    std::string source = R"(
class Foo {
public:
    void bar() {}
};

struct Point {
    float x, y;
};
)";

    auto tokens = tok.tokenize(source, "cpp");
    ASSERT_FALSE(tokens.empty());
    EXPECT_GE(tokens.size(), 2u);
}

TEST(TokenizerTest, ByBlockStrategy) {
    Tokenizer tok(SplitStrategy::ByBlock);

    std::string source = R"(
void foo() {
    int x = 1;
}

void bar() {
    int y = 2;
}
)";

    auto tokens = tok.tokenize(source, "cpp");
    ASSERT_FALSE(tokens.empty());
}

TEST(TokenizerTest, ByLineStrategy) {
    Tokenizer tok(SplitStrategy::ByLine);

    std::string source = "line1\nline2\nline3";
    auto tokens = tok.tokenize(source, "cpp");

    ASSERT_EQ(tokens.size(), 3u);
    EXPECT_EQ(tokens[0].start_line, 1);
    EXPECT_EQ(tokens[1].start_line, 2);
    EXPECT_EQ(tokens[2].start_line, 3);
}

TEST(TokenizerTest, EmptyInput) {
    Tokenizer tok(SplitStrategy::ByFunction);
    auto tokens = tok.tokenize("", "cpp");
    EXPECT_TRUE(tokens.empty());
}

TEST(TokenizerTest, SetStrategy) {
    Tokenizer tok(SplitStrategy::ByFunction);
    EXPECT_EQ(tok.strategy(), SplitStrategy::ByFunction);

    tok.set_strategy(SplitStrategy::ByLine);
    EXPECT_EQ(tok.strategy(), SplitStrategy::ByLine);
}

// ── CodeEmbedder tests ──────────────────────────────────────────────────────

TEST(CodeEmbedderTest, DummyEmbedDimension) {
    EmbedderConfig cfg;
    cfg.backend = EmbedderBackend::Dummy;
    cfg.dim = 64;

    CodeEmbedder embedder(cfg);
    auto vec = embedder.embed("hello world");

    ASSERT_EQ(vec.size(), static_cast<std::size_t>(64));
}

TEST(CodeEmbedderTest, DummyEmbedNormalized) {
    EmbedderConfig cfg;
    cfg.backend = EmbedderBackend::Dummy;
    cfg.dim = 128;

    CodeEmbedder embedder(cfg);
    auto vec = embedder.embed("test string");

    // Should be L2-normalized
    float norm = 0.0f;
    for (auto v : vec) norm += v * v;
    norm = std::sqrt(norm);
    EXPECT_NEAR(norm, 1.0f, 1e-4f);
}

TEST(CodeEmbedderTest, EmbedBatch) {
    EmbedderConfig cfg;
    cfg.backend = EmbedderBackend::Dummy;
    cfg.dim = 32;

    CodeEmbedder embedder(cfg);
    std::vector<std::string> texts = {"hello", "world", "test"};
    auto results = embedder.embed_batch(texts);

    ASSERT_EQ(results.size(), 3u);
    for (const auto& vec : results) {
        EXPECT_EQ(vec.size(), 32u);
    }
}

TEST(CodeEmbedderTest, EmbedCode) {
    EmbedderConfig cfg;
    cfg.backend = EmbedderBackend::Dummy;
    cfg.dim = 64;
    cfg.split_strategy = SplitStrategy::ByFunction;

    CodeEmbedder embedder(cfg);

    std::string source = R"(
int add(int a, int b) {
    return a + b;
}

int mul(int a, int b) {
    return a * b;
}
)";

    auto [tokens, embeddings] = embedder.embed_code(source, "cpp");

    EXPECT_EQ(tokens.size(), embeddings.size());
    for (const auto& emb : embeddings) {
        EXPECT_EQ(emb.size(), 64u);
    }
}

TEST(CodeEmbedderTest, DimAccessor) {
    EmbedderConfig cfg;
    cfg.dim = 256;

    CodeEmbedder embedder(cfg);
    EXPECT_EQ(embedder.dim(), 256);
}

TEST(CodeEmbedderTest, ConfigAccessor) {
    EmbedderConfig cfg;
    cfg.dim = 128;
    cfg.backend = EmbedderBackend::Dummy;

    CodeEmbedder embedder(cfg);
    EXPECT_EQ(embedder.config().dim, 128);
    EXPECT_EQ(embedder.config().backend, EmbedderBackend::Dummy);
}
