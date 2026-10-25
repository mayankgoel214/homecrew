import hashlib
import json

import pytest
from fastapi.testclient import TestClient

from app import main
from app import store as db
from app.agents import advocate, lawyer
from app.agents.inspector import InspectorResult, Issue
from app.store import LocalCaseStore

MOLD = Issue(type="mold", label="mold", severity=4, confidence=0.95, evidence_note="Mold on ceiling.")
STAIN = Issue(type="water_damage", label="stain", severity=2, confidence=0.8, evidence_note="Stain on wall.")
LOCK = Issue(type="broken_lock", label="broken lock", severity=4, confidence=0.9, evidence_note="Lock is broken.")
IMG_A, IMG_B = b"\xff\xd8fake-jpeg-A", b"\xff\xd8fake-jpeg-B"


@pytest.fixture
def client(tmp_path, monkeypatch):
    test_store = LocalCaseStore(tmp_path)
    monkeypatch.setattr(main, "store", test_store)
    monkeypatch.setattr(db, "store", test_store)  # the crew posts chat through app.store
    replies = {IMG_A: [MOLD, STAIN], IMG_B: [LOCK]}
    monkeypatch.setattr(main, "inspect", lambda data, notes="", mime_type="", expert="": InspectorResult(
        room_guess="bathroom", issues=replies[data], model="fake"))
    seen = {}

    def fake_lawyer(issues, on_event=None):
        if on_event:
            on_event("plan", {"sections": ["55.1-1220"]})
            on_event("lookup", {"section": "55.1-1220", "statute": {"title": "Landlord to maintain fit premises", "text": "a b c"}})
        seen["lawyer"] = [i.label for i in issues]
        return lawyer.LawyerResult(findings=[lawyer.LegalFinding(
            issue_index=n, issue_type=i.type, issue_label=i.label, statute_section="55.1-1220",
            statute_title="Landlord to maintain fit premises", statute_url="u", plain_english="Fix it.",
            statute_quote="q", quote_verified=True, is_eviction_defense=False, defense_reason="")
            for n, i in enumerate(issues)], lookups=["55.1-1220"], model="fake")

    monkeypatch.setattr(main.lawyer, "analyze", fake_lawyer)
    monkeypatch.setattr(advocate, "generate_json", lambda *a, **k: ({"paragraphs": [], "complaint_description": "d"}, "fake"))
    c = TestClient(main.app)
    c.seen = seen
    return c


def upload(client, case_id, img):
    sha = hashlib.sha256(img).hexdigest()
    return client.post(f"/cases/{case_id}/frames", files={"frame": ("f.jpg", img, "image/jpeg")},
                       data={"client_sha256": sha, "captured_at": "2026-10-24T14:00:00-04:00"})


def test_full_case_flow(client):
    case_id = client.post("/cases").json()["id"]
    a = upload(client, case_id, IMG_A).json()
    b = upload(client, case_id, IMG_B).json()
    assert a["ledger_entry"]["prev_hash"] == "0" * 64
    assert b["ledger_entry"]["prev_hash"] == a["ledger_entry"]["entry_hash"]
    assert client.get(f"/cases/{case_id}/frames/{a['frame']['id']}/image").content == IMG_A

    verify = client.get(f"/cases/{case_id}/verify").json()
    assert verify["all_ok"] and len(verify["entries"]) == 2

    # Tenant says the stain isn't a problem: Lawyer only sees the rest, across both photos.
    client.patch(f"/cases/{case_id}/frames/{a['frame']['id']}", json={"dismissed": [1]})
    legal = client.post(f"/cases/{case_id}/lawyer").json()
    assert client.seen["lawyer"] == ["mold", "broken lock"]
    assert legal["legal_refs"][1]["frame_id"] == b["frame"]["id"]

    assert client.get(f"/cases/{case_id}/export/letter.pdf").status_code == 403
    draft = client.post(f"/cases/{case_id}/advocate", json={"notice_date": "2026-10-26"}).json()["draft"]
    assert "Mold on ceiling." in draft["letter_text"] and "Lock is broken." in draft["letter_text"]
    assert client.get(f"/cases/{case_id}/export/letter.pdf").status_code == 403
    client.post(f"/cases/{case_id}/approve", json={})
    assert client.get(f"/cases/{case_id}/export/letter.pdf").content.startswith(b"%PDF")

    # New evidence invalidates the old review and paperwork.
    upload(client, case_id, IMG_B)
    case = client.get(f"/cases/{case_id}").json()
    assert case["legal"] is None and case["draft"] is None
    assert client.get(f"/cases/{case_id}/export/letter.pdf").status_code == 403


