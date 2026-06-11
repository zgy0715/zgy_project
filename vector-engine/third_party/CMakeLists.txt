# Third-party dependency management for vector_engine

include(FetchContent)

# ── hnswlib ──────────────────────────────────────────────────────────────────
FetchContent_Declare(
    hnswlib
    GIT_REPOSITORY https://github.com/nmslib/hnswlib.git
    GIT_TAG        v0.8.0
    SOURCE_SUBDIR  .
)

# hnswlib is header-only; create an INTERFACE target
add_library(hnswlib::hnswlib ALIAS hnswlib)

# ── nlohmann/json ───────────────────────────────────────────────────────────
FetchContent_Declare(
    nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG        v3.11.3
)

# ── pybind11 ────────────────────────────────────────────────────────────────
if(VECTOR_ENGINE_BUILD_BINDINGS)
    FetchContent_Declare(
        pybind11
        GIT_REPOSITORY https://github.com/pybind/pybind11.git
        GIT_TAG        v2.12.0
    )
endif()

# Fetch all at once
FetchContent_MakeAvailable(hnswlib nlohmann_json)

if(VECTOR_ENGINE_BUILD_BINDINGS)
    FetchContent_MakeAvailable(pybind11)
endif()
