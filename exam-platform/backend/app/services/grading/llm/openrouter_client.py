"""
HKUST CSE Exam Platform – OpenRouter Client

Thin async wrapper around OpenRouter's chat completion API.
Handles retries, structured JSON mode, and usage tracking.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Any, Optional

import httpx

from app.models.grading_models import TokenUsage
from app.services.grading.settings import get_grading_settings

logger = logging.getLogger(__name__)

# ---- In-memory prompt cache ------------------------------------------
_prompt_cache: dict[str, dict[str, Any]] = {}


def _cache_key(model: str, messages: list, json_schema: Optional[dict]) -> str:
    raw = json.dumps({"m": model, "msgs": messages, "s": json_schema}, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


# ---- Client ----------------------------------------------------------

class OpenRouterClient:
    """Async client for OpenRouter chat completions."""

    def __init__(self) -> None:
        s = get_grading_settings()
        self._base_url = s.openrouter_base_url.rstrip("/")
        self._api_key = s.openrouter_api_key
        self._client = httpx.AsyncClient(timeout=120.0)

    async def chat_completion(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.0,
        max_tokens: int = 4096,
        json_schema: Optional[dict] = None,
        use_cache: bool = True,
        max_retries: int = 2,
    ) -> dict[str, Any]:
        """
        Send a chat completion request.

        Returns dict with keys:
          content: str – the completion text (or parsed JSON str)
          usage: TokenUsage
          latency_ms: int
          cached: bool
          model: str
        """
        # Check cache
        ck = _cache_key(model, messages, json_schema)
        if use_cache and ck in _prompt_cache:
            cached = _prompt_cache[ck]
            return {**cached, "cached": True}

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://hkust-exam-platform.local",
            "X-Title": "HKUST CSE Exam Platform",
        }

        body: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if json_schema is not None:
            body["response_format"] = {"type": "json_object"}
            # Append JSON format instruction to the last user message
            # so models that don't support json_schema still produce JSON
            schema_hint = json.dumps(json_schema, indent=2)
            if messages:
                last = messages[-1]
                modified = messages[:-1] + [
                    {**last, "content": last["content"] + f"\n\nRespond with valid JSON matching this schema:\n```json\n{schema_hint}\n```"}
                ]
                body["messages"] = modified

        last_err: Exception | None = None
        for attempt in range(max_retries + 1):
            t0 = time.monotonic()
            try:
                resp = await self._client.post(
                    f"{self._base_url}/chat/completions",
                    headers=headers,
                    json=body,
                )
                resp.raise_for_status()
                data = resp.json()
                latency_ms = int((time.monotonic() - t0) * 1000)

                content = data["choices"][0]["message"]["content"]
                usage_raw = data.get("usage", {})
                usage = TokenUsage(
                    prompt=usage_raw.get("prompt_tokens", 0),
                    completion=usage_raw.get("completion_tokens", 0),
                )

                result = {
                    "content": content,
                    "usage": usage,
                    "latency_ms": latency_ms,
                    "cached": False,
                    "model": model,
                }

                if use_cache:
                    _prompt_cache[ck] = result

                return result

            except (httpx.HTTPStatusError, httpx.ReadTimeout, KeyError) as e:
                last_err = e
                logger.warning(
                    "OpenRouter attempt %d/%d failed for model=%s: %s",
                    attempt + 1,
                    max_retries + 1,
                    model,
                    e,
                )
                if attempt < max_retries:
                    await _backoff(attempt)

        raise RuntimeError(
            f"OpenRouter call failed after {max_retries + 1} attempts: {last_err}"
        )

    async def close(self) -> None:
        await self._client.aclose()


async def _backoff(attempt: int) -> None:
    import asyncio
    await asyncio.sleep(min(2 ** attempt, 8))


# Singleton
_client = None


def get_openrouter_client() -> OpenRouterClient:
    global _client
    if _client is None:
        _client = OpenRouterClient()
    return _client
