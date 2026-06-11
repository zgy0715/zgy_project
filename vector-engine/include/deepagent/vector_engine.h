#pragma once

/// @file vector_engine.h
/// @brief Unified public header for the DeepAgent Vector Engine module.
///
/// Include this single header to get access to all public APIs.

// HNSW index
#include "hnsw/hnsw_index.h"
#include "hnsw/index_config.h"

// Embedding
#include "embedding/code_embedder.h"
#include "embedding/tokenizer.h"

// Storage
#include "storage/vector_store.h"
#include "storage/metadata_manager.h"

// Utilities
#include "utils/distance.h"
#include "utils/logger.h"
#include "utils/thread_pool.h"
