"""What the crew says in the group chat. Turns agent events and results into chat messages.

Messages are written from facts the agents already produced (labels, sections, counts), not
generated, so the chat can never say something the evidence or the statutes don't support.
"""

import re
from app.agents.advocate import Draft
from app.agents.inspector import Issue
from app.agents.lawyer import LawyerResult
from app import store as db
from app import trades
from app.safety import TIER_ORDER, Emergency

ROOM = {"living_room": "living room", "other": "", "exterior": "outside"}


def _pct(x: float) -> str:
    return f"{round(x * 100)}%"


def inspector_looking(case_id: str, photo_number: int) -> None:
    db.store.post(case_id, "inspector", f"Looking at photo #{photo_number}…", kind="status")


def _short(text: str, limit: int = 90) -> str:
    """First sentence or two, so a spoken line stays under ~10 seconds."""
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    cut = text[:limit]
    return cut[: max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? ")) + 1] or cut.rsplit(" ", 1)[0] + "…"


TIER_TAIL = {  # Rosa only adds a tail when it changes what you should do; Theo covers whose job it is
    "pro": "Don't touch it.",
    "diy": "You can fix this one.",
}


def inspector_report(case_id: str, frame_id: str, photo_number: int, room: str, issues: list[Issue],
                     say: str = "") -> None:
    """ONE spoken line per photo: what the expert sees plus a short safety tail. The spoken line
    comes from Gemma (in character); the tail comes from the router (app.safety), never the model.
    Uncertainty and full steps live in the case file, not in the call."""
    refs = {"frame_id": frame_id}
    if not issues:
        db.store.post(case_id, "inspector", "Looks fine here.", refs=refs)
        return
    worst = max((i for i in issues if i.safety), key=lambda i: TIER_ORDER[i.safety["tier"]], default=None)
    if worst and worst.safety["tier"] == "emergency":
        db.store.post(case_id, "inspector", worst.safety["headline"], kind="emergency",
                      refs={**refs, "emergency": worst.safety["emergency"]})
        return
    tier = worst.safety["tier"] if worst else None
    first = re.split(r"(?<=[.!?])\s", _short(say).strip())[0] if say else ""
    words = first.split()
    if len(words) > 8:  # keep each finding to a few seconds of speech
        first = " ".join(words[:8]).rstrip(",;:") + "."
    line = first or f"{issues[0].label[:1].upper()}{issues[0].label[1:]}."
    if tier:
        if worst.type == "own_furniture":
            line = f"{line} That's yours to fix, not your landlord's."
        elif tier in TIER_TAIL:
            line = f"{line} {TIER_TAIL[tier]}"
        refs["tier"] = tier
    if theo_covers(db.store.get(case_id), issues):  # hand over only when Theo will actually answer
        line += " @Lawyer"
    db.store.post(case_id, "inspector", line, refs=refs)


def emergency(case_id: str, e: Emergency) -> None:
    db.store.post(case_id, "inspector", e.title, kind="emergency", refs={"emergency": e.kind})


def checklist_prompt(case_id: str, trade_id: str, step: int) -> None:
    items = trades.get(trade_id).checklist
    if step < len(items):
        db.store.post(case_id, "inspector", f"Next, show me {items[step]}.")



# What Theo actually says on the call: one beat, about 6 words. The full explanation is in the
# case file; on the call he just confirms whose problem it is and the section.
# The hand-off on every finding: Rosa says what she sees, Theo names the Virginia rule, June
# says what she's doing about it. Theo's rules restate specific subsections of the cached statute
# text (§ 55.1-1220 A.2/A.4/A.5/A.7/A.8, § 55.1-1244.1 B); the call screen shows the citation as a
# card while he speaks, so the spoken line can stay short.
RULES: dict[str, tuple[str, str, str]] = {  # type -> (section, spoken rule, on-screen rule)
    "mold": ("55.1-1220", "the landlord must fix visible mold.", "Prevent moisture; promptly remediate visible mold (A)(5)"),
    "water_damage": ("55.1-1220", "the landlord must keep moisture out.", "Prevent moisture and mold (A)(5)"),
    "exposed_wiring": ("55.1-1220", "the landlord keeps the electrical safe.", "Keep electrical in good and safe working order (A)(4)"),
    "no_heat_indicator": ("55.1-1220", "the landlord must supply heat.", "Supply heat in season and hot water (A)(7)"),
    "missing_smoke_detector": ("55.1-1220", "smoke alarms have to work.", "Smoke alarms present and working, certified yearly (A)(8)"),
    "pest": ("55.1-1244.1", "fourteen days to act after written notice.", "Rodents: landlord must act within 14 days of written notice (B)"),
}
DEFAULT_RULE = ("55.1-1220", "the landlord makes the repairs.", "Make all repairs to keep the unit fit and habitable (A)(2)")
TITLES = {"55.1-1220": "Landlord to maintain fit premises", "55.1-1244.1": "Tenant's remedy by repair"}
JUNE_LINES = ["I'll add it to your repair notice. They get 21 days.", "Added to the notice.", "That's in the notice too."]


def theo_covers(case, issues: list[Issue]) -> list[Issue]:
    """The findings Theo will speak to: renters only, landlord/pro tier, once per kind of problem in
    THIS call (a new take or 'Call again' starts the conversation over)."""
    if not case.renter:
        return []
    this_call = [m for m in case.chat if m.seq >= case.call_seq]
    already = {m.refs.get("issue_type") for m in this_call if m.agent == "lawyer"}
    covered = []
    for issue in issues:
        if issue.type in already or not issue.safety or issue.safety["tier"] not in ("landlord", "pro"):
            continue
        already.add(issue.type)
        covered.append(issue)
    return covered


def lawyer_quick_take(case_id: str, issues: list[Issue]) -> None:
    """Theo names the rule, June says what she'll do (see theo_covers for when)."""
    case = db.store.get(case_id)
    this_call = [m for m in case.chat if m.seq >= case.call_seq]
    sections_said = {m.refs.get("section") for m in this_call if m.agent == "lawyer"}
    n = sum(1 for m in this_call if m.agent == "lawyer" and m.refs.get("issue_type"))  # not his greeting
    for issue in theo_covers(case, issues):
        section, spoken, card = RULES.get(issue.type, DEFAULT_RULE)
        lead = "Same section:" if section in sections_said else f"Virginia Code {section}:"
        sections_said.add(section)
        db.store.post(case_id, "lawyer", f"{lead} {spoken}",
                      refs={"section": section, "issue_type": issue.type, "rule": card, "title": TITLES.get(section, "")})
        db.store.post(case_id, "advocate", JUNE_LINES[min(n, len(JUNE_LINES) - 1)])
        n += 1


def greet(case_id: str, trade_id: str = "general", renter: bool = True, problem: str = "") -> None:
    t = trades.get(trade_id)
    if problem:
        opener = f"Hi, I'm {t.name}, your {t.role.lower()}. Show me the problem."
    else:
        opener = f"Hi, I'm {t.name}. I'll inspect your place."
    db.store.post(case_id, "inspector", opener)
    if renter and not problem:  # the whole crew says who they are, once, up front
        db.store.post(case_id, "lawyer", "I'm Theo. I'll tell you what Virginia law says.")
        db.store.post(case_id, "advocate", "And I'm June. I'll write your repair letter.")


def call_ended(case_id: str, findings: int, renter: bool = True) -> None:
    if not findings:
        db.store.post(case_id, "inspector", "Nothing to flag this time. Call again if something comes up.")
    elif renter:
        db.store.post(case_id, "advocate", "Got it. Your case file is ready.")
    else:
        db.store.post(case_id, "advocate", "Your repair plan is ready in the case file.")


def lawyer_event(case_id: str):
    def on_event(event: str, data: dict) -> None:
        if event == "plan":
            db.store.post(case_id, "lawyer",
                       f"I'll check {len(data['sections'])} sections of the Virginia Residential Landlord and Tenant Act.")
        elif event == "lookup":
            st = data["statute"]
            db.store.post(case_id, "lawyer", f"va_code_lookup(\"{data['section']}\") → § {data['section']} {st['title']} "
                       f"({len(st['text'].split())} words)", kind="tool", refs={"section": data["section"]})
    return on_event


def lawyer_report(case_id: str, result: LawyerResult) -> None:
    for f in result.findings:
        line = f"{f.issue_label[:1].upper()}{f.issue_label[1:]} → § {f.statute_section} ({f.statute_title}). {f.plain_english}"
        if f.is_eviction_defense:
            line += " This could also be raised as a defense if you're ever taken to court over rent."
        db.store.post(case_id, "lawyer", line, refs={"section": f.statute_section})
    unverified = [f.issue_label for f in result.findings if not f.quote_verified]
    if unverified:
        db.store.post(case_id, "lawyer",
                   f"I couldn't match my quote word for word for {', '.join(unverified)}, so I'm showing the "
                   "closest real sentence from the statute instead.")
    defenses = sum(f.is_eviction_defense for f in result.findings)
    db.store.post(case_id, "lawyer",
               f"@Advocate {len(result.findings)} finding{'s are' if len(result.findings) != 1 else ' is'} ready"
               + (f", {defenses} of them serious enough to be an eviction defense" if defenses else "")
               + ". Your landlord gets 21 days after written notice. Informational, not legal advice.")


def advocate_report(case_id: str, draft: Draft) -> None:
    n = len(draft.complaint["conditions"])
    mode = " It also says the lease ends if repairs aren't made." if draft.mode == "repair_or_terminate" else ""
    db.store.post(case_id, "advocate",
               f"I drafted a repair notice covering {n} problem{'s' if n != 1 else ''}, a complaint packet for the "
               f"Blacksburg code inspector, and {len(draft.deadlines)} calendar deadlines.{mode} Nothing has been sent. "
               "@You please read the letter, edit anything, and approve.")


def approved(case_id: str) -> None:
    db.store.post(case_id, "advocate",
               "Approved. Your letter, complaint packet and deadlines are ready to download. Send the letter in a way "
               "you can prove (certified mail or email), and keep the evidence record.")
