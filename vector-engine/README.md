# DeepAgent Vector Engine

High-performance vector search engine module for the DeepAgent multi-AI-agent collaboration platform, built on the HNSW (Hierarchical Navigable Small World) algorithm for approximate nearest neighbor search.

## Features

- **HNSW Index** — Fast approximate nearest neighbor search with configurable M, ef_construction, ef_search
- **Code Embedding** — Source code tokenization and embedding with multiple split strategies (by function, class, block, line)
- **Vector Store** — High-level CRUD storage layer with metadata management and incremental updates
- **Distance Utilities** — Cosine, Euclidean, and inner product distance calculations
- **Thread Pool** — Parallel search support via a built-in thread pool
- **Python Bindings** — Full pybind11 exposure of HNSWIndex, CodeEmbedder, VectorStore, and distance utilities
- **Persistence** — Save/load index and metadata to disk

## Project Structure

```
vector-engine/
├── CMakeLists.txt              # Top-level CMake configuration
├── cmake/
│   └── FindHnswlib.cmake       # CMake module for finding hnswlib
├── third_party/
│   └── CMakeLists.txt          # Third-party dependency management
├── include/
│   └── deepagent/
│       └── vector_engine.h     # Unified public header
├── src/
│   ├── hnsw/
│   │   ├── index_config.h      # Index configuration struct
│   │   ├── hnsw_index.h        # HNSW index class declaration
│   │   └── hnsw_index.cpp      # HNSW index implementation
│   ├── embedding/
│   │   ├── tokenizer.h         # Code tokenizer declaration
│   │   ├── tokenizer.cpp       # Code tokenizer implementation
│   │   ├── code_embedder.h     # Code embedder declaration
│   │   └── code_embedder.cpp   # Code embedder implementation
│   ├── storage/
│   │   ├── vector_store.h      # Vector store declaration
│   │   ├── vector_store.cpp    # Vector store implementation
│   │   ├── metadata_manager.h  # Metadata manager declaration
│   │   └── metadata_manager.cpp# Metadata manager implementation
│   └── utils/
│       ├── distance.h          # Distance calculation utilities
│       ├── distance.cpp        # Distance calculation implementation
│       ├── logger.h            # Simple logging system
│       ├── logger.cpp          # Logger implementation
│       ├── thread_pool.h       # Thread pool for parallel search
│       └── thread_pool.cpp     # Thread pool implementation
├── bindings/
│   ├── CMakeLists.txt          # Binding build configuration
│   └── pybind_module.cpp       # pybind11 Python bindings
└── tests/
    ├── CMakeLists.txt          # Test build configuration
    ├── test_hnsw.cpp           # HNSW index unit tests
    ├── test_embedder.cpp       # Embedder unit tests
    └── test_distance.cpp       # Distance calculation tests
```

## Build

### Prerequisites

- CMake ≥ 3.17
- C++17 compatible compiler (MSVC 2019+, GCC 9+, Clang 10+)
- Python 3.8+ (for bindings)
- Git (for FetchContent dependencies)

### Build Commands

```bash
# Configure
cmake -B build -DCMAKE_BUILD_TYPE=Release

# Build library and tests
cmake --build build --config Release

# Run tests
cd build && ctest --output-on-failure

# Build with Python bindings
cmake -B build -DVECTOR_ENGINE_BUILD_BINDINGS=ON
cmake --build build --config Release
```

### CMake Options

| Option | Default | Description |
|--------|---------|-------------|
| `VECTOR_ENGINE_BUILD_TESTS` | ON | Build unit tests |
| `VECTOR_ENGINE_BUILD_BINDINGS` | ON | Build Python bindings |
| `VECTOR_ENGINE_ENABLE_LTO` | OFF | Enable link-time optimization |

## Python Usage

```python
import vector_engine

# Create index config
config = vector_engine.IndexConfig()
config.dim = 128
config.M = 16
config.ef_construction = 200
config.metric_type = vector_engine.MetricType.Cosine

# Build index
index = vector_engine.HNSWIndex(config)
# ... insert vectors and search

# Code embedding
embedder_cfg = vector_engine.EmbedderConfig()
embedder_cfg.dim = 128
embedder = vector_engine.CodeEmbedder(embedder_cfg)
embedding = embedder.embed("def hello(): pass")

# Distance utilities
dist = vector_engine.cosine_distance([1.0, 0.0], [0.0, 1.0])
```

## Dependencies (auto-fetched via CMake FetchContent)

| Library | Version | Purpose |
|---------|---------|---------|
| [hnswlib](https://github.com/nmslib/hnswlib) | v0.8.0 | HNSW algorithm implementation |
| [nlohmann/json](https://github.com/nlohmann/json) | v3.11.3 | JSON serialization |
| [pybind11](https://github.com/pybind/pybind11) | v2.12.0 | Python bindings |
| [Google Test](https://github.com/google/googletest) | v1.14.0 | Unit testing |

## Namespace

All code resides under `deepagent::vector_engine`.

## License

Part of the DeepAgent project.
