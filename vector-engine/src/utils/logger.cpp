#include "utils/logger.h"

#include <chrono>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <mutex>
#include <string>

namespace deepagent::vector_engine {

// ── Logger::Impl ────────────────────────────────────────────────────────────

struct Logger::Impl {
    LogLevel              level     = LogLevel::Info;
    std::mutex            mutex;
    std::ofstream         file_stream;
    bool                  use_file  = false;
};

// ── Logger ──────────────────────────────────────────────────────────────────

Logger::Logger()
    : impl_(new Impl()) {}

Logger::~Logger() {
    delete impl_;
}

Logger& Logger::instance() {
    static Logger logger;
    return logger;
}

void Logger::set_level(LogLevel level) {
    std::lock_guard<std::mutex> lock(impl_->mutex);
    impl_->level = level;
}

LogLevel Logger::level() const {
    std::lock_guard<std::mutex> lock(impl_->mutex);
    return impl_->level;
}

void Logger::set_log_file(const std::string& path) {
    std::lock_guard<std::mutex> lock(impl_->mutex);
    impl_->file_stream.open(path, std::ios::app);
    impl_->use_file = impl_->file_stream.is_open();
}

static const char* level_string(LogLevel level) {
    switch (level) {
        case LogLevel::Trace: return "TRACE";
        case LogLevel::Debug: return "DEBUG";
        case LogLevel::Info:  return "INFO ";
        case LogLevel::Warn:  return "WARN ";
        case LogLevel::Error: return "ERROR";
        case LogLevel::Fatal: return "FATAL";
    }
    return "?????";
}

void Logger::log(LogLevel level, std::string_view tag, std::string_view message) const {
    if (level < impl_->level) return;

    // Get timestamp
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    struct tm tm_buf;
#ifdef _WIN32
    localtime_s(&tm_buf, &time_t);
#else
    localtime_r(&time_t, &tm_buf);
#endif

    char time_str[32];
    std::strftime(time_str, sizeof(time_str), "%Y-%m-%d %H:%M:%S", &tm_buf);

    std::lock_guard<std::mutex> lock(impl_->mutex);

    // Format: [TIMESTAMP] [LEVEL] [TAG] message
    char buf[1024];
    int n = std::snprintf(buf, sizeof(buf), "[%s] [%s] [%.*s] %.*s\n",
                          time_str,
                          level_string(level),
                          static_cast<int>(tag.size()), tag.data(),
                          static_cast<int>(message.size()), message.data());

    // Output to stderr
    std::fwrite(buf, 1, static_cast<std::size_t>(n), stderr);

    // Also write to file if configured
    if (impl_->use_file) {
        impl_->file_stream.write(buf, n);
        impl_->file_stream.flush();
    }
}

void Logger::trace(std::string_view tag, std::string_view msg) const { log(LogLevel::Trace, tag, msg); }
void Logger::debug(std::string_view tag, std::string_view msg) const { log(LogLevel::Debug, tag, msg); }
void Logger::info (std::string_view tag, std::string_view msg) const { log(LogLevel::Info,  tag, msg); }
void Logger::warn (std::string_view tag, std::string_view msg) const { log(LogLevel::Warn,  tag, msg); }
void Logger::error(std::string_view tag, std::string_view msg) const { log(LogLevel::Error, tag, msg); }
void Logger::fatal(std::string_view tag, std::string_view msg) const { log(LogLevel::Fatal, tag, msg); }

} // namespace deepagent::vector_engine
