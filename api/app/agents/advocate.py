"""Advocate agent: turns findings into the repair notice, the code-complaint packet and deadlines.

Gemma writes only the factual descriptions (one paragraph per issue, plus the complaint summary).
Everything with legal weight is assembled by code: the statute citations come from the Lawyer's
grounded findings, and the notice wording and deadlines follow Va. Code § 55.1-1234. Nothing is
exportable until the tenant approves the draft (see main.py).
"""

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from app.agents.inspector import Issue
from app.agents.lawyer import DISCLAIMER, LegalFinding
from app.gemma import generate_json

PROMPT = (Path(__file__).parent.parent / "prompts" / "advocate.md").read_text()

# Conditions § 55.1-1244.1 lets a tenant hire a licensed contractor for after 14 days.
REPAIR_BY_TENANT_TYPES = {"pest", "no_heat_indicator", "exposed_wiring"}

CODE_INSPECTOR = {
    "office": "Town of Blacksburg, Office of Housing and Community Connections (code inspector)",
    "phone": "(540) 443-1612",
    "building_inspection_phone": "(540) 961-0672",
    "note": "Call to confirm how to file. The town's online form fields could not be verified.",
}
LEGAL_HELP = [
    {"name": "Southwest Virginia Legal Aid Society", "phone": "1-888-201-2772",
     "url": "https://svlas.kempscaseworks.com/app/"},
    {"name": "Virginia Eviction Legal Helpline", "phone": "1-833-663-8428", "url": ""},
]


class TenantInfo(BaseModel):
    """All optional. Used only to fill in the letter; never stored beyond the draft."""

    tenant_name: str = Field("", max_length=100)
    unit_address: str = Field("", max_length=200)
    landlord_name: str = Field("", max_length=100)
    notice_date: date | None = None  # the day the landlord receives the notice
    mode: Literal["repair", "repair_or_terminate"] = "repair"
    notes: str = Field("", max_length=500)


class Deadline(BaseModel):
    day: date
    title: str
    detail: str


class Draft(BaseModel):
    id: str
    created_at: str
    mode: str
    letter_text: str
    complaint: dict
    deadlines: list[Deadline]
    legal_help: list[dict]
    model: str
    approved: bool = False
    approved_at: str | None = None


def _blank(value: str, placeholder: str) -> str:
    return value.strip() or placeholder


def _findings_json(issues: list[Issue], findings: list[LegalFinding]) -> str:
    by_issue = {f.issue_index: f for f in findings}
    rows = []
    for i, issue in enumerate(issues):
        f = by_issue.get(i)
        rows.append({
            "index": i, "type": issue.type, "label": issue.label, "severity": issue.severity,
            "evidence_note": issue.evidence_note,
            "lawyer_summary": f.plain_english if f else "",
        })
    return json.dumps(rows, indent=1)


def build_deadlines(issues: list[Issue], findings: list[LegalFinding], notice: date, mode: str) -> list[Deadline]:
    deadlines = [Deadline(
        day=notice, title="Repair notice delivered to landlord",
        detail="Keep proof of delivery (certified mail receipt, email, or a dated photo of the hand-off).",
    )]
    if any(i.type in REPAIR_BY_TENANT_TYPES for i in issues):
        deadlines.append(Deadline(
            day=notice + timedelta(days=14), title="14-day repair window ends (Va. Code § 55.1-1244.1)",
            detail="For serious conditions like rodents or no heat: if the landlord hasn't taken reasonable "
                   "steps, you may be able to hire a licensed contractor and deduct the cost. Check the "
                   "limits in § 55.1-1244.1 or ask legal aid first.",
        ))
    deadlines.append(Deadline(
        day=notice + timedelta(days=21), title="21-day repair deadline (Va. Code § 55.1-1234)",
        detail="If the problems aren't fixed, contact the code inspector and legal aid about rent escrow "
               "(§ 55.1-1244). Take new photos showing the condition today.",
    ))
    if mode == "repair_or_terminate":
        deadlines.append(Deadline(
            day=notice + timedelta(days=30), title="Lease ends if repairs weren't made (Va. Code § 55.1-1234)",
            detail="Only if the landlord did not fix the problems by day 21. Talk to legal aid before moving out.",
        ))
    if any(f.is_eviction_defense for f in findings):
        deadlines.append(Deadline(
            day=notice + timedelta(days=30), title="Unreasonable delay presumed (Va. Code § 55.1-1241)",
            detail="If the serious conditions still aren't fixed 30 days after notice, the delay is presumed "
                   "unreasonable. Keep this file if you are ever taken to court over rent.",
        ))
    return sorted(deadlines, key=lambda d: d.day)


