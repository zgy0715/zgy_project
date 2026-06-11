"""LLM calling service supporting OpenAI and Ollama providers."""

import logging
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator

from app.config import get_settings
from app.models.schemas import Message

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def complete(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> str:
        """Generate a completion for the given messages.

        Args:
            messages: Conversation messages.
            model: Model identifier override.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            **kwargs: Additional provider-specific parameters.

        Returns:
            The generated completion text.
        """
        ...

    @abstractmethod
    async def stream(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Stream a completion for the given messages.

        Args:
            messages: Conversation messages.
            model: Model identifier override.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            **kwargs: Additional provider-specific parameters.

        Returns:
            An async iterator of completion text chunks.
        """
        ...


class OpenAIProvider(LLMProvider):
    """OpenAI API provider."""

    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        """Initialize the OpenAI provider.

        Args:
            api_key: OpenAI API key.
            base_url: OpenAI API base URL.
            model: Default model to use.
        """
        self.api_key = api_key
        self.base_url = base_url
        self.model = model

    async def complete(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> str:
        """Generate a completion using OpenAI API."""
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
            )

            formatted_messages = [
                {"role": msg.role.value, "content": msg.content}
                for msg in messages
            ]

            response = await client.chat.completions.create(
                model=model or self.model,
                messages=formatted_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs,
            )

            result = response.choices[0].message.content or ""
            logger.debug("OpenAI completion: %d chars", len(result))
            return result

        except Exception as e:
            logger.error("OpenAI completion failed: %s", str(e))
            raise

    async def stream(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Stream a completion using OpenAI API."""
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
            )

            formatted_messages = [
                {"role": msg.role.value, "content": msg.content}
                for msg in messages
            ]

            stream = await client.chat.completions.create(
                model=model or self.model,
                messages=formatted_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
                **kwargs,
            )

            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            logger.error("OpenAI streaming failed: %s", str(e))
            raise


class OllamaProvider(LLMProvider):
    """Ollama local LLM provider."""

    def __init__(self, base_url: str, model: str) -> None:
        """Initialize the Ollama provider.

        Args:
            base_url: Ollama API base URL.
            model: Default model to use.
        """
        self.base_url = base_url
        self.model = model

    async def complete(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> str:
        """Generate a completion using Ollama API."""
        try:
            import httpx

            formatted_messages = [
                {"role": msg.role.value, "content": msg.content}
                for msg in messages
            ]

            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": model or self.model,
                        "messages": formatted_messages,
                        "stream": False,
                        "options": {
                            "temperature": temperature,
                            "num_predict": max_tokens,
                        },
                    },
                )
                response.raise_for_status()
                data = response.json()

            result = data.get("message", {}).get("content", "")
            logger.debug("Ollama completion: %d chars", len(result))
            return result

        except Exception as e:
            logger.error("Ollama completion failed: %s", str(e))
            raise

    async def stream(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Stream a completion using Ollama API."""
        try:
            import httpx

            formatted_messages = [
                {"role": msg.role.value, "content": msg.content}
                for msg in messages
            ]

            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json={
                        "model": model or self.model,
                        "messages": formatted_messages,
                        "stream": True,
                        "options": {
                            "temperature": temperature,
                            "num_predict": max_tokens,
                        },
                    },
                ) as response:
                    async for line in response.aiter_lines():
                        if line.strip():
                            import json

                            data = json.loads(line)
                            content = data.get("message", {}).get("content", "")
                            if content:
                                yield content

        except Exception as e:
            logger.error("Ollama streaming failed: %s", str(e))
            raise


class LLMService:
    """Unified LLM service that delegates to the configured provider.

    Supports OpenAI and Ollama backends, with provider selection
    based on application configuration.

    Example:
        >>> service = LLMService()
        >>> result = await service.complete(messages)
    """

    def __init__(self) -> None:
        """Initialize the LLM service with the configured provider."""
        settings = get_settings()
        llm_config = settings.llm

        if llm_config.provider == "openai":
            self._provider: LLMProvider = OpenAIProvider(
                api_key=llm_config.openai_api_key,
                base_url=llm_config.openai_base_url,
                model=llm_config.openai_model,
            )
        elif llm_config.provider == "ollama":
            self._provider = OllamaProvider(
                base_url=llm_config.ollama_base_url,
                model=llm_config.ollama_model,
            )
        else:
            raise ValueError(f"Unknown LLM provider: {llm_config.provider}")

        self._config = llm_config
        logger.info("LLM service initialized with provider: %s", llm_config.provider)

    async def complete(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        **kwargs: Any,
    ) -> str:
        """Generate a completion using the configured LLM provider.

        Args:
            messages: Conversation messages.
            model: Optional model override.
            temperature: Optional temperature override.
            max_tokens: Optional max_tokens override.
            **kwargs: Additional provider-specific parameters.

        Returns:
            The generated completion text.
        """
        return await self._provider.complete(
            messages=messages,
            model=model,
            temperature=temperature or self._config.temperature,
            max_tokens=max_tokens or self._config.max_tokens,
            **kwargs,
        )

    async def stream(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Stream a completion using the configured LLM provider.

        Args:
            messages: Conversation messages.
            model: Optional model override.
            temperature: Optional temperature override.
            max_tokens: Optional max_tokens override.
            **kwargs: Additional provider-specific parameters.

        Returns:
            An async iterator of completion text chunks.
        """
        async for chunk in self._provider.stream(
            messages=messages,
            model=model,
            temperature=temperature or self._config.temperature,
            max_tokens=max_tokens or self._config.max_tokens,
            **kwargs,
        ):
            yield chunk
