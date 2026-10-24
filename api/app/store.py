"""Case storage: one JSON file plus frame images per case, under uploads/cases/.

Local disk for now so cases survive server reloads during the demo. The interface is small on
purpose (create/get/save + frame bytes) so it can be swapped for Firestore + Cloud Storage.

The evidence ledger is append-only and hash-chained: each entry's hash covers the previous
entry's hash, so editing, reordering or deleting any entry breaks every hash after it.
"""

import hashlib
import json
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from pydantic import BaseModel

from app.agents.advocate import Draft
from app.agents.inspector import Issue
from app.agents.lawyer import LawyerResult

ROOT = Path(__file__).resolve().parent.parent / "uploads" / "cases"
GENESIS = "0" * 64
_ID = re.compile(r"^[0-9a-f]{32}$")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class LedgerEntry(BaseModel):
    seq: int
    frame_id: str
    sha256: str  # computed by the server from the bytes it stored
    client_sha256: str  # computed on the phone before upload
    received_at: str  # server clock, UTC
    captured_at: str | None  # phone clock, as reported
    prev_hash: str
    entry_hash: str


class Frame(BaseModel):
    id: str
    seq: int
    room_guess: str
    issues: list[Issue]
    dismissed: list[int] = []  # issue indexes the tenant marked "not a problem"
    removed: bool = False  # excluded from the case; its ledger entry stays
    model: str


class ChatMessage(BaseModel):
    seq: int
    agent: str  # inspector | lawyer | advocate | you | system
    kind: str = "message"  # message | tool | status | error
    text: str
    refs: dict = {}  # e.g. {"frame_id": ...} or {"section": ...}
    ts: str


class Case(BaseModel):
    id: str
    created_at: str
    frames: list[Frame] = []
    ledger: list[LedgerEntry] = []
    legal: LawyerResult | None = None
    legal_refs: list[dict] = []  # flattened issue index -> {frame_id, issue_index}
    draft: Draft | None = None
    chat: list[ChatMessage] = []

    def active_issues(self) -> tuple[list[Issue], list[dict]]:
        """Issues from frames still in the case, minus dismissed ones, with where each came from."""
        issues, refs = [], []
        for f in self.frames:
            if f.removed:
                continue
            for i, issue in enumerate(f.issues):
                if i not in f.dismissed:
                    issues.append(issue)
                    refs.append({"frame_id": f.id, "issue_index": i})
        return issues, refs

    def invalidate(self) -> None:
        """Evidence changed: the legal review and paperwork must be redone."""
        self.legal, self.legal_refs, self.draft = None, [], None


def entry_hash(case_id: str, seq: int, frame_id: str, sha256: str, received_at: str, prev: str) -> str:
    return hashlib.sha256(f"{case_id}|{seq}|{frame_id}|{sha256}|{received_at}|{prev}".encode()).hexdigest()


class CaseStore:
    def __init__(self, root: Path = ROOT):
        self.root = root
        self._lock = threading.Lock()

    def _dir(self, case_id: str) -> Path:
        if not _ID.match(case_id):  # also blocks path traversal
            raise KeyError(case_id)
        return self.root / case_id

    def create(self) -> Case:
        case = Case(id=uuid4().hex, created_at=now())
        (self._dir(case.id) / "frames").mkdir(parents=True)
        self.save(case)
        return case

    def get(self, case_id: str) -> Case:
        path = self._dir(case_id) / "case.json"
        if not path.exists():
            raise KeyError(case_id)
        return Case.model_validate_json(path.read_text())

    def save(self, case: Case) -> None:
        path = self._dir(case.id) / "case.json"
        tmp = path.with_suffix(".tmp")
        tmp.write_text(case.model_dump_json(indent=1))
        tmp.replace(path)  # atomic, so a crash never leaves half a file

    def add_frame(self, case_id: str, image: bytes, client_sha256: str, captured_at: str | None,
                  room_guess: str, issues: list[Issue], model: str) -> tuple[Case, Frame]:
        with self._lock:
            case = self.get(case_id)
            frame_id = uuid4().hex
            (self._dir(case_id) / "frames" / f"{frame_id}.jpg").write_bytes(image)
            seq = len(case.ledger)
            prev = case.ledger[-1].entry_hash if case.ledger else GENESIS
            sha = hashlib.sha256(image).hexdigest()
            received = now()
            case.ledger.append(LedgerEntry(
                seq=seq, frame_id=frame_id, sha256=sha, client_sha256=client_sha256.lower(),
                received_at=received, captured_at=captured_at, prev_hash=prev,
                entry_hash=entry_hash(case_id, seq, frame_id, sha, received, prev),
            ))
            frame = Frame(id=frame_id, seq=seq, room_guess=room_guess, issues=issues, model=model)
            case.frames.append(frame)
            case.invalidate()
            self.save(case)
            return case, frame

    def update(self, case_id: str, change) -> Case:
        """Load, apply change(case), save, under the lock."""
        with self._lock:
            case = self.get(case_id)
            change(case)
            self.save(case)
            return case

    def post(self, case_id: str, agent: str, text: str, kind: str = "message", refs: dict | None = None) -> None:
        """Append a crew chat message. The SSE stream picks it up from the saved case."""
        with self._lock:
            case = self.get(case_id)
            case.chat.append(ChatMessage(seq=len(case.chat), agent=agent, kind=kind, text=text,
                                         refs=refs or {}, ts=now()))
            self.save(case)

    def frame_bytes(self, case_id: str, frame_id: str) -> bytes:
        if not _ID.match(frame_id):
            raise KeyError(frame_id)
        path = self._dir(case_id) / "frames" / f"{frame_id}.jpg"
        if not path.exists():
            raise KeyError(frame_id)
        return path.read_bytes()

    def verify(self, case_id: str) -> dict:
        """Re-hash every stored image and re-walk the chain."""
        case = self.get(case_id)
        prev, chain_ok, entries = GENESIS, True, []
        for e in case.ledger:
            try:
                stored = hashlib.sha256(self.frame_bytes(case_id, e.frame_id)).hexdigest()
            except KeyError:
                stored = None
            link_ok = e.prev_hash == prev and e.entry_hash == entry_hash(
                case_id, e.seq, e.frame_id, e.sha256, e.received_at, e.prev_hash)
            chain_ok = chain_ok and link_ok
            entries.append({
                "seq": e.seq, "frame_id": e.frame_id, "sha256": e.sha256,
                "image_matches": stored == e.sha256,
                "matches_phone_hash": e.client_sha256 == e.sha256,
                "chain_ok": chain_ok,
            })
            prev = e.entry_hash
        return {
            "case_id": case_id,
            "verified_at": now(),
            "all_ok": chain_ok and all(x["image_matches"] and x["matches_phone_hash"] for x in entries),
            "entries": entries,
        }


def ledger_export(case: Case, verification: dict) -> str:
    frames = {f.id: f for f in case.frames}
    rows = []
    for e in case.ledger:
        f = frames.get(e.frame_id)
        rows.append({
            **e.model_dump(),
            "removed": f.removed if f else None,
            "issues": [i.label for n, i in enumerate(f.issues) if n not in f.dismissed] if f else [],
        })
    return json.dumps({
        "case_id": case.id,
        "created_at": case.created_at,
        "how_to_verify": "sha256 of each photo must equal its entry's sha256. entry_hash = sha256("
                         "'case_id|seq|frame_id|sha256|received_at|prev_hash'), and each prev_hash "
                         "equals the previous entry's entry_hash (the first is 64 zeros).",
        "verification": verification,
        "ledger": rows,
    }, indent=2)


store = CaseStore()