def build_letter(issues: list[Issue], findings: list[LegalFinding], paragraphs: dict[int, str],
                 info: TenantInfo, notice: date) -> str:
    by_issue = {f.issue_index: f for f in findings}
    lines = [
        notice.strftime("%B %-d, %Y"),
        "",
        f"To: {_blank(info.landlord_name, 'Landlord / Property Manager')}",
        f"From: {_blank(info.tenant_name, 'Tenant')}",
        f"Re: {_blank(info.unit_address, 'My rental unit')}",
        "",
        "Subject: Written notice of conditions requiring repair (Va. Code §§ 55.1-1220 and 55.1-1234)",
        "",
        f"Dear {_blank(info.landlord_name, 'Landlord')},",
        "",
        "I am writing to give you written notice of the following conditions in my unit that need "
        "repair. I documented each one with timestamped photos.",
        "",
    ]
    for n, issue in enumerate(issues, start=1):
        f = by_issue.get(n - 1)
        lines.append(f"{n}. {issue.label[:1].upper()}{issue.label[1:]}")
        lines.append(paragraphs.get(n - 1) or issue.evidence_note)
        if f:
            lines.append(f"Relevant law: Va. Code § {f.statute_section} ({f.statute_title}).")
        lines.append("")
    lines += [
        "Under Va. Code § 55.1-1220, you are required to keep the premises fit and habitable and "
        "to make the repairs needed to do so.",
        "",
    ]
    end = notice + timedelta(days=30)
    if info.mode == "repair_or_terminate":
        lines += [
            "Under Va. Code § 55.1-1234, if these conditions are not remedied within 21 days after you "
            f"receive this notice, our rental agreement will terminate on {end.strftime('%B %-d, %Y')}, "
            "a date not less than 30 days after you receive this notice.",
            "",
        ]
    else:
        lines += [
            "Please make these repairs within 21 days of receiving this notice, as provided in Va. Code "
            "§ 55.1-1234. I reserve all of my rights under the Virginia Residential Landlord and Tenant "
            "Act, including §§ 55.1-1234, 55.1-1241, 55.1-1244 and 55.1-1244.1.",
            "",
        ]
    lines += [
        "Please contact me to arrange access for the repairs. Retaliating against a tenant for "
        "requesting repairs or contacting a government agency is prohibited by Va. Code § 55.1-1258.",
        "",
        "Sincerely,",
        "",
        _blank(info.tenant_name, "______________________"),
    ]
    return "\n".join(lines)


def build_complaint(issues: list[Issue], description: str, info: TenantInfo, notice: date) -> dict:
    return {
        "to": CODE_INSPECTOR,
        "property_address": info.unit_address.strip() or None,
        "tenant_name": info.tenant_name.strip() or None,
        "landlord_name": info.landlord_name.strip() or None,
        "date_landlord_notified": notice.isoformat(),
        "conditions": [
            {"issue": i.label, "type": i.type, "severity": i.severity, "description": i.evidence_note}
            for i in issues
        ],
        "description": description,
        "evidence": "Timestamped photos with SHA-256 fingerprints, available on request.",
    }


def draft(issues: list[Issue], findings: list[LegalFinding], info: TenantInfo) -> Draft:
    notice = info.notice_date or date.today()
    raw, model = generate_json(
        PROMPT.replace("{{FINDINGS}}", _findings_json(issues, findings)).replace(
            "{{NOTES}}", info.notes.strip() or "(none)"
        )
    )
    raw = raw if isinstance(raw, dict) else {}
    paragraphs = {
        p["index"]: str(p.get("text", "")).strip()
        for p in raw.get("paragraphs", [])
        if isinstance(p, dict) and isinstance(p.get("index"), int)
    }
    description = str(raw.get("complaint_description", "")).strip() or "; ".join(
        i.evidence_note for i in issues
    )
    return Draft(
        id=uuid4().hex,
        created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        mode=info.mode,
        letter_text=build_letter(issues, findings, paragraphs, info, notice),
        complaint=build_complaint(issues, description, info, notice),
        deadlines=build_deadlines(issues, findings, notice, info.mode),
        legal_help=LEGAL_HELP,
        model=model,
    )


__all__ = ["DISCLAIMER", "Draft", "TenantInfo", "draft"]
