"""
HKUST CSE Exam Platform – Robust JSON Extraction

Handles common LLM output issues:
- content is None
- response wrapped in markdown fences
- response is a bare number, string, or array instead of dict
- truncated JSON (unterminated strings)
- extra text before/after JSON
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

logger = logging.getLogger(__name__)


def extract_json_dict(raw: Optional[str], *, context: str = "") -> dict[str, Any]:
    """
    Best-effort extraction of a JSON dict from an LLM response string.

    Raises ValueError if no valid dict can be extracted.
    """
    if raw is None:
        raise ValueError("LLM returned None content")

    if not isinstance(raw, str):
        raw = str(raw)

    text = raw.strip()
    if not text:
        raise ValueError("LLM returned empty content")

    # 1. Strip markdown code fences
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    # 2. Try direct parse
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
        # If a bare number or string, not a dict – fall through to brace search
        if isinstance(data, (int, float)):
            logger.info("LLM returned bare number (%s) instead of JSON dict for %s", data, context)
            # Fall through – maybe there's a JSON dict later in the text
        elif isinstance(data, str):
            logger.info("LLM returned bare string instead of JSON dict for %s", context)
        else:
            raise ValueError(f"Parsed JSON is {type(data).__name__}, not dict")
    except (json.JSONDecodeError, ValueError):
        pass

    # 3. Find the first { ... } block (greedy)
    brace_match = re.search(r"\{", text)
    if brace_match:
        start = brace_match.start()
        # Find matching closing brace
        depth = 0
        in_string = False
        escape = False
        end = start
        for i in range(start, len(text)):
            c = text[i]
            if escape:
                escape = False
                continue
            if c == '\\' and in_string:
                escape = True
                continue
            if c == '"' and not escape:
                in_string = not in_string
                continue
            if in_string:
                continue
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break

        candidate = text[start:end]
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

        # 4. Try to repair truncated JSON by closing open strings/braces
        repaired = _repair_truncated(candidate)
        if repaired:
            try:
                data = json.loads(repaired)
                if isinstance(data, dict):
                    logger.info("Repaired truncated JSON for %s", context)
                    return data
            except json.JSONDecodeError:
                pass

    raise ValueError(f"Could not extract JSON dict from LLM response: {text[:200]}...")


def _repair_truncated(text: str) -> Optional[str]:
    """Try to close an unterminated JSON string by adding missing quotes and braces."""
    # Count unclosed quotes
    in_string = False
    escape = False
    open_braces = 0
    open_brackets = 0

    for c in text:
        if escape:
            escape = False
            continue
        if c == '\\' and in_string:
            escape = True
            continue
        if c == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if c == '{':
            open_braces += 1
        elif c == '}':
            open_braces -= 1
        elif c == '[':
            open_brackets += 1
        elif c == ']':
            open_brackets -= 1

    # Close unclosed string
    result = text
    if in_string:
        result += '"'

    # Close unclosed brackets then braces
    result += ']' * max(0, open_brackets)
    result += '}' * max(0, open_braces)

    return result if result != text else None
