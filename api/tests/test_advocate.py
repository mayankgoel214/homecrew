from datetime import date

from app import exports
from app.agents import advocate
from app.agents.inspector import Issue
from app.agents.lawyer import LegalFinding

NOTICE = date(2026, 10, 26)
ISSUES = [
    Issue(type="pest", label="mouse droppings", severity=4, confidence=0.9,
          evidence_note="Mouse droppings under the sink."),
    Issue(type="water_damage", label="ceiling stain", severity=2, confidence=0.8,
          evidence_note="Brown stain on the bathroom ceiling."),
]


def finding(i, defense):
    return LegalFinding(
        issue_index=i, issue_type=ISSUES[i].type, issue_label=ISSUES[i].label,
        statute_section="55.1-1220", statute_title="Landlord to maintain fit premises",
        statute_url="https://law.lis.virginia.gov/vacode/55.1-1220/", plain_english="Landlord must fix it.",
        statute_quote="Make all repairs", quote_verified=True, is_eviction_defense=defense, defense_reason="",
    )


FINDINGS = [finding(0, True), finding(1, False)]
GEMMA_REPLY = {"paragraphs": [{"index": 0, "text": "There are mouse droppings under my kitchen sink."}],
               "complaint_description": "Rodent droppings and a ceiling stain."}


def fake_gemma(monkeypatch):
    monkeypatch.setattr(advocate, "generate_json", lambda prompt, images=None, think=False: (GEMMA_REPLY, "fake"))


def test_deadlines():
    titles = {d.title: d.day for d in advocate.build_deadlines(ISSUES, FINDINGS, NOTICE, "repair")}
    assert titles["21-day repair deadline (Va. Code § 55.1-1234)"] == date(2026, 11, 16)
    assert titles["14-day repair window ends (Va. Code § 55.1-1244.1)"] == date(2026, 11, 9)  # pests
    assert titles["Unreasonable delay presumed (Va. Code § 55.1-1241)"] == date(2026, 11, 25)
    assert not any("Lease ends" in t for t in titles)
    assert any("Lease ends" in d.title for d in advocate.build_deadlines(ISSUES, FINDINGS, NOTICE, "repair_or_terminate"))


def test_letter_modes(monkeypatch):
    fake_gemma(monkeypatch)
    repair = advocate.draft(ISSUES, FINDINGS, advocate.TenantInfo(tenant_name="Sam Lee", notice_date=NOTICE))
    assert "mouse droppings under my kitchen sink" in repair.letter_text
    assert "Brown stain on the bathroom ceiling." in repair.letter_text  # fallback to evidence note
    assert "will terminate" not in repair.letter_text
    assert "Sam Lee" in repair.letter_text and "[" not in repair.letter_text
    end = advocate.draft(ISSUES, FINDINGS, advocate.TenantInfo(notice_date=NOTICE, mode="repair_or_terminate"))
    assert "will terminate on November 25, 2026" in end.letter_text


def test_ics_escaping_and_folding():
    d = advocate.Deadline(day=NOTICE, title="A; b, c", detail="x" * 200)
    ics = exports.deadlines_ics("id", [d])
    assert r"SUMMARY:HomeCrew: A\; b\, c" in ics
    assert all(len(line.encode()) <= 75 for line in ics.split("\r\n"))
