# DeepAgent Vector Engine

High-performance vector search engine module for the DeepAgent multi-AI-agent collaboration platform, built on the HNSW (Hierarchical Navigable Small World) algorithm for approximate nearest neighbor search.

## Features

- **HNSW Index** — Fast approximate nearest neighbor search with configurable M, ef_construction, ef_search
- **Code Embedding** — Source code tokenization and embedding with multiple split strategies (by function, class, block, line)
- **Vector Store** — High-level CRUD storage layer with metadata management and incremental updates
- **Distance Utilities** — Cosine, Euclidean, and inner product distance calculations
- **Engine Facade** — Collection-based `Engine` API (`embed` / `embed_batch` / `index` / `search`) — the surface the Python service uses
- **Thread Pool** — Parallel embedding for non-stub backends (the scalar distance functions themselves are not parallelised)
- **Python Bindings** — pybind11 exposure of `Engine`, `HNSWIndex`, `CodeEmbedder`, `Tokenizer`, `VectorStore` and the distance utilities
- **Persistence** — Save/load index and metadata to disk

## Project Structure

```
vector-engine/
├── CMakeLists.txt              # Top-level CMake configuration
├── third_party/
│   └── CMakeLists.txt          # Third-party dependency management
├── include/
│   └── deepagent/
│       └── vector_engine.h     # Unified public header
├── src/
│   ├── engine/
│   │   ├── engine.h            # Collection-based Engine facade
│   │   └── engine.cpp          # Engine facade implementation
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
    ├── test_distance.cpp       # Distance calculation tests
    ├── test_storage.cpp        # Store persistence, id and validation tests
    ├── test_engine.cpp         # Engine facade tests
    └── test_performance.cpp    # Benchmarks (built as `test_performance`)
```

## Build

### Prerequisites

- CMake ≥ 3.17
- C++17 compatible compiler (MSVC 2019+, GCC 9+, Clang 10+)
- Python 3.8+ (for bindings)
- Git (for FetchContent dependencies)

### Build Commands

```bash
# Configure (run from the repository root; pass -S . -B build from inside
# vector-engine/ instead)
cmake -S vector-engine -B vector-engine/build -DCMAKE_BUILD_TYPE=Release

# Build library, tests and the Python extension
cmake --build vector-engine/build --config Release --parallel

# Run tests
ctest --test-dir vector-engine/build --output-on-failure

# Skip the optional parts
cmake -S vector-engine -B vector-engine/build -DVECTOR_ENGINE_BUILD_TESTS=OFF
cmake -S vector-engine -B vector-engine/build -DVECTOR_ENGINE_BUILD_BINDINGS=OFF
```

### Dependencies

`third_party/CMakeLists.txt` looks for a local copy first and only falls back to
`FetchContent` (which needs network access) when it cannot find one:

| Dependency | Local location | Override variable |
|------------|----------------|-------------------|
| hnswlib headers (`hnswlib/hnswalg.h`) | `third_party/hnswlib/` | `VE_HNSWLIB_INCLUDE_DIR` |
| nlohmann/json | `third_party/json/` | `FETCHCONTENT_SOURCE_DIR_NLOHMANN_JSON` |
| pybind11 | `third_party/pybind11/` | `FETCHCONTENT_SOURCE_DIR_PYBIND11` |

The Python extension is built as `vector_engine.so` (`.pyd` on Windows) so that
`import vector_engine` matches `PYBIND11_MODULE(vector_engine, m)`.

### CMake Options

| Option | Default | Description |
|--------|---------|-------------|
| `VECTOR_ENGINE_BUILD_TESTS` | ON | Build unit tests |
| `VECTOR_ENGINE_BUILD_BINDINGS` | ON | Build Python bindings |
| `VECTOR_ENGINE_ENABLE_LTO` | OFF | Enable link-time optimization |

## Python Usage

```python
import vector_engine

# ── High-level facade (the API the service layer uses) ────────────────────
engine = vector_engine.Engine(embedding_dim=384)          # backend="dummy" by default
vector = engine.embed("def hello(): pass")                # -> list[float]
batch = engine.embed_batch(["a", "b"])                    # -> list[list[float]]

indexed = engine.index(
    [{"id": "doc-1", "content": "def hello(): pass", "metadata": {"lang": "python"}}],
    "code",
)                                                         # -> 1

hits = engine.search("hello", top_k=5, collection="code", filters={"lang": "python"})
# -> [{"id": "doc-1", "content": "...", "metadata": {"lang": "python"},
#      "score": 1.0, "distance": 0.0}]

# ── Low-level building blocks ─────────────────────────────────────────────
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

Metric conventions: `HNSWIndex.search` returns metric distances
(cosine: `1 - cos`; Euclidean: L2; inner product: `-dot`), while `Engine.search`
additionally reports a `score` that grows with similarity.

## Third-party libraries

Versions used when no local copy is present in `third_party/` (see
[Dependencies](#dependencies) above):

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
