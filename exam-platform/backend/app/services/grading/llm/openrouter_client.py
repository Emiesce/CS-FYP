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
from app.services.grading.llm.json_extraction import extract_json_dict

logger = logging.getLogger(__name__)

# ---- In-memory prompt cache ------------------------------------------
_prompt_cache: dict[str, dict[str, Any]] = {}


def _cache_key(model: str, messages: list, json_schema: Optional[dict]) -> str:
    raw = json.dumps({"m": model, "msgs": messages, "s": json_schema}, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def _looks_like_json_object(text: str) -> bool:
    """Heuristic check for object-shaped JSON output."""
    try:
        extract_json_dict(text)
        return True
    except ValueError:
        return False


def _with_json_retry_hint(messages: list[dict[str, str]], json_schema: Optional[dict]) -> list[dict[str, str]]:
    """Strengthen the prompt for retries when a JSON object is required."""
    if not messages:
        return messages
    schema_hint = json.dumps(json_schema or {}, indent=2)
    retry_hint = (
        "\n\nCRITICAL RETRY INSTRUCTION:\n"
        "Return ONLY one valid JSON object.\n"
        "Do not return a number, list, markdown, prose, code fences, or commentary.\n"
        "The top-level response must begin with '{' and end with '}'.\n"
        f"Required JSON schema:\n```json\n{schema_hint}\n```"
    )
    last = messages[-1]
    return messages[:-1] + [{**last, "content": last["content"] + retry_hint}]


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
                request_body = body
                if json_schema is not None and attempt > 0:
                    request_body = {
                        **body,
                        "messages": _with_json_retry_hint(body["messages"], json_schema),
                    }

                resp = await self._client.post(
                    f"{self._base_url}/chat/completions",
                    headers=headers,
                    json=request_body,
                )
                resp.raise_for_status()
                data = resp.json()
                latency_ms = int((time.monotonic() - t0) * 1000)

                choices = data.get("choices") or []
                if not choices:
                    raise RuntimeError("OpenRouter returned no choices")
                content = choices[0].get("message", {}).get("content")
                # content may be None if the model returned nothing — retry
                if content is None or (isinstance(content, str) and content.strip() == ""):
                    logger.warning("OpenRouter returned null/empty content for model=%s (attempt %d)", model, attempt + 1)
                    if attempt < max_retries:
                        await _backoff(attempt)
                        last_err = RuntimeError(f"Null content from {model}")
                        continue
                    # Last attempt — use empty string
                    content = ""
                if json_schema is not None and isinstance(content, str) and not _looks_like_json_object(content):
                    logger.warning(
                        "OpenRouter returned non-object content for model=%s (attempt %d): %s",
                        model,
                        attempt + 1,
                        content[:120],
                    )
                    if attempt < max_retries:
                        await _backoff(attempt)
                        last_err = RuntimeError(f"Non-object JSON content from {model}")
                        continue
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

                if use_cache and (json_schema is None or _looks_like_json_object(str(content))):
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
