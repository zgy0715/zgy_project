"""Application configuration management using Pydantic BaseSettings."""

import os
from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class LLMConfig(BaseSettings):
    """LLM provider configuration."""

    model_config = SettingsConfigDict(env_prefix="LLM_")

    provider: Literal["openai", "ollama"] = "openai"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=4096, ge=1)
    timeout: int = Field(default=120, ge=1)

    def model_post_init(self, __context: object) -> None:
        """Support OPENAI_API_KEY as alias for LLM_OPENAI_API_KEY."""
        if not self.openai_api_key:
            alias_key = os.environ.get("OPENAI_API_KEY", "")
            if alias_key:
                self.openai_api_key = alias_key


class RedisConfig(BaseSettings):
    """Redis configuration for caching and pub/sub."""

    model_config = SettingsConfigDict(env_prefix="REDIS_")

    url: RedisDsn = "redis://localhost:6379/0"  # type: ignore[assignment]
    max_connections: int = Field(default=10, ge=1)
    cache_ttl: int = Field(default=3600, ge=0)


class DatabaseConfig(BaseSettings):
    """PostgreSQL database configuration."""

    model_config = SettingsConfigDict(env_prefix="DB_")

    url: PostgresDsn = "postgresql://postgres:postgres@localhost:5432/deepagent"  # type: ignore[assignment]
    pool_size: int = Field(default=5, ge=1)
    max_overflow: int = Field(default=10, ge=0)
    echo: bool = False


class VectorEngineConfig(BaseSettings):
    """Vector engine configuration for semantic search."""

    model_config = SettingsConfigDict(env_prefix="VECTOR_")

    # NOTE: this must not share a port with the API Gateway (see
    # AppConfig.cors_origins, which defaults to the gateway on 8080).
    engine_url: str = "http://localhost:8081"
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = Field(default=1536, ge=1)
    index_type: Literal["flat", "ivf", "hnsw"] = "hnsw"
    # Env var: VECTOR_ENGINE_VERIFY_SSL. Never disable TLS verification outside
    # local development; the HTTP client fails closed (see
    # app/services/vector_service.py::_make_client).
    engine_verify_ssl: bool = Field(
        default=True,
        description="Verify TLS certificates when calling the vector engine over HTTP.",
    )


class SecurityConfig(BaseSettings):
    """Security configuration for agent tool permissions."""

    model_config = SettingsConfigDict(env_prefix="SECURITY_")

    allowed_directories: list[str] = Field(
        default_factory=lambda: ["/workspace"],
        description="Directories that agents are allowed to access. Fail-closed if empty.",
    )
    allow_shell: bool = Field(
        default=False,
        description="Whether to allow agents to execute shell commands.",
    )
    max_file_size_mb: int = Field(
        default=10,
        ge=1,
        description="Maximum file size (MB) that agents can read or write.",
    )
    # Shared secret between API Gateway and Agent Runtime for internal auth
    internal_api_key: str = Field(
        default="",
        description="API key for authenticating requests from the API Gateway.",
    )
    # Development/test escape hatch: the runtime refuses every non-public request
    # while `internal_api_key` is empty. Setting this to True restores the old
    # (insecure) behaviour of serving unauthenticated requests, and is only
    # intended for local development and the test suite.
    allow_insecure_no_auth: bool = Field(
        default=False,
        description=(
            "Development only: serve unauthenticated requests when "
            "internal_api_key is empty. Never enable in production."
        ),
    )


class AppConfig(BaseSettings):
    """Main application configuration aggregating all sub-configs."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
    )

    app_name: str = "DeepAgent Runtime"
    app_version: str = "0.1.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = Field(default=8000, ge=1, le=65535)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    # Restrict CORS to the API Gateway origin; change to specific origins in production
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:8080"],
        description="Allowed CORS origins. Should be the API Gateway URL.",
    )

    llm: LLMConfig = Field(default_factory=LLMConfig)
    redis: RedisConfig = Field(default_factory=RedisConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    vector: VectorEngineConfig = Field(default_factory=VectorEngineConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)


@lru_cache
def get_settings() -> AppConfig:
    """Return cached application settings instance."""
    return AppConfig()
