import hashlib
from collections import OrderedDict
from datetime import datetime, timezone

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field

from app import exports
from app.agents import advocate, lawyer
from app.agents.inspector import Issue, inspect
from app.config import settings
from app.gemma import GemmaError
from app.statutes import va_code_lookup

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


class LawyerRequest(BaseModel):
    issues: list[Issue]


@app.post("/lawyer")
def lawyer_review(body: LawyerRequest) -> dict:
    if len(body.issues) > 20:
        raise HTTPException(413, "Too many issues in one request (max 20)")
    try:
        return lawyer.analyze(body.issues).model_dump()
    except GemmaError as e:
        raise HTTPException(502, str(e)) from e


@app.get("/statutes/{section}")
def statute(section: str) -> dict:
    found = va_code_lookup(section)
    if not found:
        raise HTTPException(404, "We only cite the Virginia Code sections we have cached")
    return found


# Drafts live in memory until the Firestore case store lands. Capped so it can't grow forever.
DRAFTS: OrderedDict[str, advocate.Draft] = OrderedDict()
MAX_DRAFTS = 200


class AdvocateRequest(BaseModel):
    issues: list[Issue] = Field(max_length=20)
    findings: list[lawyer.LegalFinding] = Field(max_length=20)
    tenant: advocate.TenantInfo = advocate.TenantInfo()


class ApproveRequest(BaseModel):
    letter_text: str | None = Field(None, max_length=20_000)  # the tenant's edits, if any


def _get_draft(draft_id: str) -> advocate.Draft:
    found = DRAFTS.get(draft_id)
    if not found:
        raise HTTPException(404, "Draft not found (drafts are kept in memory for now)")
    return found


@app.post("/advocate")
def advocate_draft(body: AdvocateRequest) -> dict:
    if not body.issues:
        raise HTTPException(400, "No issues to write about")
    try:
        result = advocate.draft(body.issues, body.findings, body.tenant)
    except GemmaError as e:
        raise HTTPException(502, str(e)) from e
    DRAFTS[result.id] = result
    while len(DRAFTS) > MAX_DRAFTS:
        DRAFTS.popitem(last=False)
    return result.model_dump()


@app.post("/advocate/{draft_id}/approve")
def advocate_approve(draft_id: str, body: ApproveRequest) -> dict:
    found = _get_draft(draft_id)
    if body.letter_text is not None and body.letter_text.strip():
        found.letter_text = body.letter_text
    found.approved = True
    found.approved_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return found.model_dump()


EXPORTS = {
    "letter.pdf": ("application/pdf", lambda d: exports.letter_pdf(d.letter_text)),
    "complaint.pdf": ("application/pdf", lambda d: exports.complaint_pdf(d.complaint)),
    "deadlines.ics": ("text/calendar", lambda d: exports.deadlines_ics(d.id, d.deadlines)),
}


@app.get("/advocate/{draft_id}/export/{kind}")
def advocate_export(draft_id: str, kind: str) -> Response:
    found = _get_draft(draft_id)
    if not found.approved:
        raise HTTPException(403, "Approve the draft before exporting")
    if kind not in EXPORTS:
        raise HTTPException(404, f"Unknown export. Options: {', '.join(EXPORTS)}")
    media_type, render = EXPORTS[kind]
    return Response(
        render(found),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="homecrew-{kind}"'},
    )
