cmake_minimum_required(VERSION 3.17)

# The thread pool (utils/thread_pool.cpp) uses std::thread, so the platform
# threading library has to be linked; Threads::Threads is empty on platforms
# where the standard library already pulls it in.
set(THREADS_PREFER_PTHREAD_FLAG ON)
find_package(Threads REQUIRED)

# We use FetchContent for Google Test
include(FetchContent)
FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG        v1.14.0
)
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

# Test executable
add_executable(vector_engine_tests
    test_hnsw.cpp
    test_embedder.cpp
    test_distance.cpp
    test_storage.cpp
    test_engine.cpp
)

target_link_libraries(vector_engine_tests
    PRIVATE
        vector_engine
        GTest::gtest_main
        Threads::Threads
)

target_include_directories(vector_engine_tests
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/../src
        ${CMAKE_CURRENT_SOURCE_DIR}/../include
)

include(GoogleTest)
gtest_discover_tests(vector_engine_tests)

# Performance benchmarks. The binary name is part of the contract with
# agent-runtime/tests/generate_perf_report.py, which looks for a
# `test_performance` executable.
add_executable(test_performance
    test_performance.cpp
)

target_link_libraries(test_performance
    PRIVATE
        vector_engine
        GTest::gtest_main
        Threads::Threads
)

target_include_directories(test_performance
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/../src
        ${CMAKE_CURRENT_SOURCE_DIR}/../include
)

gtest_discover_tests(test_performance)
