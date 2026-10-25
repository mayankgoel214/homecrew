"""Case storage. STORE=local (default): JSON + images under uploads/cases/. STORE=firestore:
Firestore documents + Cloud Storage objects (production on Cloud Run).

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
    trade: str = "general"  # which expert the tenant called (app.trades)
    renter: bool = True  # landlord duties only apply to renters
    call_seq: int = 0  # chat length when the current call started (lines before it are earlier calls)
    call_started_at: str = ""  # duplicate findings are only skipped within the current call

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

    def landlord_issues(self) -> tuple[list[Issue], list[dict]]:
        """What the legal review and the letter cover: everything except fix-it-yourself findings
        (your own broken chair is not your landlord's problem)."""
        pairs = [(i, r) for i, r in zip(*self.active_issues()) if not (i.safety and i.safety.get("tier") == "diy")]
        return [i for i, _ in pairs], [r for _, r in pairs]

    def invalidate(self) -> None:
        """Evidence changed: the legal review and paperwork must be redone."""
        self.legal, self.legal_refs, self.draft = None, [], None


def entry_hash(case_id: str, seq: int, frame_id: str, sha256: str, received_at: str, prev: str) -> str:
    return hashlib.sha256(f"{case_id}|{seq}|{frame_id}|{sha256}|{received_at}|{prev}".encode()).hexdigest()


class CaseStore:
    """Shared logic. Backends implement _read, _create, update (atomic), put_image, frame_bytes."""

    poll_seconds = 0.4  # how often the chat stream checks for new messages

    @staticmethod
    def _check(case_id: str) -> None:
        if not _ID.match(case_id):  # also blocks path traversal
            raise KeyError(case_id)

    def get(self, case_id: str) -> Case:
        self._check(case_id)
        case = self._read(case_id)
        if case is None:
            raise KeyError(case_id)
        return case

    def create(self) -> Case:
        case = Case(id=uuid4().hex, created_at=now())
        self._create(case)
        return case

    def add_frame(self, case_id: str, image: bytes, client_sha256: str, captured_at: str | None,
                  room_guess: str, issues: list[Issue], model: str) -> tuple[Case, Frame]:
        self._check(case_id)
        frame_id = uuid4().hex
        self.put_image(case_id, frame_id, image)  # stored first; the ledger entry points at it
        sha = hashlib.sha256(image).hexdigest()
        added: list[Frame] = []

        def change(case: Case):
            added.clear()  # the change can be retried by a transaction
            seq = len(case.ledger)
            prev = case.ledger[-1].entry_hash if case.ledger else GENESIS
            received = now()
            case.ledger.append(LedgerEntry(
                seq=seq, frame_id=frame_id, sha256=sha, client_sha256=client_sha256.lower(),
                received_at=received, captured_at=captured_at, prev_hash=prev,
                entry_hash=entry_hash(case_id, seq, frame_id, sha, received, prev),
            ))
            frame = Frame(id=frame_id, seq=seq, room_guess=room_guess, issues=issues, model=model)
            case.frames.append(frame)
            case.invalidate()
            added.append(frame)

        case = self.update(case_id, change)
        return case, added[0]

    def post(self, case_id: str, agent: str, text: str, kind: str = "message", refs: dict | None = None) -> None:
        """Append a crew chat message. The SSE stream picks it up from the saved case."""

        def change(case: Case):
            case.chat.append(ChatMessage(seq=len(case.chat), agent=agent, kind=kind, text=text,
                                         refs=refs or {}, ts=now()))

        self.update(case_id, change)

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


class LocalCaseStore(CaseStore):
    """One JSON file plus frame images per case on local disk. For development and tests."""

    def __init__(self, root: Path = ROOT):
        self.root = root
        self._lock = threading.Lock()

    def _dir(self, case_id: str) -> Path:
        self._check(case_id)
        return self.root / case_id

    def _read(self, case_id: str) -> Case | None:
        path = self._dir(case_id) / "case.json"
        return Case.model_validate_json(path.read_text()) if path.exists() else None

    def _save(self, case: Case) -> None:
        path = self._dir(case.id) / "case.json"
        tmp = path.with_suffix(".tmp")
        tmp.write_text(case.model_dump_json(indent=1))
        tmp.replace(path)  # atomic, so a crash never leaves half a file

    def _create(self, case: Case) -> None:
        (self._dir(case.id) / "frames").mkdir(parents=True)
        self._save(case)

    def update(self, case_id: str, change) -> Case:
        """Load, apply change(case), save, under the lock."""
        with self._lock:
            case = self.get(case_id)
            change(case)
            self._save(case)
            return case

    def put_image(self, case_id: str, frame_id: str, image: bytes) -> None:
        (self._dir(case_id) / "frames" / f"{frame_id}.jpg").write_bytes(image)

    def frame_bytes(self, case_id: str, frame_id: str) -> bytes:
        if not _ID.match(frame_id):
            raise KeyError(frame_id)
        path = self._dir(case_id) / "frames" / f"{frame_id}.jpg"
        if not path.exists():
            raise KeyError(frame_id)
        return path.read_bytes()


class FirestoreCaseStore(CaseStore):
    """Production: the case document in Firestore, photos in Cloud Storage.

    Each case is one document holding the case as JSON (well under Firestore's 1 MB limit) and an
    expire_at timestamp; a Firestore TTL policy and a bucket lifecycle rule delete both after
    RETENTION_DAYS. Every change runs in a transaction, so concurrent Cloud Run instances can't
    overwrite each other.
    """

    poll_seconds = 1.0  # each stream poll is a Firestore read; keep it cheap
    RETENTION_DAYS = 30

    def __init__(self, project: str, bucket: str):
        from google.cloud import firestore, storage  # only needed in production

        self._firestore = firestore
        self.db = firestore.Client(project=project)
        self.cases = self.db.collection("cases")
        self.bucket = storage.Client(project=project).bucket(bucket)

    def _doc(self, case: Case) -> dict:
        from datetime import timedelta

        created = datetime.fromisoformat(case.created_at)
        return {
            "data": case.model_dump_json(),
            "created_at": created,
            "expire_at": created + timedelta(days=self.RETENTION_DAYS),
        }

    def _read(self, case_id: str) -> Case | None:
        snap = self.cases.document(case_id).get()
        return Case.model_validate_json(snap.get("data")) if snap.exists else None

    def _create(self, case: Case) -> None:
        self.cases.document(case.id).create(self._doc(case))

    def update(self, case_id: str, change) -> Case:
        self._check(case_id)
        ref = self.cases.document(case_id)

        @self._firestore.transactional
        def run(transaction):
            snap = ref.get(transaction=transaction)
            if not snap.exists:
                raise KeyError(case_id)
            case = Case.model_validate_json(snap.get("data"))
            change(case)  # may run more than once if the transaction retries
            transaction.set(ref, self._doc(case))
            return case

        return run(self.db.transaction())

    def _blob(self, case_id: str, frame_id: str):
        self._check(case_id)
        if not _ID.match(frame_id):
            raise KeyError(frame_id)
        return self.bucket.blob(f"cases/{case_id}/{frame_id}.jpg")

    def put_image(self, case_id: str, frame_id: str, image: bytes) -> None:
        self._blob(case_id, frame_id).upload_from_string(image, content_type="image/jpeg")

    def frame_bytes(self, case_id: str, frame_id: str) -> bytes:
        from google.api_core.exceptions import NotFound

        try:
            return self._blob(case_id, frame_id).download_as_bytes()
        except NotFound:
            raise KeyError(frame_id) from None


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



def _make_store() -> CaseStore:
    from app.config import settings

    if settings.store == "firestore":
        return FirestoreCaseStore(settings.gcp_project, settings.gcs_bucket)
    return LocalCaseStore()


store = _make_store()