def test_remove_keeps_ledger_and_excludes_issues(client):
    case_id = client.post("/cases").json()["id"]
    a = upload(client, case_id, IMG_A).json()
    upload(client, case_id, IMG_B)
    client.patch(f"/cases/{case_id}/frames/{a['frame']['id']}", json={"removed": True})
    client.post(f"/cases/{case_id}/lawyer")
    assert client.seen["lawyer"] == ["broken lock"]
    assert len(client.get(f"/cases/{case_id}").json()["ledger"]) == 2
    evidence = json.loads(client.get(f"/cases/{case_id}/export/evidence.json").text)
    assert evidence["ledger"][0]["removed"] is True and evidence["verification"]["all_ok"]


def test_tampering_is_detected(client, tmp_path):
    case_id = client.post("/cases").json()["id"]
    a = upload(client, case_id, IMG_A).json()
    upload(client, case_id, IMG_B)
    (tmp_path / case_id / "frames" / f"{a['frame']['id']}.jpg").write_bytes(b"edited photo")
    v = client.get(f"/cases/{case_id}/verify").json()
    assert v["all_ok"] is False and v["entries"][0]["image_matches"] is False

    path = tmp_path / case_id / "case.json"
    data = json.loads(path.read_text())
    data["ledger"][0]["received_at"] = "2020-01-01T00:00:00+00:00"  # backdate an entry
    path.write_text(json.dumps(data))
    v = client.get(f"/cases/{case_id}/verify").json()
    assert [e["chain_ok"] for e in v["entries"]] == [False, False]


def test_phone_hash_mismatch_and_bad_ids(client):
    case_id = client.post("/cases").json()["id"]
    client.post(f"/cases/{case_id}/frames", files={"frame": ("f.jpg", IMG_A, "image/jpeg")},
                data={"client_sha256": "deadbeef"})
    assert client.get(f"/cases/{case_id}/verify").json()["entries"][0]["matches_phone_hash"] is False
    assert client.get("/cases/../../etc/verify").status_code == 404
    assert client.get("/cases/notahexid").status_code == 404
    assert client.post(f"/cases/{case_id}/lawyer").status_code == 200
    assert client.post(f"/cases/{client.post('/cases').json()['id']}/lawyer").status_code == 400


def test_crew_chat_and_stream(client):
    case_id = client.post("/cases").json()["id"]
    a = upload(client, case_id, IMG_A).json()
    client.patch(f"/cases/{case_id}/frames/{a['frame']['id']}", json={"dismissed": [1]})
    client.post(f"/cases/{case_id}/lawyer")
    client.post(f"/cases/{case_id}/advocate", json={})
    client.post(f"/cases/{case_id}/approve", json={})
    chat = client.get(f"/cases/{case_id}").json()["chat"]
    agents = [m["agent"] for m in chat]
    assert agents[:2] == ["inspector", "inspector"] and "you" in agents
    assert any(m["kind"] == "tool" and "va_code_lookup" in m["text"] for m in chat)
    assert "Approved" in chat[-1]["text"]
    assert [m["seq"] for m in chat] == list(range(len(chat)))

    # The stream replays everything after a given id. Read just past the first two events.
    with client.stream("GET", f"/cases/{case_id}/stream", headers={"Last-Event-ID": str(len(chat) - 3)}) as r:
        assert r.headers["content-type"].startswith("text/event-stream")
        ids = []
        for line in r.iter_lines():
            if line.startswith("id: "):
                ids.append(int(line[4:]))
            if len(ids) == 2:
                break
    assert ids == [len(chat) - 2, len(chat) - 1]


