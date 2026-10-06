#include "embedding/tokenizer.h"

#include <algorithm>
#include <regex>

namespace deepagent::vector_engine {

namespace {

/// Maps byte offsets to 1-based line numbers in O(log n) after a single O(n)
/// scan of the source. The previous implementation re-counted newlines over a
/// growing prefix on every lookup, which made tokenizing O(n^2).
class LineIndex {
public:
    explicit LineIndex(std::string_view source) {
        for (std::size_t i = 0; i < source.size(); ++i) {
            if (source[i] == '\n') {
                newlines_.push_back(i);
            }
        }
    }

    /// 1-based line number containing @p offset.
    [[nodiscard]] int line_of(std::size_t offset) const {
        return static_cast<int>(
            std::lower_bound(newlines_.begin(), newlines_.end(), offset) - newlines_.begin()) + 1;
    }

private:
    std::vector<std::size_t> newlines_;
};

/// Offset of the first non-whitespace character at or after @p offset.
std::size_t first_non_space(std::string_view source, std::size_t offset) {
    while (offset < source.size() &&
           (source[offset] == ' ' || source[offset] == '\t' ||
            source[offset] == '\r' || source[offset] == '\n')) {
        ++offset;
    }
    return offset;
}

/// Line of the last character of [start, end) — never before the start line.
int end_line_of(const LineIndex& index, std::size_t start, std::size_t end) {
    const int start_line = index.line_of(start);
    if (end <= start) return start_line;
    return std::max(start_line, index.line_of(end - 1));
}

/// Extract a human readable name from a regex match: strip everything from the
/// opening brace and keep the last identifier.
std::string name_from_match(const std::string& matched) {
    std::string name = matched;
    auto brace_idx = name.find('{');
    if (brace_idx != std::string::npos) name.resize(brace_idx);
    auto last_space = name.find_last_of(" \t\n");
    if (last_space != std::string::npos) name = name.substr(last_space + 1);
    return name;
}

} // namespace

Tokenizer::Tokenizer(SplitStrategy strategy)
    : strategy_(strategy) {}

std::vector<CodeToken> Tokenizer::tokenize(
    std::string_view source, std::string_view language) const
{
    if (source.empty()) return {};

    switch (strategy_) {
        case SplitStrategy::ByFunction: return tokenize_by_function(source, language);
        case SplitStrategy::ByClass:    return tokenize_by_class(source, language);
        case SplitStrategy::ByBlock:    return tokenize_by_block(source, language);
        case SplitStrategy::ByLine:     return tokenize_by_line(source, language);
    }
    return {};
}

// ── ByFunction ──────────────────────────────────────────────────────────────
std::vector<CodeToken> Tokenizer::tokenize_by_function(
    std::string_view source, std::string_view language) const
{
    std::vector<CodeToken> tokens;
    const LineIndex lines(source);

    // Simplified regex-based function detection for C-family languages.
    // The template-argument group tolerates one level of nesting, so
    // "std::map<int, std::vector<int>> foo()" is recognized.
    static const std::regex func_regex(
        R"((?:^|\n)\s*(?:(?:inline|static|virtual|const|constexpr)\s+)*)"
        R"(\w[\w:]*(?:\s*<(?:[^<>]|<[^<>]*>)*>)?\s+\w+\s*\([^)]*\)\s*(?:const|override|final)*\s*\{)",
        std::regex::optimize);

    std::string src(source);
    std::sregex_iterator it(src.begin(), src.end(), func_regex);
    std::sregex_iterator end;

    std::size_t last_pos = 0;
    while (it != end) {
        auto pos = static_cast<std::size_t>(it->position());
        if (pos > last_pos) {
            // Text before this function
            CodeToken tok;
            tok.text       = std::string(source.substr(last_pos, pos - last_pos));
            tok.language   = std::string(language);
            tok.start_line = lines.line_of(last_pos);
            tok.end_line   = end_line_of(lines, last_pos, pos);
            tok.name       = "(preamble)";
            tokens.push_back(std::move(tok));
        }

        // Find matching closing brace
        std::size_t brace_start = source.find('{', pos);
        if (brace_start == std::string_view::npos) { ++it; continue; }

        int depth = 1;
        std::size_t i = brace_start + 1;
        while (i < source.size() && depth > 0) {
            if (source[i] == '{') ++depth;
            else if (source[i] == '}') --depth;
            ++i;
        }

        // Line numbers are reported for the first declaration token, so a
        // match that starts on the preceding newline does not shift the range.
        const std::size_t text_start = first_non_space(source, pos);

        CodeToken tok;
        tok.text       = std::string(source.substr(pos, i - pos));
        tok.language   = std::string(language);
        tok.start_line = lines.line_of(text_start);
        tok.end_line   = end_line_of(lines, text_start, i);
        // Extract function name from match
        tok.name       = name_from_match(it->str());

        tokens.push_back(std::move(tok));
        last_pos = i;
        ++it;
    }

    // Remaining text after last function
    if (last_pos < source.size()) {
        CodeToken tok;
        tok.text       = std::string(source.substr(last_pos));
        tok.language   = std::string(language);
        tok.start_line = lines.line_of(last_pos);
        tok.end_line   = end_line_of(lines, last_pos, source.size());
        tok.name       = "(epilogue)";
        tokens.push_back(std::move(tok));
    }

    return tokens;
}

// ── ByClass ─────────────────────────────────────────────────────────────────
std::vector<CodeToken> Tokenizer::tokenize_by_class(
    std::string_view source, std::string_view language) const
{
    std::vector<CodeToken> tokens;
    const LineIndex lines(source);

    static const std::regex class_regex(
        R"((?:^|\n)\s*(?:class|struct)\s+\w+[^{]*\{)",
        std::regex::optimize);

    std::string src(source);
    std::sregex_iterator it(src.begin(), src.end(), class_regex);
    std::sregex_iterator end;

    std::size_t last_pos = 0;
    while (it != end) {
        auto pos = static_cast<std::size_t>(it->position());

        if (pos > last_pos) {
            CodeToken tok;
            tok.text       = std::string(source.substr(last_pos, pos - last_pos));
            tok.language   = std::string(language);
            tok.start_line = lines.line_of(last_pos);
            tok.end_line   = end_line_of(lines, last_pos, pos);
            tok.name       = "(non-class)";
            tokens.push_back(std::move(tok));
        }

        // Find matching closing brace + semicolon
        std::size_t brace_start = source.find('{', pos);
        if (brace_start == std::string_view::npos) { ++it; continue; }

        int depth = 1;
        std::size_t i = brace_start + 1;
        while (i < source.size() && depth > 0) {
            if (source[i] == '{') ++depth;
            else if (source[i] == '}') --depth;
            ++i;
        }
        // Skip trailing semicolon
        if (i < source.size() && source[i] == ';') ++i;

        const std::size_t text_start = first_non_space(source, pos);

        CodeToken tok;
        tok.text       = std::string(source.substr(pos, i - pos));
        tok.language   = std::string(language);
        tok.start_line = lines.line_of(text_start);
        tok.end_line   = end_line_of(lines, text_start, i);
        tok.name       = name_from_match(it->str());

        tokens.push_back(std::move(tok));
        last_pos = i;
        ++it;
    }

    if (last_pos < source.size()) {
        CodeToken tok;
        tok.text       = std::string(source.substr(last_pos));
        tok.language   = std::string(language);
        tok.start_line = lines.line_of(last_pos);
        tok.end_line   = end_line_of(lines, last_pos, source.size());
        tok.name       = "(epilogue)";
        tokens.push_back(std::move(tok));
    }

    return tokens;
}

// ── ByBlock ─────────────────────────────────────────────────────────────────
std::vector<CodeToken> Tokenizer::tokenize_by_block(
    std::string_view source, std::string_view language) const
{
    std::vector<CodeToken> tokens;
    const LineIndex lines(source);
    std::size_t i = 0;

    while (i < source.size()) {
        // Skip whitespace
        while (i < source.size() && (source[i] == ' ' || source[i] == '\t' || source[i] == '\n'))
            ++i;
        if (i >= source.size()) break;

        std::size_t block_start = i;

        // Find next opening brace
        auto brace_pos = source.find('{', i);
        if (brace_pos == std::string_view::npos) {
            // Rest of file is one block
            CodeToken tok;
            tok.text       = std::string(source.substr(block_start));
            tok.language   = std::string(language);
            tok.start_line = lines.line_of(block_start);
            tok.end_line   = end_line_of(lines, block_start, source.size());
            tok.name       = "(block)";
            tokens.push_back(std::move(tok));
            break;
        }

        // Include text before the brace
        i = brace_pos;
        int depth = 1;
        ++i;
        while (i < source.size() && depth > 0) {
            if (source[i] == '{') ++depth;
            else if (source[i] == '}') --depth;
            ++i;
        }

        CodeToken tok;
        tok.text       = std::string(source.substr(block_start, i - block_start));
        tok.language   = std::string(language);
        tok.start_line = lines.line_of(block_start);
        tok.end_line   = end_line_of(lines, block_start, i);
        tok.name       = "(block)";
        tokens.push_back(std::move(tok));
    }

    return tokens;
}

// ── ByLine ──────────────────────────────────────────────────────────────────
std::vector<CodeToken> Tokenizer::tokenize_by_line(
    std::string_view source, std::string_view language) const
{
    std::vector<CodeToken> tokens;
    std::size_t pos = 0;
    int line_num = 1;

    while (pos < source.size()) {
        auto eol = source.find('\n', pos);
        std::size_t end = (eol == std::string_view::npos) ? source.size() : eol;

        CodeToken tok;
        tok.text       = std::string(source.substr(pos, end - pos));
        tok.language   = std::string(language);
        tok.start_line = line_num;
        tok.end_line   = line_num;
        tok.name       = "(line)";
        tokens.push_back(std::move(tok));

        pos = end + 1;
        ++line_num;
    }

    return tokens;
}

} // namespace deepagent::vector_engine
