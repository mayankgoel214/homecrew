import asyncio
import json
from pathlib import Path
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import crew, exports, safety, trades
from app.agents import advocate, lawyer
from app.agents.inspector import inspect
from app.config import settings
from app.gemma import GemmaError, generate_json
from app.ratelimit import fingerprint, rate_limit, visitor_ip
from app.statutes import va_code_lookup
from app.store import Case, ledger_export, now, store
from app.voice import VoiceUnavailable, synthesize

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


class SpeakRequest(BaseModel):
    agent: str
    text: str = Field(max_length=600)
    trade: str | None = None  # the expert's voice depends on which trade was called


@app.post("/tts", dependencies=[Depends(rate_limit("tts"))])
def tts(body: SpeakRequest) -> Response:
    """One crew line as MP3. 503 when voice isn't configured, so the browser falls back."""
    try:
        audio = synthesize(body.agent, body.text, body.trade)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except VoiceUnavailable as e:
        raise HTTPException(503, str(e)) from e
    return Response(audio, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=86400"})


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


@app.post("/cases", dependencies=[Depends(rate_limit("case"))])
def create_case(request: Request) -> dict:
    print(f"case_created visitor={fingerprint(visitor_ip(request))}")
    return store.create().model_dump()


@app.get("/cases/{case_id}")
def get_case(case_id: str) -> dict:
    return _case(case_id).model_dump()


@app.post("/cases/{case_id}/frames", dependencies=[Depends(rate_limit("upload"))])
async def add_frame(
    case_id: str,
    frame: UploadFile = File(...),
    client_sha256: str = Form(""),
    captured_at: str = Form(""),
    notes: str = Form(""),
    live: bool = Form(False),  # sent automatically by the live call, not a deliberate snapshot
) -> dict:
    case = _case(case_id)
    if len(case.frames) >= MAX_FRAMES:
        raise HTTPException(413, f"A case can hold up to {MAX_FRAMES} photos")
    if frame.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Send a JPEG, PNG or WebP image")
    data = await frame.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image too large (max 8 MB)")
    photo_number = len(case.frames) + 1
    # This endpoint is async (for the upload), so blocking work goes to a thread. Calling Gemma
    # directly here would freeze the event loop: no chat streaming, and uploads would queue.
    if not live:
        await asyncio.to_thread(crew.inspector_looking, case_id, photo_number)
    trade = trades.get(case.trade)
    expert = (f"You are {trade.name}, a {trade.role.lower()} on a live video call with someone in their home. "
              f"Pay special attention to {trade.focus}, but still report any clear safety problem you see.")
    try:
        result = await asyncio.to_thread(inspect, data, notes, frame.content_type, expert)
    except GemmaError as e:
        if not live:  # a dropped live frame isn't worth interrupting the call for
            await asyncio.to_thread(
                store.post, case_id, "inspector", f"I couldn't analyze photo #{photo_number}: {e}", "error")
        raise HTTPException(502, str(e)) from e

    for issue in result.issues:  # the safety router labels every finding before anyone gives advice
        issue.type = safety.correct_type(issue.type, issue.label, issue.evidence_note)
        issue.safety = safety.classify(issue.type, issue.label, issue.evidence_note, issue.severity, case.renter)

    # Re-read: another frame (a tapped snapshot, say) may have been recorded while Gemma was looking.
    if live and not _worth_keeping(await asyncio.to_thread(_case, case_id), result.issues):
        if not result.issues and _quiet_for(case, "inspector", LIVE_CLEAN_COMMENT_SECONDS):
            await asyncio.to_thread(crew.inspector_report, case_id, "", 0, result.room_guess, [], result.say)
        return {"kept": False, "issues": [i.model_dump() for i in result.issues], "say": result.say}

    case, added = await asyncio.to_thread(
        store.add_frame,
        case_id, data, client_sha256, captured_at[:40] or None, result.room_guess, result.issues, result.model,
    )
    await asyncio.to_thread(
        crew.inspector_report, case_id, added.id, photo_number, result.room_guess, result.issues, result.say)
    if result.issues:  # live capture or a tapped snapshot: Theo and June answer either way
        await asyncio.to_thread(crew.lawyer_quick_take, case_id, result.issues)
    return {"kept": True, "frame": added.model_dump(), "ledger_entry": case.ledger[-1].model_dump(),
            "issues": [i.model_dump() for i in result.issues], "say": result.say}


LIVE_DUPLICATE_SECONDS = 60
LIVE_CLEAN_COMMENT_SECONDS = 75


def _seconds_since(iso: str) -> float:
    return (datetime.now(timezone.utc) - datetime.fromisoformat(iso)).total_seconds()


def _worth_keeping(case: Case, issues) -> bool:
    """Live frames only become evidence if they show a kind of problem we haven't recorded in the
    last LIVE_DUPLICATE_SECONDS (the camera lingers on the same mold for several frames)."""
    if not issues:
        return False
    recent: set[str] = set()
    for f in case.frames:
        received = case.ledger[f.seq].received_at
        if case.call_started_at and received < case.call_started_at:
            continue  # an earlier call (or take) doesn't count
        if not f.removed and _seconds_since(received) < LIVE_DUPLICATE_SECONDS:
            recent |= {i.type for n, i in enumerate(f.issues) if n not in f.dismissed}
    return not {i.type for i in issues} <= recent


def _quiet_for(case: Case, agent: str, seconds: float) -> bool:
    said = [m for m in case.chat if m.agent == agent and m.kind == "message"]
    return not said or _seconds_since(said[-1].ts) > seconds


def _next_checklist_item(case_id: str) -> None:
    """Move the expert's walk-through on ("Next, could you show me the thermostat?")."""
    step = {}

    def change(case: Case):
        case.checklist_step += 1
        step.update(trade=case.trade, n=case.checklist_step)

    _update(case_id, change)
    crew.checklist_prompt(case_id, step["trade"], step["n"])


class CallStart(BaseModel):
    trade: str = "general"
    renter: bool = True
    problem: str = Field("", max_length=300)  # what they typed, when routed from a description


@app.post("/cases/{case_id}/call/start")
def call_start(case_id: str, body: CallStart | None = None) -> dict:
    body = body or CallStart()

    def change(case: Case):
        case.trade = trades.get(body.trade).id
        case.renter = body.renter
        case.checklist_step = 0
        case.call_seq = len(case.chat)  # each call is its own conversation
        case.call_started_at = datetime.now(timezone.utc).isoformat()  # sub-second, so back-to-back takes stay apart

    case = _update(case_id, change)
    crew.greet(case_id, case.trade, case.renter, body.problem)  # the expert says hello
    return {"ok": True, "trade": case.trade, "renter": case.renter}


@app.post("/cases/{case_id}/call/end")
def call_end(case_id: str) -> dict:
    case = _case(case_id)
    issues, _ = case.active_issues()
    crew.call_ended(case_id, len(issues), case.renter)
    return {"findings": len(issues), "renter": case.renter}


class RouteRequest(BaseModel):
    text: str = Field(max_length=300)


@app.post("/route")
def route(body: RouteRequest) -> dict:
    """'My sink won't drain' -> the plumber. Emergencies are caught first. Keyword rules decide;
    no model call, so it's instant and predictable."""
    text = " ".join(body.text.split())
    if e := safety.emergency_in(text):
        return {"emergency": e.kind, "title": e.title, "steps": e.steps}
    trade = trades.route(text)
    return {"trade": trade.id, "name": trade.name, "role": trade.role}


class AskRequest(BaseModel):
    text: str = Field(max_length=400)


ASK_PROMPT = (Path(__file__).parent / "prompts" / "ask.md").read_text()


@app.post("/cases/{case_id}/ask", dependencies=[Depends(rate_limit("ask"))])
def ask(case_id: str, body: AskRequest) -> dict:
    """The tenant asks the expert something out loud. Emergencies and never-DIY jobs are answered
    by fixed rules before any model sees the question; the model's answer is checked again after."""
    case = _case(case_id)
    question = " ".join(body.text.split())
    if not question:
        raise HTTPException(400, "Say something first")
    store.post(case_id, "you", question)

    if e := safety.emergency_in(question):
        crew.emergency(case_id, e)
        return {"answer": e.title, "emergency": e.kind}
    if refusal := safety.refuse_reason(question):
        store.post(case_id, "inspector", refusal, refs={"tier": "pro"})
        return {"answer": refusal, "refused": True}

    trade = trades.get(case.trade)
    issues, _ = case.active_issues()
    findings = "\n".join(f"- {i.label} ({(i.safety or {}).get('tier', 'unrated')})" for i in issues) or "- none yet"
    prompt = (ASK_PROMPT.replace("{{NAME}}", trade.name).replace("{{ROLE}}", trade.role.lower())
              .replace("{{HOME}}", "a rented apartment in Virginia" if case.renter else "their own home in Virginia")
              .replace("{{FINDINGS}}", findings).replace("{{QUESTION}}", question.replace('"', "'"))
              .replace("{{TENANCY}}", "They rent: if something is the landlord's responsibility, say so." if case.renter
                       else "They own the home, so there's no landlord to call."))
    try:
        raw, _ = generate_json(prompt)
        answer = " ".join(str((raw or {}).get("say", "")).split())[:400] if isinstance(raw, dict) else ""
    except GemmaError:
        answer = ""
    if not answer:
        answer = "Sorry, I didn't catch that. Could you ask again, or show me what you mean?"
    elif safety.NEVER_DIY.search(answer) and "professional" not in answer.lower():
        answer = safety.refuse_reason(answer) or answer  # belt and braces on the model's reply
    store.post(case_id, "inspector", answer)
    return {"answer": answer}


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

    said: list[str] = []
    reset = False

    def change(case: Case):
        nonlocal reset
        said.clear()  # a Firestore transaction may run this more than once
        f = _frame(case, frame_id)
        if body.removed is not None and body.removed != f.removed:
            f.removed = body.removed
            said.append(f"{'Removed' if f.removed else 'Restored'} photo #{f.seq + 1}.")
        if body.dismissed is not None:
            new = sorted({i for i in body.dismissed if 0 <= i < len(f.issues)})
            for i in set(new) - set(f.dismissed):
                said.append(f"\"{f.issues[i].label}\" in photo #{f.seq + 1} is not a problem.")
            for i in set(f.dismissed) - set(new):
                said.append(f"Include \"{f.issues[i].label}\" in photo #{f.seq + 1} again.")
            f.dismissed = new
        reset = bool(said) and (case.legal is not None or case.draft is not None)
        if said:
            case.invalidate()

    updated = _update(case_id, change)
    for line in said:
        store.post(case_id, "you", line, refs={"frame_id": frame_id})
    if reset:
        store.post(case_id, "system", "The evidence changed, so the legal review and paperwork need to be redone.")
    return updated.model_dump()


@app.get("/cases/{case_id}/verify")
def verify_case(case_id: str) -> dict:
    try:
        return store.verify(case_id)
    except KeyError:
        raise HTTPException(404, "Case not found") from None


@app.post("/cases/{case_id}/lawyer", dependencies=[Depends(rate_limit("lawyer"))])
def case_lawyer(case_id: str) -> dict:
    issues, refs = _case(case_id).landlord_issues()
    if not issues:
        raise HTTPException(400, "Nothing here for your landlord to fix")
    if len(issues) > MAX_ISSUES:
        raise HTTPException(413, f"Too many findings ({len(issues)}); dismiss some (max {MAX_ISSUES})")
    store.post(case_id, "lawyer", f"Reviewing {len(issues)} finding{'s' if len(issues) != 1 else ''}…", kind="status")
    try:
        result = lawyer.analyze(issues, on_event=crew.lawyer_event(case_id))
    except GemmaError as e:
        store.post(case_id, "lawyer", f"I couldn't finish the legal review: {e}", kind="error")
        raise HTTPException(502, str(e)) from e

    stale = False

    def change(case: Case):
        nonlocal stale
        stale = False  # reset on transaction retries
        # Photos may have been added or findings dismissed while Gemma was working. Saving this
        # review would then pair the wrong findings with the wrong statutes, so drop it.
        if case.landlord_issues()[1] != refs:
            stale = True
            return
        case.legal, case.legal_refs, case.draft = result, refs, None

    _update(case_id, change)
    if stale:
        store.post(case_id, "system", "The evidence changed during the legal review, so it was discarded. Run it again.")
        raise HTTPException(409, "The evidence changed during the review. Please run it again.")
    crew.lawyer_report(case_id, result)
    return _case(case_id).model_dump()


@app.post("/cases/{case_id}/advocate", dependencies=[Depends(rate_limit("advocate"))])
def case_advocate(case_id: str, tenant: advocate.TenantInfo) -> dict:
    case = _case(case_id)
    if not case.legal:
        raise HTTPException(409, "Run the legal review first")
    issues, refs = case.landlord_issues()
    if refs != case.legal_refs:
        raise HTTPException(409, "The evidence changed since the legal review. Run it again.")
    store.post(case_id, "advocate", "Drafting your letter and complaint…", kind="status")
    try:
        result = advocate.draft(issues, case.legal.findings, tenant)
    except GemmaError as e:
        store.post(case_id, "advocate", f"I couldn't draft the paperwork: {e}", kind="error")
        raise HTTPException(502, str(e)) from e

    def change(c: Case):
        c.draft = result

    _update(case_id, change)
    crew.advocate_report(case_id, result)
    return _case(case_id).model_dump()


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

    _update(case_id, change)
    crew.approved(case_id)
    return _case(case_id).model_dump()


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


# ---- crew chat stream ------------------------------------------------------------------------

HEARTBEAT_SECONDS = 15
# Each stream ends after this long and the browser reconnects (EventSource does it on its own,
# resuming from Last-Event-ID). Without it, server reloads hang on open streams and hosting
# platforms cut long requests anyway.
STREAM_MAX_SECONDS = 25


@app.get("/cases/{case_id}/stream")
async def stream(case_id: str, request: Request, after: int = -1) -> StreamingResponse:
    """Server-Sent Events: every crew chat message, then new ones as agents post them.
    Reconnecting browsers send Last-Event-ID, so nothing is shown twice."""
    _case(case_id)
    last = int(request.headers.get("last-event-id", after))

    async def events():
        nonlocal last
        quiet, waited = 0.0, 0.0
        yield "retry: 1000\n\n"
        while waited < STREAM_MAX_SECONDS and not await request.is_disconnected():
            case = await asyncio.to_thread(store.get, case_id)
            fresh = [m for m in case.chat if m.seq > last]
            for m in fresh:
                last = m.seq
                yield f"id: {m.seq}\nevent: chat\ndata: {json.dumps(m.model_dump())}\n\n"
            quiet = 0.0 if fresh else quiet + store.poll_seconds
            if quiet >= HEARTBEAT_SECONDS:
                quiet = 0.0
                yield ": keep-alive\n\n"
            await asyncio.sleep(store.poll_seconds)
            waited += store.poll_seconds

    return StreamingResponse(events(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
    })
