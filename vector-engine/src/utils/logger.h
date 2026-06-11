#pragma once

#include <cstdio>
#include <string>
#include <string_view>

namespace deepagent::vector_engine {

/// Log severity levels.
enum class LogLevel : int {
    Trace = 0,
    Debug = 1,
    Info  = 2,
    Warn  = 3,
    Error = 4,
    Fatal = 5,
};

/// Simple thread-safe logger with configurable severity.
///
/// Outputs to stderr by default. Supports setting a minimum log level
/// and an optional file output.
class Logger {
public:
    /// Get the singleton logger instance.
    static Logger& instance();

    /// Set the minimum log level.
    void set_level(LogLevel level);

    /// Get the current log level.
    [[nodiscard]] LogLevel level() const;

    /// Set an optional log file path.
    void set_log_file(const std::string& path);

    /// Log a message at the given level.
    void log(LogLevel level, std::string_view tag, std::string_view message) const;

    // Convenience methods
    void trace(std::string_view tag, std::string_view msg) const;
    void debug(std::string_view tag, std::string_view msg) const;
    void info (std::string_view tag, std::string_view msg) const;
    void warn (std::string_view tag, std::string_view msg) const;
    void error(std::string_view tag, std::string_view msg) const;
    void fatal(std::string_view tag, std::string_view msg) const;

private:
    Logger();
    ~Logger();

    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;

    struct Impl;
    Impl* impl_;
};

/// Convenience macro for logging with file/line info.
#define VE_LOG(level, tag, msg) \
    ::deepagent::vector_engine::Logger::instance().log(level, tag, msg)

#define VE_TRACE(tag, msg) VE_LOG(::deepagent::vector_engine::LogLevel::Trace, tag, msg)
#define VE_DEBUG(tag, msg) VE_LOG(::deepagent::vector_engine::LogLevel::Debug, tag, msg)
#define VE_INFO(tag, msg)  VE_LOG(::deepagent::vector_engine::LogLevel::Info,  tag, msg)
#define VE_WARN(tag, msg)  VE_LOG(::deepagent::vector_engine::LogLevel::Warn,  tag, msg)
#define VE_ERROR(tag, msg) VE_LOG(::deepagent::vector_engine::LogLevel::Error, tag, msg)
#define VE_FATAL(tag, msg) VE_LOG(::deepagent::vector_engine::LogLevel::Fatal, tag, msg)

} // namespace deepagent::vector_engine
