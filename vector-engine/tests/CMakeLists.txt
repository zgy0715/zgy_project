cmake_minimum_required(VERSION 3.17)

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
)

target_link_libraries(vector_engine_tests
    PRIVATE
        vector_engine
        GTest::gtest_main
)

target_include_directories(vector_engine_tests
    PRIVATE
        ${CMAKE_SOURCE_DIR}/src
        ${CMAKE_SOURCE_DIR}/include
)

include(GoogleTest)
gtest_discover_tests(vector_engine_tests)
