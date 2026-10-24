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


TIER_TAIL = {
    "pro": "Don't touch it. Call a pro.",
    "landlord": "Landlord's job.",
    "diy": "You can fix this.",
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
        line = f"{line} {TIER_TAIL[tier]}"
        refs["tier"] = tier
    if tier in ("landlord", "pro"):
        line += " @Lawyer"
    db.store.post(case_id, "inspector", line, refs=refs)


def emergency(case_id: str, e: Emergency) -> None:
    db.store.post(case_id, "inspector", e.title, kind="emergency", refs={"emergency": e.kind})


def checklist_prompt(case_id: str, trade_id: str, step: int) -> None:
    items = trades.get(trade_id).checklist
    if step < len(items):
        db.store.post(case_id, "inspector", f"Next, show me {items[step]}.")


# Theo's instant take during the call. Each line restates a specific subsection of the cached
# statute text (no model call), so it's immediate and can't misquote the law. The full,
# Gemma-written legal review runs when the call ends.
QUICK_TAKE = {
    "mold": ("55.1-1220", "your landlord has to keep moisture and mold out, and when mold is visible they have to promptly remediate it."),
    "water_damage": ("55.1-1220", "your landlord has to keep the place from collecting moisture, which is what leads to mold."),
    "exposed_wiring": ("55.1-1220", "your landlord has to keep the electrical in good and safe working order."),
    "no_heat_indicator": ("55.1-1220", "your landlord has to supply heat in season and hot water."),
    "missing_smoke_detector": ("55.1-1220", "smoke alarms have to be there and working, and your landlord has to certify that every year."),
    "pest": ("55.1-1244.1", "for rodents, once you tell your landlord in writing they have 14 days to take reasonable steps."),
}
DEFAULT_TAKE = ("55.1-1220", "your landlord has to make the repairs needed to keep the place fit and habitable.")

# What Theo actually says on the call: one beat, about 6 words. The full explanation is in the
# case file; on the call he just confirms whose problem it is and the section.
# The hand-off on every finding: Rosa spots it, Theo answers her, June answers him. Short lines
# that name each other, so it sounds like a crew talking, not three separate announcements.
# The section numbers and full explanations live in the case file.
THEO_LINES = [
    "Good catch, Rosa. That's on your landlord.",
    "Landlord has to fix that one too.",
    "Same rule, Rosa. Landlord's job.",
]
JUNE_LINES = [
    "Got it, Theo. It's going in the letter.",
    "Adding that to the letter.",
    "That's in the letter too.",
]


def lawyer_quick_take(case_id: str, issues: list[Issue]) -> None:
    """Renters only. Theo answers Rosa, then June answers Theo, once per kind of problem in THIS
    call (a new take or 'Call again' starts the conversation over)."""
    case = db.store.get(case_id)
    this_call = [m for m in case.chat if m.seq >= case.call_seq]
    already = {m.refs.get("issue_type") for m in this_call if m.agent == "lawyer"}
    n = sum(1 for m in this_call if m.agent == "lawyer")
    for issue in issues:
        if issue.type in already or not issue.safety or issue.safety["tier"] not in ("landlord", "pro"):
            continue
        already.add(issue.type)
        section, _ = QUICK_TAKE.get(issue.type, DEFAULT_TAKE)
        db.store.post(case_id, "lawyer", THEO_LINES[min(n, len(THEO_LINES) - 1)],
                      refs={"section": section, "issue_type": issue.type})
        db.store.post(case_id, "advocate", JUNE_LINES[min(n, len(JUNE_LINES) - 1)])
        n += 1


def greet(case_id: str, trade_id: str = "general", renter: bool = True, problem: str = "") -> None:
    t = trades.get(trade_id)
    if problem:
        opener = f"Hi, I'm {t.name}, your {t.role.lower()}. Show me the problem."
    else:
        opener = f"Hi, I'm {t.name}. Show me what's wrong."
    db.store.post(case_id, "inspector", opener)


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
