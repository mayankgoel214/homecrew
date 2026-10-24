import hashlib

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.agents.inspector import inspect
from app.config import settings
from app.gemma import GemmaError

MAX_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

app = FastAPI(title="HomeCrew API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "model": settings.ollama_model if settings.ollama else settings.gemma_model,
        "gemma_key_set": bool(settings.gemini_api_key) or settings.ollama,
    }


@app.post("/inspect")
async def inspect_frame(
    frame: UploadFile = File(...),
    client_sha256: str = Form(""),
    notes: str = Form(""),
) -> dict:
    if frame.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Send a JPEG, PNG or WebP image")
    data = await frame.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image too large (max 8 MB)")

    server_sha256 = hashlib.sha256(data).hexdigest()
    try:
        result = inspect(data, notes=notes, mime_type=frame.content_type)
    except GemmaError as e:
        raise HTTPException(502, str(e)) from e

    return {
        **result.model_dump(),
        "sha256": server_sha256,
        "hash_match": client_sha256.lower() == server_sha256 if client_sha256 else None,
    }
