#pragma once

#include <cstddef>
#include <functional>
#include <future>
#include <memory>
#include <queue>
#include <thread>
#include <type_traits>
#include <vector>

namespace deepagent::vector_engine {

/// A simple thread pool for parallel task execution.
///
/// Supports submitting arbitrary callables and receiving a future for
/// the result. Uses a fixed number of worker threads that pull tasks
/// from a shared work queue.
class ThreadPool {
public:
    /// Construct a thread pool with the given number of workers.
    /// @param num_threads  Number of worker threads; 0 = hardware_concurrency
    explicit ThreadPool(std::size_t num_threads = 0);

    /// Destructor — waits for all submitted tasks to complete.
    ~ThreadPool();

    // Non-copyable, non-movable
    ThreadPool(const ThreadPool&) = delete;
    ThreadPool& operator=(const ThreadPool&) = delete;
    ThreadPool(ThreadPool&&) = delete;
    ThreadPool& operator=(ThreadPool&&) = delete;

    /// Submit a callable for execution.
    /// @tparam F  Callable type
    /// @tparam Args  Argument types
    /// @return A future holding the result of the callable
    template <typename F, typename... Args>
    auto submit(F&& f, Args&&... args)
        -> std::future<std::invoke_result_t<F, Args...>>
    {
        using ReturnType = std::invoke_result_t<F, Args...>;

        auto task = std::make_shared<std::packaged_task<ReturnType()>>(
            std::bind(std::forward<F>(f), std::forward<Args>(args)...)
        );

        auto future = task->get_future();
        {
            std::lock_guard<std::mutex> lock(mutex_);
            if (stopped_) {
                throw std::runtime_error("ThreadPool is stopped");
            }
            tasks_.emplace([task]() { (*task)(); });
        }
        cv_.notify_one();
        return future;
    }

    /// Get the number of worker threads.
    [[nodiscard]] std::size_t size() const;

    /// Get the number of pending tasks.
    [[nodiscard]] std::size_t pending() const;

    /// Wait until all submitted tasks have completed.
    void wait();

private:
    /// Worker thread loop.
    void worker();

    std::vector<std::thread>          workers_;
    std::queue<std::function<void()>> tasks_;
    std::mutex                        mutex_;
    std::condition_variable           cv_;
    std::condition_variable           done_cv_;
    bool                              stopped_ = false;
    std::size_t                       active_  = 0;
};

} // namespace deepagent::vector_engine