def test_stale_review_is_discarded(client, monkeypatch):
    case_id = client.post("/cases").json()["id"]
    upload(client, case_id, IMG_B)
    real = main.lawyer.analyze

    def slow_lawyer(issues, on_event=None):
        upload(client, case_id, IMG_A)  # a new photo lands while the Lawyer is working
        return real(issues, on_event)

    monkeypatch.setattr(main.lawyer, "analyze", slow_lawyer)
    assert client.post(f"/cases/{case_id}/lawyer").status_code == 409
    case = client.get(f"/cases/{case_id}").json()
    assert case["legal"] is None and "discarded" in case["chat"][-1]["text"]
    assert client.post(f"/cases/{case_id}/advocate", json={}).status_code == 409


def test_live_frames_skip_clean_and_duplicates(client, monkeypatch):
    case_id = client.post("/cases").json()["id"]

    def live(img):
        return client.post(f"/cases/{case_id}/frames", files={"frame": ("f.jpg", img, "image/jpeg")},
                           data={"client_sha256": hashlib.sha256(img).hexdigest(), "live": "true"}).json()

    monkeypatch.setattr(main, "inspect", lambda data, notes="", mime_type="", expert="": InspectorResult(
        room_guess="kitchen", issues=[], model="fake", say="Looks fine here."))
    assert live(IMG_A)["kept"] is False  # clean live frames aren't evidence
    monkeypatch.setattr(main, "inspect", lambda data, notes="", mime_type="", expert="": InspectorResult(
        room_guess="bathroom", issues=[MOLD], model="fake", say="That's mold."))
    assert live(IMG_A)["kept"] is True
    assert live(IMG_B)["kept"] is False  # same mold seen again right away
    case = client.get(f"/cases/{case_id}").json()
    assert len(case["ledger"]) == 1
    agents = [m["agent"] for m in case["chat"]]
    assert agents.count("lawyer") == 1 and agents.count("advocate") == 1  # Rosa -> Theo -> June, once per problem


def test_each_call_is_its_own_conversation(client, monkeypatch):
    case_id = client.post("/cases").json()["id"]
    monkeypatch.setattr(main, "inspect", lambda data, notes="", mime_type="", expert="": InspectorResult(
        room_guess="bathroom", issues=[MOLD], model="fake", say="Mold on the ceiling."))

    def call():
        client.post(f"/cases/{case_id}/call/start", json={"trade": "general", "renter": True})
        client.post(f"/cases/{case_id}/frames", files={"frame": ("f.jpg", IMG_A, "image/jpeg")}, data={"live": "true"})
        start = client.get(f"/cases/{case_id}").json()["call_seq"]
        return [m["agent"] for m in client.get(f"/cases/{case_id}").json()["chat"][start:]]

    assert "lawyer" in call() and "advocate" in call()  # a second take still gets Theo and June


def test_snapshot_gets_theo_and_june_and_rosa_only_hands_over_when_he_answers(client, monkeypatch):
    # The iPhone bug: a tapped snapshot (live=false) got Rosa saying "Theo" and then silence.
    case_id = client.post("/cases").json()["id"]
    monkeypatch.setattr(main, "inspect", lambda data, notes="", mime_type="", expert="": InspectorResult(
        room_guess="living room", issues=[STAIN], model="fake", say="There is a stain on the wall."))
    client.post(f"/cases/{case_id}/call/start", json={"trade": "general", "renter": True})

    def snap(img):
        client.post(f"/cases/{case_id}/frames", files={"frame": ("f.jpg", img, "image/jpeg")})
        return client.get(f"/cases/{case_id}").json()["chat"]

    chat = [m for m in snap(IMG_A) if m["kind"] == "message"]
    assert [m["agent"] for m in chat[-3:]] == ["inspector", "lawyer", "advocate"]
    assert chat[-3]["text"].endswith("@Lawyer")
    chat = [m for m in snap(IMG_B) if m["kind"] == "message"]  # same problem again: Theo has said it
    assert chat[-1]["agent"] == "inspector" and "@Lawyer" not in chat[-1]["text"]
