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


def inspector_report(case_id: str, frame_id: str, photo_number: int, room: str, issues: list[Issue]) -> None:
    where = ROOM.get(room, room.replace("_", " "))
    head = f"Photo #{photo_number}" + (f" ({where})" if where else "")
    refs = {"frame_id": frame_id}
    if not issues:
        db.store.post(case_id, "inspector", f"{head}: no visible problems. I saved it as evidence anyway.", refs=refs)
        return
    found = "; ".join(f"{i.label} ({_pct(i.confidence)} sure, severity {i.severity}/5)" for i in issues)
    db.store.post(case_id, "inspector", f"{head}: I see {found}. @Lawyer this is ready for you.", refs=refs)
    unsure = [i.label for i in issues if i.needs_human_check]
    if unsure:
        db.store.post(case_id, "inspector",
                   f"I'm not certain about {', '.join(unsure)}. Please check it, and tap it in the ledger "
                   "if it's not a real problem.", refs=refs)


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
