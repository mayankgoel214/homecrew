"""What the crew says in the group chat. Turns agent events and results into chat messages.

Messages are written from facts the agents already produced (labels, sections, counts), not
generated, so the chat can never say something the evidence or the statutes don't support.
"""

from app.agents.advocate import Draft
from app.agents.inspector import Issue
from app.agents.lawyer import LawyerResult
from app import store as db

ROOM = {"living_room": "living room", "other": "", "exterior": "outside"}


def _pct(x: float) -> str:
    return f"{round(x * 100)}%"


def inspector_looking(case_id: str, photo_number: int) -> None:
    db.store.post(case_id, "inspector", f"Looking at photo #{photo_number}…", kind="status")


def inspector_report(case_id: str, frame_id: str, photo_number: int, room: str, issues: list[Issue],
                     say: str = "") -> None:
    """Rosa reports a photo. Her spoken line comes from Gemma (in character); if it's missing we
    build one from the structured findings."""
    refs = {"frame_id": frame_id}
    if not issues:
        db.store.post(case_id, "inspector", say or "This spot looks fine. Keep going.", refs=refs)
        return
    found = "; ".join(i.label for i in issues)
    db.store.post(case_id, "inspector", f"{say or f'I see {found}.'} @Lawyer", refs=refs)
    unsure = [i.label for i in issues if i.needs_human_check]
    if unsure:
        db.store.post(case_id, "inspector",
                      f"I'm not certain about {', '.join(unsure)}. If it's not a real problem, tap it in your case file.",
                      refs=refs)


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


def lawyer_quick_take(case_id: str, issues: list[Issue]) -> None:
    seen = set()
    for issue in issues:
        if issue.type in seen:
            continue
        seen.add(issue.type)
        section, line = QUICK_TAKE.get(issue.type, DEFAULT_TAKE)
        text = f"On the {issue.label}: under § {section}, {line}"
        if issue.severity >= 4:
            text += " It's serious enough that it could help you if you're ever taken to court over rent."
        db.store.post(case_id, "lawyer", text, refs={"section": section})
    db.store.post(case_id, "advocate", "Got it, that's going in your repair letter.")


def greet(case_id: str) -> None:
    db.store.post(case_id, "inspector",
                  "Hi, I'm Rosa! Walk me through your place slowly and point the camera at anything that worries you.")
    db.store.post(case_id, "lawyer", "I'm Theo. I'll tell you what Virginia law says about each thing Rosa finds.")
    db.store.post(case_id, "advocate", "And I'm June. When we hang up, I'll write your repair letter and complaint.")


def call_ended(case_id: str, findings: int) -> None:
    if findings:
        db.store.post(case_id, "advocate", "Thanks for walking us through. Let me put your case file together.")
    else:
        db.store.post(case_id, "inspector", "I didn't spot any problems this time. Call us again if something comes up!")


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
