#include "embedding/tokenizer.h"

#include <algorithm>
#include <regex>

namespace deepagent::vector_engine {

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

int Tokenizer::count_lines(std::string_view sv) {
    return static_cast<int>(std::count(sv.begin(), sv.end(), '\n')) + 1;
}

// ── ByFunction ──────────────────────────────────────────────────────────────
std::vector<CodeToken> Tokenizer::tokenize_by_function(
    std::string_view source, std::string_view language) const
{
    std::vector<CodeToken> tokens;
    // Simplified regex-based function detection for C-family languages
    static const std::regex func_regex(
        R"((?:^|\n)\s*(?:(?:inline|static|virtual|const|constexpr)\s+)*"
        R"(\w[\w:]*(?:\s*<[^>]*>)?\s+\w+\s*\([^)]*\)\s*(?:const|override|final)*\s*\{)",
        std::regex::optimize);

    std::string src(source);
    std::sregex_iterator it(src.begin(), src.end(), func_regex);
    std::sregex_iterator end;

    std::size_t last_pos = 0;
    while (it != end) {
        auto pos = static_cast<std::size_t>(it->position());
        if (pos > last_pos) {
            // Text before this function
            auto prefix = source.substr(last_pos, pos - last_pos);
            CodeToken tok;
            tok.text       = std::string(prefix);
            tok.language   = std::string(language);
            tok.start_line = count_lines(source.substr(0, last_pos));
            tok.end_line   = count_lines(source.substr(0, pos)) - 1;
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

        CodeToken tok;
        tok.text       = std::string(source.substr(pos, i - pos));
        tok.language   = std::string(language);
        tok.start_line = count_lines(source.substr(0, pos));
        tok.end_line   = count_lines(source.substr(0, i));
        // Extract function name from match
        std::smatch m = *it;
        tok.name       = m.str();
        // Trim trailing brace and whitespace from name
        auto brace_idx = tok.name.find('{');
        if (brace_idx != std::string::npos) tok.name.resize(brace_idx);
        // Keep only the last word as function name
        auto last_space = tok.name.find_last_of(" \t\n");
        if (last_space != std::string::npos) tok.name = tok.name.substr(last_space + 1);

        tokens.push_back(std::move(tok));
        last_pos = i;
        ++it;
    }

    // Remaining text after last function
    if (last_pos < source.size()) {
        CodeToken tok;
        tok.text       = std::string(source.substr(last_pos));
        tok.language   = std::string(language);
        tok.start_line = count_lines(source.substr(0, last_pos));
        tok.end_line   = count_lines(source);
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
            tok.start_line = count_lines(source.substr(0, last_pos));
            tok.end_line   = count_lines(source.substr(0, pos)) - 1;
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

        CodeToken tok;
        tok.text       = std::string(source.substr(pos, i - pos));
        tok.language   = std::string(language);
        tok.start_line = count_lines(source.substr(0, pos));
        tok.end_line   = count_lines(source.substr(0, i));
        std::smatch m = *it;
        tok.name       = m.str();
        auto brace_idx = tok.name.find('{');
        if (brace_idx != std::string::npos) tok.name.resize(brace_idx);
        auto last_space = tok.name.find_last_of(" \t\n");
        if (last_space != std::string::npos) tok.name = tok.name.substr(last_space + 1);

        tokens.push_back(std::move(tok));
        last_pos = i;
        ++it;
    }

    if (last_pos < source.size()) {
        CodeToken tok;
        tok.text       = std::string(source.substr(last_pos));
        tok.language   = std::string(language);
        tok.start_line = count_lines(source.substr(0, last_pos));
        tok.end_line   = count_lines(source);
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
            tok.start_line = count_lines(source.substr(0, block_start));
            tok.end_line   = count_lines(source);
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
        tok.start_line = count_lines(source.substr(0, block_start));
        tok.end_line   = count_lines(source.substr(0, i));
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
