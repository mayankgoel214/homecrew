"""Lawyer agent: maps Inspector findings to Virginia Code sections.

Two Gemma calls with a tool step in between:
1. select: Gemma picks which sections to look up from the catalog.
2. va_code_lookup runs for each pick (plus the two sections every repair needs).
3. analyze: Gemma explains each issue using only the returned statute text.
Then code, not the model, enforces grounding: citations must be sections we looked up, and
quotes must appear verbatim in the statute (otherwise we substitute the closest real sentence).
"""

import json
import re
from pathlib import Path

from pydantic import BaseModel

from app.agents.inspector import Issue
from app.gemma import GemmaError, generate_json
from app.statutes import catalog, normalize_section, va_code_lookup

PROMPTS = Path(__file__).parent.parent / "prompts"
SELECT_PROMPT = (PROMPTS / "lawyer_select.md").read_text()
ANALYZE_PROMPT = (PROMPTS / "lawyer_analyze.md").read_text()

# Every repair problem: the landlord's duty (§ 55.1-1220) and the tenant's notice remedy (§ 55.1-1234).
ALWAYS_LOOK_UP = ["55.1-1220", "55.1-1234"]
MAX_LOOKUPS = 5
MAX_QUOTE_WORDS = 40

DISCLAIMER = (
    "Informational only, not legal advice. For help with your situation, contact Southwest "
    "Virginia Legal Aid Society (1-888-201-2772) or the Virginia Eviction Legal Helpline "
    "(1-833-663-8428)."
)
# Fixed legal facts come from code, not from the model.
DEADLINE_DAYS = 21
DEADLINE_BASIS = (
    "Under § 55.1-1234, after you give your landlord written notice, they have 21 days to fix "
    "it. If they don't, the notice can end your lease on a date at least 30 days after they got it."
)
DEFENSE_CONDITION = (
    "This only works as a defense if you gave your landlord written notice and they didn't fix "
    "it before the case was filed (§ 55.1-1241)."
)


class LegalFinding(BaseModel):
    issue_index: int
    issue_type: str
    issue_label: str
    statute_section: str
    statute_title: str
    statute_url: str
    plain_english: str
    statute_quote: str
    quote_verified: bool
    is_eviction_defense: bool
    defense_reason: str
    deadline_days: int = DEADLINE_DAYS
    deadline_basis: str = DEADLINE_BASIS


class LawyerResult(BaseModel):
    findings: list[LegalFinding]
    lookups: list[str]  # the va_code_lookup tool calls made, in order
    model: str
    disclaimer: str = DISCLAIMER


def _norm(text: str) -> str:
    text = text.replace("’", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", text).strip().lower()


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.;:])\s+", text) if len(s.split()) >= 5]


def _clip(text: str, words: int = MAX_QUOTE_WORDS) -> str:
    parts = text.split()
    return text if len(parts) <= words else " ".join(parts[:words]) + " …"


_STOP = set("the a an of to in on and or for by with as is are be this that any such shall may his her "
             "their its it from at under upon which who if not no".split())


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]+", _norm(text)) if len(w) > 2 and w not in _STOP}


def ground_quote(quote: str, statute_text: str, context: str = "") -> tuple[str, bool]:
    """Return (quote, verified). An unverifiable quote is replaced by the real statute sentence
    that shares the most words with what the finding is about (the quote plus its context)."""
    quote = quote.strip().strip('"').strip()
    if quote and _norm(quote.rstrip(" …")) in _norm(statute_text):
        return _clip(quote), True
    want = _words(f"{quote} {context}")
    sentences = _sentences(statute_text) or [statute_text]
    best = max(sentences, key=lambda s: len(want & _words(s)) / (len(_words(s)) ** 0.5 or 1))
    return _clip(best), False


def _issues_json(issues: list[Issue]) -> str:
    return json.dumps(
        [
            {"index": i, "type": x.type, "label": x.label, "severity": x.severity,
             "evidence_note": x.evidence_note}
            for i, x in enumerate(issues)
        ],
        indent=1,
    )


def select_sections(issues: list[Issue]) -> tuple[list[str], str]:
    prompt = SELECT_PROMPT.replace("{{ISSUES}}", _issues_json(issues)).replace(
        "{{CATALOG}}", "\n".join(f"- § {c['section']}: {c['title']}" for c in catalog())
    )
    raw, model = generate_json(prompt)
    picks = raw.get("lookups", []) if isinstance(raw, dict) else []
    sections = list(ALWAYS_LOOK_UP)
    for pick in picks:
        section = normalize_section(pick)
        if section not in sections and va_code_lookup(section):
            sections.append(section)
    return sections[:MAX_LOOKUPS], model


def analyze(issues: list[Issue]) -> LawyerResult:
    if not issues:
        return LawyerResult(findings=[], lookups=[], model="")

    sections, _ = select_sections(issues)
    statutes = {s: va_code_lookup(s) for s in sections}  # the tool calls
    statute_block = "\n\n".join(
        f"=== § {s}: {st['title']} ===\n{st['text']}" for s, st in statutes.items()
    )
    prompt = ANALYZE_PROMPT.replace("{{ISSUES}}", _issues_json(issues)).replace(
        "{{STATUTES}}", statute_block
    )
    raw, model = generate_json(prompt)
    items = raw.get("findings", []) if isinstance(raw, dict) else raw
    if not isinstance(items, list):
        raise GemmaError("Lawyer reply had no findings list")

    by_index: dict[int, dict] = {}
    for item in items:
        if isinstance(item, dict) and isinstance(item.get("index"), int):
            by_index.setdefault(item["index"], item)

    findings = []
    for i, issue in enumerate(issues):
        item = by_index.get(i, {})
        section = normalize_section(item.get("statute_section", ""))
        if section not in statutes:  # cited something it didn't look up: fall back to the core duty
            section = "55.1-1220"
        statute = statutes[section]
        quote, verified = ground_quote(
            str(item.get("statute_quote", "")),
            statute["text"],
            context=f"{issue.label} {issue.type.replace('_', ' ')} {item.get('plain_english', '')}",
        )
        is_defense = bool(item.get("is_eviction_defense", False))
        reason = str(item.get("defense_reason", "")).strip()
        if is_defense:
            reason = f"{reason} {DEFENSE_CONDITION}".strip()
        findings.append(
            LegalFinding(
                issue_index=i,
                issue_type=issue.type,
                issue_label=issue.label,
                statute_section=section,
                statute_title=statute["title"],
                statute_url=statute["url"],
                plain_english=str(item.get("plain_english", "")).strip()
                or f"Your landlord must keep the unit fit and habitable (§ {section}).",
                statute_quote=quote,
                quote_verified=verified,
                is_eviction_defense=is_defense,
                defense_reason=reason,
            )
        )
    return LawyerResult(findings=findings, lookups=sections, model=model)
