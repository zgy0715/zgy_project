# Third-party dependency management for vector_engine
#
# Dependencies are resolved in this order:
#   1. A local copy inside third_party/<name>/ (works offline)
#   2. hnswlib only: a system / conda installation found via find_path()
#   3. FetchContent from GitHub (needs network access)
#
# To build offline, drop the sources next to this file, e.g.
#   third_party/hnswlib/     (nmslib/hnswlib checkout; used header-only)
#   third_party/json/        (nlohmann/json checkout, has a CMakeLists.txt)
#   third_party/pybind11/    (pybind/pybind11 checkout, has a CMakeLists.txt)
# or point CMake at existing copies with
#   -DVE_HNSWLIB_INCLUDE_DIR=<dir containing hnswlib/>
#   -DFETCHCONTENT_SOURCE_DIR_NLOHMANN_JSON=<path>
#   -DFETCHCONTENT_SOURCE_DIR_PYBIND11=<path>

include(FetchContent)

set(VE_THIRD_PARTY_DIR "${CMAKE_CURRENT_SOURCE_DIR}")

# ── hnswlib ──────────────────────────────────────────────────────────────────
# hnswlib is header-only. Prefer headers that are already present locally so a
# checkout of this repository can be configured and built without network.
set(VE_HNSWLIB_INCLUDE_DIR "" CACHE PATH
    "Directory containing the hnswlib/ headers (skips FetchContent)")

if(NOT VE_HNSWLIB_INCLUDE_DIR)
    find_path(VE_HNSWLIB_INCLUDE_DIR
        NAMES hnswlib/hnswalg.h
        HINTS
            ${VE_THIRD_PARTY_DIR}/hnswlib
            $ENV{HNSWLIB_ROOT}
            /usr/local
            /usr
        PATH_SUFFIXES include
    )
endif()

if(VE_HNSWLIB_INCLUDE_DIR)
    message(STATUS "vector_engine: using local hnswlib headers from ${VE_HNSWLIB_INCLUDE_DIR}")

    # Mirror the target names exported by hnswlib's own CMakeLists.txt
    add_library(hnswlib INTERFACE)
    target_include_directories(hnswlib INTERFACE "${VE_HNSWLIB_INCLUDE_DIR}")
    add_library(hnswlib::hnswlib ALIAS hnswlib)
else()
    message(STATUS "vector_engine: fetching hnswlib v0.8.0 with FetchContent")

    FetchContent_Declare(
        hnswlib
        GIT_REPOSITORY https://github.com/nmslib/hnswlib.git
        GIT_TAG        v0.8.0
        GIT_SHALLOW    TRUE
        SOURCE_SUBDIR  .
    )
    FetchContent_MakeAvailable(hnswlib)

    # The ALIAS must be created *after* the target exists. Upstream hnswlib
    # defines both names itself; this is only a safety net for other layouts.
    if(NOT TARGET hnswlib::hnswlib)
        if(TARGET hnswlib)
            add_library(hnswlib::hnswlib ALIAS hnswlib)
        else()
            message(FATAL_ERROR
                "hnswlib was fetched but neither target 'hnswlib' nor "
                "'hnswlib::hnswlib' was defined")
        endif()
    endif()
endif()

if(NOT TARGET hnswlib::hnswlib)
    message(FATAL_ERROR "hnswlib::hnswlib target is unavailable")
endif()

# ── nlohmann/json ───────────────────────────────────────────────────────────
if(EXISTS "${VE_THIRD_PARTY_DIR}/json/CMakeLists.txt")
    message(STATUS "vector_engine: using local nlohmann/json from third_party/json")
    FetchContent_Declare(nlohmann_json SOURCE_DIR "${VE_THIRD_PARTY_DIR}/json")
else()
    FetchContent_Declare(
        nlohmann_json
        GIT_REPOSITORY https://github.com/nlohmann/json.git
        GIT_TAG        v3.11.3
        GIT_SHALLOW    TRUE
    )
endif()
FetchContent_MakeAvailable(nlohmann_json)

# ── pybind11 ────────────────────────────────────────────────────────────────
if(VECTOR_ENGINE_BUILD_BINDINGS)
    if(EXISTS "${VE_THIRD_PARTY_DIR}/pybind11/CMakeLists.txt")
        message(STATUS "vector_engine: using local pybind11 from third_party/pybind11")
        FetchContent_Declare(pybind11 SOURCE_DIR "${VE_THIRD_PARTY_DIR}/pybind11")
    else()
        FetchContent_Declare(
            pybind11
            GIT_REPOSITORY https://github.com/pybind/pybind11.git
            GIT_TAG        v2.12.0
            GIT_SHALLOW    TRUE
        )
    endif()
    FetchContent_MakeAvailable(pybind11)
endif()
