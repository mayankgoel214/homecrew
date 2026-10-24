"""Thin Gemma 4 client: image + prompt in, parsed JSON out.

Gemma on the Gemini API has no documented strict-JSON mode, so we prompt for JSON,
strip markdown fences, parse, and retry once with a stricter reminder. On rate limits
or server errors we fall back to the smaller Gemma 4 model, and OLLAMA=1 runs everything
against a local Gemma 4 instead.
"""

import base64
import json
import re
from dataclasses import dataclass

import httpx
from google import genai
from google.genai import errors, types

from app.config import settings

FALLBACK_MODEL = "gemma-4-26b-a4b-it"
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)

_client: genai.Client | None = None


class GemmaError(RuntimeError):
    pass


@dataclass
class Image:
    data: bytes
    mime_type: str = "image/jpeg"


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.gemini_api_key:
            raise GemmaError("GEMINI_API_KEY is not set (see api/.env.example)")
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def parse_json(text: str):
    """Pull the first JSON object/array out of a model reply."""
    cleaned = _FENCE.sub("", text.strip()).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    match = re.search(r"(\{.*\}|\[.*\])", cleaned, re.DOTALL)
    if not match:
        raise ValueError("no JSON found in model reply")
    return json.loads(match.group(1))


def _call_gemini(model: str, prompt: str, images: list[Image]) -> str:
    parts = [types.Part.from_bytes(data=i.data, mime_type=i.mime_type) for i in images]
    resp = _get_client().models.generate_content(
        model=model,
        contents=[*parts, prompt],
        config=types.GenerateContentConfig(temperature=0.2),
    )
    return resp.text or ""


def _call_ollama(prompt: str, images: list[Image]) -> str:
    resp = httpx.post(
        f"{settings.ollama_url}/api/chat",
        json={
            "model": settings.ollama_model,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.2},
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                    "images": [base64.b64encode(i.data).decode() for i in images],
                }
            ],
        },
        timeout=180,
    )
    resp.raise_for_status()
    return resp.json()["message"]["content"]


def _generate(prompt: str, images: list[Image]) -> tuple[str, str]:
    """Returns (reply_text, model_used)."""
    if settings.ollama:
        return _call_ollama(prompt, images), settings.ollama_model
    try:
        return _call_gemini(settings.gemma_model, prompt, images), settings.gemma_model
    except errors.APIError as e:
        if e.code in (429, 500, 503) and settings.gemma_model != FALLBACK_MODEL:
            return _call_gemini(FALLBACK_MODEL, prompt, images), FALLBACK_MODEL
        raise GemmaError(f"Gemma API error {e.code}: {e.message}") from e


def generate_json(prompt: str, images: list[Image] | None = None) -> tuple[object, str]:
    """Returns (parsed_json, model_used). Retries once if the reply isn't valid JSON."""
    images = images or []
    text, model = _generate(prompt, images)
    try:
        return parse_json(text), model
    except (ValueError, json.JSONDecodeError):
        retry = prompt + "\n\nYour last reply was not valid JSON. Reply with ONLY the JSON, no prose."
        text, model = _generate(retry, images)
        try:
            return parse_json(text), model
        except (ValueError, json.JSONDecodeError) as e:
            raise GemmaError(f"Gemma returned invalid JSON twice: {text[:200]!r}") from e
