#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace deepagent::vector_engine {

/// Strategy for splitting source code into tokens / chunks.
enum class SplitStrategy : uint8_t {
    ByFunction,   ///< Split at function boundaries
    ByClass,      ///< Split at class / struct boundaries
    ByBlock,      ///< Split at brace-delimited blocks
    ByLine,       ///< Split per line (fine-grained)
};

/// A single code token / chunk produced by the tokenizer.
struct CodeToken {
    std::string  text;       ///< Raw text of the chunk
    std::string  language;   ///< Source language hint (e.g. "cpp", "python")
    int          start_line; ///< 1-based start line in the original source
    int          end_line;   ///< 1-based end line (inclusive)
    std::string  name;       ///< Optional identifier (function name, class name, etc.)
};

/// Tokenizer that splits source code into chunks based on a chosen strategy.
class Tokenizer {
public:
    /// Construct a tokenizer with the given split strategy.
    explicit Tokenizer(SplitStrategy strategy = SplitStrategy::ByFunction);

    /// Tokenize a source code string.
    /// @param source  Full source code text
    /// @param language  Language hint for syntax-aware splitting
    /// @return Vector of CodeToken chunks
    [[nodiscard]] std::vector<CodeToken> tokenize(
        std::string_view source,
        std::string_view language = "cpp") const;

    /// Get the current split strategy.
    [[nodiscard]] SplitStrategy strategy() const { return strategy_; }

    /// Change the split strategy at runtime.
    void set_strategy(SplitStrategy strategy) { strategy_ = strategy; }

private:
    SplitStrategy strategy_;

    // Strategy-specific tokenizers
    [[nodiscard]] std::vector<CodeToken> tokenize_by_function(
        std::string_view source, std::string_view language) const;
    [[nodiscard]] std::vector<CodeToken> tokenize_by_class(
        std::string_view source, std::string_view language) const;
    [[nodiscard]] std::vector<CodeToken> tokenize_by_block(
        std::string_view source, std::string_view language) const;
    [[nodiscard]] std::vector<CodeToken> tokenize_by_line(
        std::string_view source, std::string_view language) const;

    /// Count the number of newlines in [begin, end).
    static int count_lines(std::string_view sv);
};

} // namespace deepagent::vector_engine
