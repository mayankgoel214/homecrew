"""Human voices for the crew via Cartesia text-to-speech. The API key stays on the server; the
browser asks /tts for a line and plays the MP3 it gets back."""

import hashlib
from collections import OrderedDict

import httpx

from app import trades
from app.config import settings

VOICES = {
    "inspector": lambda: settings.cartesia_voice_inspector,
    "lawyer": lambda: settings.cartesia_voice_lawyer,
    "advocate": lambda: settings.cartesia_voice_advocate,
}
MAX_CHARS = 400
# Lines repeat (greetings, "Got it, that's going in your repair letter"), so keep recent audio.
_cache: OrderedDict[str, bytes] = OrderedDict()
CACHE_SIZE = 200


class VoiceUnavailable(RuntimeError):
    pass


def synthesize(agent: str, text: str, trade: str | None = None) -> bytes:
    if not settings.cartesia_api_key:
        raise VoiceUnavailable("Voice isn't configured")
    if agent not in VOICES:
        raise ValueError("Unknown crew member")
    text = " ".join(text.split())[:MAX_CHARS]
    voice = trades.get(trade).voice if agent == "inspector" and trade else VOICES[agent]()
    key = hashlib.sha256(f"{voice}|{settings.cartesia_model}|{text}".encode()).hexdigest()
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]
    try:
        r = httpx.post(
            "https://api.cartesia.ai/tts/bytes",
            headers={"X-API-Key": settings.cartesia_api_key, "Cartesia-Version": settings.cartesia_version},
            json={
                "model_id": settings.cartesia_model,
                "transcript": text,
                "voice": {"mode": "id", "id": voice},
                "output_format": {"container": "mp3", "sample_rate": 44100, "bit_rate": 128000},
                "language": "en",
            },
            timeout=20,
        )
    except httpx.HTTPError as e:
        raise VoiceUnavailable(f"Voice service unreachable: {e}") from e
    if r.status_code != 200:
        raise VoiceUnavailable(f"Voice service error {r.status_code}")
    _cache[key] = r.content
    while len(_cache) > CACHE_SIZE:
        _cache.popitem(last=False)
    return r.content
