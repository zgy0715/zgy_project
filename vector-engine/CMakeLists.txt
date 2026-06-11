cmake_minimum_required(VERSION 3.17)
project(vector_engine VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Build type defaults to Release
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

# Project options
option(VECTOR_ENGINE_BUILD_TESTS "Build unit tests" ON)
option(VECTOR_ENGINE_BUILD_BINDINGS "Build Python bindings" ON)
option(VECTOR_ENGINE_ENABLE_LTO "Enable link-time optimization" OFF)

# Append cmake module path
list(APPEND CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/cmake")

# Third-party dependencies
add_subdirectory(third_party)

# Core library
set(VE_SOURCES
    src/hnsw/hnsw_index.cpp
    src/embedding/code_embedder.cpp
    src/embedding/tokenizer.cpp
    src/storage/vector_store.cpp
    src/storage/metadata_manager.cpp
    src/utils/distance.cpp
    src/utils/logger.cpp
    src/utils/thread_pool.cpp
)

add_library(vector_engine STATIC ${VE_SOURCES})

target_include_directories(vector_engine
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_SOURCE_DIR}/include>
        $<BUILD_INTERFACE:${CMAKE_SOURCE_DIR}/src>
        $<INSTALL_INTERFACE:include>
    PRIVATE
        ${CMAKE_SOURCE_DIR}/third_party/hnswlib
)

target_link_libraries(vector_engine
    PUBLIC
        nlohmann_json::nlohmann_json
    PRIVATE
        hnswlib::hnswlib
)

target_compile_options(vector_engine PRIVATE
    $<$<CXX_COMPILER_ID:GNU>:-Wall -Wextra -Wpedantic>
    $<$<CXX_COMPILER_ID:MSVC>:/W4 /permissive->
)

if(VECTOR_ENGINE_ENABLE_LTO)
    include(CheckIPOSupported)
    check_ipo_supported(RESULT lpo_supported OUTPUT lpo_error)
    if(lpo_supported)
        set_target_properties(vector_engine PROPERTIES INTERPROCEDURAL_OPTIMIZATION ON)
    else()
        message(WARNING "LTO is not supported: ${lpo_error}")
    endif()
endif()

# Tests
if(VECTOR_ENGINE_BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()

# Python bindings
if(VECTOR_ENGINE_BUILD_BINDINGS)
    add_subdirectory(bindings)
endif()
