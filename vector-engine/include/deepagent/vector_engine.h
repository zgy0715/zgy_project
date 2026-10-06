#pragma once

/// Umbrella header for the DeepAgent vector engine.
///
/// Historically this header re-declared `SearchResult` and `HNSWIndex` itself,
/// which duplicated the real declarations in "hnsw/hnsw_index.h". Including
/// both in the same translation unit was an ODR violation and the two copies
/// could silently diverge, so this header now only re-exports the real types.
///
/// Usage:
/// @code
///   #include <deepagent/vector_engine.h>
///
///   deepagent::vector_engine::IndexConfig config;
///   config.dim = 128;
///   deepagent::vector_engine::HNSWIndex index(config);
/// @endcode

#include "engine/engine.h"
#include "embedding/code_embedder.h"
#include "embedding/tokenizer.h"
#include "hnsw/hnsw_index.h"
#include "hnsw/index_config.h"
#include "storage/vector_store.h"
#include "utils/distance.h"
