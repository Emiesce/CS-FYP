"""
Redis client & Pub/Sub helpers for the proctoring alert pipeline.

Channel naming convention:
  exam:{exam_id}:alerts  –  live proctoring events for a running exam

Usage:
  # Publish (student sync path)
  await publish_alert(exam_id, alert_payload_dict)

  # Subscribe (staff WebSocket path)
  async with subscribe_alerts(exam_id) as pubsub:
      async for message in pubsub.listen():
          ...
"""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import redis.asyncio as aioredis

# ---------------------------------------------------------------------------
# Connection pool (created once, reused across requests)
# ---------------------------------------------------------------------------

_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

_pool: aioredis.ConnectionPool | None = None


def get_pool() -> aioredis.ConnectionPool:
    """Return the singleton connection pool, creating it on first call."""
    global _pool
    if _pool is None:
        _pool = aioredis.ConnectionPool.from_url(
            _REDIS_URL,
            max_connections=20,
            decode_responses=True,
        )
    return _pool


def get_client() -> aioredis.Redis:
    """Return an async Redis client backed by the shared pool."""
    return aioredis.Redis(connection_pool=get_pool())


async def close_pool() -> None:
    """Gracefully disconnect the pool (call from FastAPI lifespan shutdown)."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


# ---------------------------------------------------------------------------
# Channel helpers
# ---------------------------------------------------------------------------

def _alert_channel(exam_id: str) -> str:
    return f"exam:{exam_id}:alerts"


async def publish_alert(exam_id: str, payload: dict) -> None:
    """Publish a proctoring alert dict to the exam-specific Redis channel."""
    client = get_client()
    await client.publish(_alert_channel(exam_id), json.dumps(payload))
    await client.aclose()


@asynccontextmanager
async def subscribe_alerts(exam_id: str) -> AsyncGenerator[aioredis.client.PubSub, None]:
    """
    Async context manager that subscribes to exam:{exam_id}:alerts.

    Yields the PubSub object so callers can iterate over messages.
    Automatically unsubscribes and closes on exit.
    """
    client = aioredis.Redis.from_url(_REDIS_URL, decode_responses=True)
    pubsub = client.pubsub()
    await pubsub.subscribe(_alert_channel(exam_id))
    try:
        yield pubsub
    finally:
        await pubsub.unsubscribe(_alert_channel(exam_id))
        await pubsub.aclose()
        await client.aclose()
