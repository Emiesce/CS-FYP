"""
HKUST CSE Exam Platform – OpenRouter Client

Thin async wrapper around OpenRouter's chat completion API.
Handles retries, structured JSON mode, usage tracking, and
automatic model/provider switching on repeated 429 rate-limits.

429 escalation strategy (per call):
  attempt 0          → primary model, default provider routing
  1st 429            → wait Retry-After, retry same model/provider
  2nd consecutive 429 → switch to fallback_model (if supplied) OR
                        add alternative provider routing for same model
  3rd+ consecutive 429 → continue with whatever model is active
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

# ---- Alternative providers per model (OpenRouter provider routing) ---
# When a model is rate-limited twice in a row and no fallback_model is
# provided, we ask OpenRouter to route via these providers instead.
# Values are OpenRouter provider display names (case-sensitive).
_PROVIDER_FALLBACKS: dict[str, list[str]] = {
    "deepseek/deepseek-v4-flash": ["Fireworks", "Together", "Novita"],
    "deepseek/deepseek-v4-pro":   ["Fireworks", "Together", "Novita"],
    "qwen/qwen3-235b-a22b-2507":  ["Fireworks", "Together", "Nebius"],
    "qwen/qwen3-30b-a3b":         ["Fireworks", "Together", "Nebius"],
    "moonshotai/kimi-k2.5":       ["Together", "Fireworks"],
    "xiaomi/mimo-v2-flash":       ["Together", "Fireworks", "Novita"],
}


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
        max_retries: int = 4,
        fallback_model: Optional[str] = None,
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
            logger.info(
                "Prompt cache HIT for model=%s (question likely identical to a previous student's answer)",
                model,
            )
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
        consecutive_429s = 0       # resets on any non-429 response
        active_model = model       # may switch to fallback_model on 2nd 429
        provider_override: list[str] | None = None  # set after 2nd 429 if no fallback

        for attempt in range(max_retries + 1):
            t0 = time.monotonic()
            try:
                request_body = body.copy()
                request_body["model"] = active_model

                # Add provider routing override when triggered
                if provider_override:
                    request_body["provider"] = {
                        "order": provider_override,
                        "allow_fallbacks": True,
                    }

                if json_schema is not None and attempt > 0:
                    request_body["messages"] = _with_json_retry_hint(
                        request_body["messages"], json_schema
                    )

                resp = await self._client.post(
                    f"{self._base_url}/chat/completions",
                    headers=headers,
                    json=request_body,
                )

                # ---- 429 handling ----
                if resp.status_code == 429:
                    retry_after = _parse_retry_after(resp)
                    consecutive_429s += 1

                    if consecutive_429s >= 2:
                        # Second consecutive 429 — escalate model or provider
                        if fallback_model and active_model != fallback_model:
                            logger.warning(
                                "OpenRouter 429×2 for model=%s — switching to "
                                "fallback_model=%s",
                                active_model, fallback_model,
                            )
                            active_model = fallback_model
                            body["model"] = active_model
                            provider_override = None   # reset provider for new model
                        elif provider_override is None:
                            # No fallback model — try alternative providers
                            alts = _PROVIDER_FALLBACKS.get(active_model, [])
                            if alts:
                                provider_override = alts
                                logger.warning(
                                    "OpenRouter 429×2 for model=%s — adding "
                                    "provider override: %s",
                                    active_model, alts,
                                )
                            else:
                                logger.warning(
                                    "OpenRouter 429×2 for model=%s — no provider "
                                    "fallback available, backing off",
                                    active_model,
                                )
                    else:
                        logger.warning(
                            "OpenRouter 429 for model=%s (attempt %d/%d), "
                            "backing off %.1fs",
                            active_model, attempt + 1, max_retries + 1, retry_after,
                        )

                    last_err = httpx.HTTPStatusError(
                        "429 Too Many Requests", request=resp.request, response=resp
                    )
                    if attempt < max_retries:
                        import asyncio as _asyncio
                        await _asyncio.sleep(retry_after)
                    continue

                # Non-429: reset consecutive counter
                consecutive_429s = 0

                resp.raise_for_status()
                data = resp.json()
                latency_ms = int((time.monotonic() - t0) * 1000)

                choices = data.get("choices") or []
                if not choices:
                    raise RuntimeError("OpenRouter returned no choices")
                content = choices[0].get("message", {}).get("content")

                # content may be None — switch to fallback_model immediately on first occurrence
                if content is None or (isinstance(content, str) and content.strip() == ""):
                    if fallback_model and active_model != fallback_model:
                        logger.warning(
                            "OpenRouter null/empty content for model=%s (attempt %d) — "
                            "switching immediately to fallback_model=%s",
                            active_model, attempt + 1, fallback_model,
                        )
                        active_model = fallback_model
                        provider_override = None  # reset provider routing for new model
                    else:
                        logger.warning(
                            "OpenRouter null/empty content for model=%s (attempt %d)",
                            active_model, attempt + 1,
                        )
                    if attempt < max_retries:
                        await _backoff(attempt)
                        last_err = RuntimeError(f"Null content from {active_model}")
                        continue
                    content = ""

                if json_schema is not None and isinstance(content, str) and not _looks_like_json_object(content):
                    logger.warning(
                        "OpenRouter non-object content for model=%s (attempt %d): %s",
                        active_model, attempt + 1, content[:120],
                    )
                    if attempt < max_retries:
                        await _backoff(attempt)
                        last_err = RuntimeError(f"Non-object JSON from {active_model}")
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
                    "model": active_model,
                }

                if use_cache and (json_schema is None or _looks_like_json_object(str(content))):
                    _prompt_cache[ck] = result

                return result

            except (httpx.HTTPStatusError, httpx.ReadTimeout, KeyError) as e:
                last_err = e
                logger.warning(
                    "OpenRouter attempt %d/%d failed for model=%s: %s",
                    attempt + 1, max_retries + 1, active_model, e,
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
    # Exponential backoff: 5s, 10s, 20s, 40s … capped at 60s
    await asyncio.sleep(min(5 * (2 ** attempt), 60))


def _parse_retry_after(response: httpx.Response) -> float:
    """Return seconds to wait from a 429 response's Retry-After header, or a safe default."""
    header = response.headers.get("retry-after") or response.headers.get("x-ratelimit-reset-requests")
    if header:
        try:
            return max(float(header), 5.0)
        except ValueError:
            pass
    return 30.0  # conservative default — OpenRouter rate limits typically reset in 30–60s


# Singleton
_client = None


def get_openrouter_client() -> OpenRouterClient:
    global _client
    if _client is None:
        _client = OpenRouterClient()
    return _client
