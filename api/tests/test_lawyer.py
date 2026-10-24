from fastapi.testclient import TestClient

from app.agents import lawyer
from app.agents.inspector import Issue
from app.main import app
from app.statutes import normalize_section, va_code_lookup

MOLD = Issue(type="mold", label="Mold on ceiling", severity=4, confidence=0.95,
             evidence_note="Black mold along the ceiling.")
STAIN = Issue(type="water_damage", label="Stain", severity=2, confidence=0.8,
              evidence_note="Brown stain on wall.")


def test_lookup_tool():
    assert normalize_section("§ 55.1-1220.") == "55.1-1220"
    assert normalize_section("55.1-1244.1") == "55.1-1244.1"
    assert va_code_lookup("§ 55.1-1234")["title"] == "Noncompliance by landlord"
    assert va_code_lookup("55.1-9999") is None


def test_ground_quote_verbatim_and_fallback():
    text = va_code_lookup("55.1-1234")["text"]
    real = "if such breach is not remedied in 21 days"
    assert lawyer.ground_quote(f'"{real}"', text) == (real, True)
    fake, ok = lawyer.ground_quote("the landlord must pay triple damages within 21 days", text)
    assert ok is False and lawyer._norm(fake.rstrip(" …")) in lawyer._norm(text)
    assert len(fake.split()) <= lawyer.MAX_QUOTE_WORDS + 1


def _fake_gemma(select_reply, analyze_reply):
    replies = iter([(select_reply, "fake"), (analyze_reply, "fake")])
    return lambda prompt, images=None, think=False: next(replies)


def test_analyze_enforces_grounding(monkeypatch):
    select = {"lookups": ["55.1-1231", "55.1-9999", "not a section"]}
    analyze = {"findings": [
        {"index": 0, "statute_section": "§ 55.1-1231", "plain_english": "Landlord must fix mold.",
         "statute_quote": "invented words", "is_eviction_defense": True, "defense_reason": "Health risk."},
        {"index": 1, "statute_section": "55.1-1226", "plain_english": "x",
         "statute_quote": "", "is_eviction_defense": False, "defense_reason": "Minor."},
    ]}
    monkeypatch.setattr(lawyer, "generate_json", _fake_gemma(select, analyze))
    result = lawyer.analyze([MOLD, STAIN])

    assert result.lookups == ["55.1-1220", "55.1-1234", "55.1-1231"]  # unknown picks dropped
    mold, stain = result.findings
    assert mold.statute_section == "55.1-1231" and mold.quote_verified is False
    assert "written notice" in mold.defense_reason
    assert stain.statute_section == "55.1-1220"  # cited a section it never looked up
    assert stain.deadline_days == 21
    assert "not legal advice" in result.disclaimer


def test_no_issues_skips_gemma(monkeypatch):
    monkeypatch.setattr(lawyer, "generate_json", lambda *a, **k: (_ for _ in ()).throw(AssertionError))
    assert lawyer.analyze([]).findings == []


def test_statute_endpoint():
    client = TestClient(app)
    assert client.get("/statutes/55.1-1241").json()["section"] == "55.1-1241"
    assert client.get("/statutes/18.2-1").status_code == 404
