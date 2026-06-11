#include "utils/thread_pool.h"

namespace deepagent::vector_engine {

ThreadPool::ThreadPool(std::size_t num_threads) {
    if (num_threads == 0) {
        num_threads = std::thread::hardware_concurrency();
        if (num_threads == 0) num_threads = 4; // fallback
    }

    workers_.reserve(num_threads);
    for (std::size_t i = 0; i < num_threads; ++i) {
        workers_.emplace_back(&ThreadPool::worker, this);
    }
}

ThreadPool::~ThreadPool() {
    {
        std::lock_guard<std::mutex> lock(mutex_);
        stopped_ = true;
    }
    cv_.notify_all();
    for (auto& w : workers_) {
        if (w.joinable()) w.join();
    }
}

void ThreadPool::worker() {
    while (true) {
        std::function<void()> task;
        {
            std::unique_lock<std::mutex> lock(mutex_);
            cv_.wait(lock, [this] { return stopped_ || !tasks_.empty(); });

            if (stopped_ && tasks_.empty()) return;

            task = std::move(tasks_.front());
            tasks_.pop();
            ++active_;
        }

        task();

        {
            std::lock_guard<std::mutex> lock(mutex_);
            --active_;
        }
        done_cv_.notify_all();
    }
}

std::size_t ThreadPool::size() const {
    return workers_.size();
}

std::size_t ThreadPool::pending() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return tasks_.size();
}

void ThreadPool::wait() {
    std::unique_lock<std::mutex> lock(mutex_);
    done_cv_.wait(lock, [this] {
        return tasks_.empty() && active_ == 0;
    });
}

} // namespace deepagent::vector_engine
