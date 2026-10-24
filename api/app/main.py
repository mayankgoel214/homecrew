from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import exports
from app.agents import advocate, lawyer
from app.agents.inspector import inspect
from app.config import settings
from app.gemma import GemmaError
from app.statutes import va_code_lookup
from app.store import Case, ledger_export, now, store

MAX_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FRAMES = 40
MAX_ISSUES = 25

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


@app.get("/statutes/{section}")
def statute(section: str) -> dict:
    found = va_code_lookup(section)
    if not found:
        raise HTTPException(404, "We only cite the Virginia Code sections we have cached")
    return found


# ---- cases -------------------------------------------------------------------------------


def _case(case_id: str) -> Case:
    try:
        return store.get(case_id)
    except KeyError:
        raise HTTPException(404, "Case not found") from None


def _update(case_id: str, change) -> Case:
    try:
        return store.update(case_id, change)
    except KeyError:
        raise HTTPException(404, "Case not found") from None


def _frame(case: Case, frame_id: str):
    for f in case.frames:
        if f.id == frame_id:
            return f
    raise HTTPException(404, "Frame not found")


@app.post("/cases")
def create_case() -> dict:
    return store.create().model_dump()


@app.get("/cases/{case_id}")
def get_case(case_id: str) -> dict:
    return _case(case_id).model_dump()


@app.post("/cases/{case_id}/frames")
async def add_frame(
    case_id: str,
    frame: UploadFile = File(...),
    client_sha256: str = Form(""),
    captured_at: str = Form(""),
    notes: str = Form(""),
) -> dict:
    case = _case(case_id)
    if len(case.frames) >= MAX_FRAMES:
        raise HTTPException(413, f"A case can hold up to {MAX_FRAMES} photos")
    if frame.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Send a JPEG, PNG or WebP image")
    data = await frame.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image too large (max 8 MB)")
    try:
        result = inspect(data, notes=notes, mime_type=frame.content_type)
    except GemmaError as e:
        raise HTTPException(502, str(e)) from e
    case, added = store.add_frame(
        case_id, data, client_sha256, captured_at[:40] or None, result.room_guess, result.issues, result.model
    )
    return {"frame": added.model_dump(), "ledger_entry": case.ledger[-1].model_dump()}


@app.get("/cases/{case_id}/frames/{frame_id}/image")
def frame_image(case_id: str, frame_id: str) -> Response:
    try:
        data = store.frame_bytes(case_id, frame_id)
    except KeyError:
        raise HTTPException(404, "Frame not found") from None
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})


class FrameUpdate(BaseModel):
    removed: bool | None = None
    dismissed: list[int] | None = Field(None, max_length=50)


@app.patch("/cases/{case_id}/frames/{frame_id}")
def update_frame(case_id: str, frame_id: str, body: FrameUpdate) -> dict:
    """Tenant corrections: remove a photo from the case, or mark findings as not a problem.
    The ledger entry is never deleted."""

    def change(case: Case):
        f = _frame(case, frame_id)
        if body.removed is not None:
            f.removed = body.removed
        if body.dismissed is not None:
            f.dismissed = sorted({i for i in body.dismissed if 0 <= i < len(f.issues)})
        case.invalidate()

    return _update(case_id, change).model_dump()


@app.get("/cases/{case_id}/verify")
def verify_case(case_id: str) -> dict:
    try:
        return store.verify(case_id)
    except KeyError:
        raise HTTPException(404, "Case not found") from None


@app.post("/cases/{case_id}/lawyer")
def case_lawyer(case_id: str) -> dict:
    issues, refs = _case(case_id).active_issues()
    if not issues:
        raise HTTPException(400, "No findings in this case yet")
    if len(issues) > MAX_ISSUES:
        raise HTTPException(413, f"Too many findings ({len(issues)}); dismiss some (max {MAX_ISSUES})")
    try:
        result = lawyer.analyze(issues)
    except GemmaError as e:
        raise HTTPException(502, str(e)) from e

    def change(case: Case):
        case.legal, case.legal_refs, case.draft = result, refs, None

    return _update(case_id, change).model_dump()


@app.post("/cases/{case_id}/advocate")
def case_advocate(case_id: str, tenant: advocate.TenantInfo) -> dict:
    case = _case(case_id)
    if not case.legal:
        raise HTTPException(409, "Run the legal review first")
    issues, _ = case.active_issues()
    try:
        result = advocate.draft(issues, case.legal.findings, tenant)
    except GemmaError as e:
        raise HTTPException(502, str(e)) from e

    def change(c: Case):
        c.draft = result

    return _update(case_id, change).model_dump()


class ApproveRequest(BaseModel):
    letter_text: str | None = Field(None, max_length=20_000)  # the tenant's edits, if any


@app.post("/cases/{case_id}/approve")
def case_approve(case_id: str, body: ApproveRequest) -> dict:
    def change(case: Case):
        if not case.draft:
            raise HTTPException(409, "Nothing to approve yet")
        if body.letter_text and body.letter_text.strip():
            case.draft.letter_text = body.letter_text
        case.draft.approved = True
        case.draft.approved_at = now()

    return _update(case_id, change).model_dump()


EXPORTS = {
    "letter.pdf": ("application/pdf", lambda c: exports.letter_pdf(c.draft.letter_text)),
    "complaint.pdf": ("application/pdf", lambda c: exports.complaint_pdf(c.draft.complaint)),
    "deadlines.ics": ("text/calendar", lambda c: exports.deadlines_ics(c.draft.id, c.draft.deadlines)),
}


@app.get("/cases/{case_id}/export/{kind}")
def case_export(case_id: str, kind: str) -> Response:
    case = _case(case_id)
    if kind == "evidence.json":  # the tenant's own evidence record; no approval needed
        body, media_type = ledger_export(case, store.verify(case_id)), "application/json"
    elif kind in EXPORTS:
        if not case.draft or not case.draft.approved:
            raise HTTPException(403, "Approve the draft before exporting")
        media_type, render = EXPORTS[kind]
        body = render(case)
    else:
        raise HTTPException(404, f"Unknown export. Options: evidence.json, {', '.join(EXPORTS)}")
    return Response(
        body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="homecrew-{kind}"'},
    )
