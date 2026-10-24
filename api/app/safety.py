"""The safety router. Every finding and every question passes through here before the crew gives
advice. It is deliberately plain code, not a model: the tiers and the safe steps below are fixed
and reviewed, so the AI can never talk someone into panel work or a gas repair.

Tiers:
  emergency - danger now: leave / call 911 or the utility. Shown as a full-screen card.
  pro       - don't touch it: needs a licensed pro (and for renters, it's the landlord's to arrange)
  landlord  - renter: the landlord must fix it under Va. Code § 55.1-1220; safe stopgaps only
  diy       - safe to handle yourself with the steps given
"""

import re

from pydantic import BaseModel

TIER_ORDER = {"emergency": 3, "pro": 2, "landlord": 1, "diy": 0}


class Emergency(BaseModel):
    kind: str
    title: str
    steps: list[str]
    call: str  # number to offer as a tap-to-call button


EMERGENCIES: dict[str, Emergency] = {
    "gas": Emergency(
        kind="gas", title="Possible gas leak. Leave now.", call="911",
        steps=["Get everyone out of the home right away.",
               "Don't flip light switches, unplug anything, or light a flame.",
               "Once you're outside and away from the building, call 911 or your gas company.",
               "Don't go back in until they say it's safe."],
    ),
    "co": Emergency(
        kind="co", title="Carbon monoxide danger. Get to fresh air.", call="911",
        steps=["Get everyone, including pets, outside into fresh air now.",
               "Call 911 from outside.",
               "Don't go back in until responders say it's safe."],
    ),
    "fire": Emergency(
        kind="fire", title="Fire or sparks. Get out.", call="911",
        steps=["Get everyone out and close doors behind you.",
               "Call 911 from outside.",
               "Don't use water on electrical sparks or fire."],
    ),
    "flood": Emergency(
        kind="flood", title="Active flooding. Stay safe.", call="911",
        steps=["Stay out of standing water near outlets, cords or appliances.",
               "If you can reach it without touching water, close the main water shutoff.",
               "Call your landlord's emergency line, or 911 if anyone is in danger.",
               "Take photos once you're safe."],
    ),
}

# Words that mean danger right now, in what someone says on the call or what the Inspector sees.
EMERGENCY_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("gas", re.compile(r"\b(smell(s|ing)? (of )?gas|gas (leak|smell)|rotten eggs?|hissing (sound|noise)? ?(from|near)? ?(the )?(stove|gas|pipe))\b", re.I)),
    ("co", re.compile(r"\b(carbon monoxide|co (alarm|detector) (is )?(going off|beeping|sounding)|(dizzy|headache) .*(heater|furnace|stove))\b", re.I)),
    ("fire", re.compile(r"\b(fire|flames?|sparks?|sparking|smoke coming|burning smell|smells? like burning)\b", re.I)),
    ("flood", re.compile(r"\b(flood(ing|ed)?|water (is )?(pouring|gushing|everywhere)|burst pipe)\b", re.I)),
]

# Jobs the crew always refuses to walk anyone through, however they're asked.
NEVER_DIY = re.compile(
    r"\b(breaker panel|electrical panel|fuse box|rewir\w*|wire (a|an|the)|replace (an? |the )?(outlet|switch)|"
    r"gas (line|pipe|valve|stove|furnace|heater)|pilot light|relief valve|t&p valve|water heater (element|thermostat)|"
    r"asbestos|popcorn ceiling|lead paint|sand(ing)? (the )?paint|scrap(e|ing) (the )?paint|"
    r"roof|ladder|load.bearing|structural|foundation)\b",
    re.I,
)

# Safe, reviewed first steps. DIY tiers use them as the fix; landlord tiers use them as stopgaps.
SAFE_STEPS: dict[str, list[str]] = {
    "water_damage": ["Find the shutoff valve under the sink or behind the toilet and turn it clockwise to stop the water.",
                     "Put down towels and a bucket, and keep water away from outlets.",
                     "Take photos of the leak and the damage."],
    "mold": ["If it's smaller than about 3 by 3 feet: wear gloves and a mask, scrub with detergent and water, then dry it fully.",
             "Don't paint over it, and run a fan or open a window.",
             "Bigger than that, or after a flood or sewage backup, it needs a professional."],
    "pest": ["Store food in sealed containers and take the trash out daily.",
             "Wipe up droppings with gloves and a disinfectant spray; don't sweep or vacuum them dry.",
             "Don't use foggers or bombs."],
    "no_heat_indicator": ["Check the thermostat is set to Heat and above room temperature, and replace its batteries.",
                          "Reset the furnace's breaker once. If it trips again, leave it off.",
                          "Replace a dirty air filter if you can reach it without tools."],
    "broken_lock": ["Secure the door for tonight with a door wedge or a portable door lock.",
                    "Don't take the lock apart yourself in a rental."],
    "broken_window": ["Cover broken glass with cardboard and tape, and wear gloves picking up shards.",
                      "Block a window that won't lock with a dowel in the track."],
    "missing_smoke_detector": ["Put up a battery smoke alarm today as a stopgap.",
                               "Test it with its button."],
    "accessibility_barrier": ["Mark it and avoid it until it's fixed, especially at night."],
    "clogged_drain": ["Pull out the stopper and clear hair or gunk by hand, with gloves on.",
                      "Use a cup plunger: a little water in the sink, cover the overflow hole, plunge 15 to 20 times.",
                      "Don't mix drain cleaners, and don't use one after plunging. Still slow? Call your landlord or a plumber."],
}

# Never DIY, whoever owns the place.
ALWAYS_PRO = {"exposed_wiring"}
PRO_REASON = {
    "exposed_wiring": "Don't touch it. Exposed wiring needs a licensed electrician.",
}
# What a renter's landlord must handle under Va. Code § 55.1-1220.
LANDLORD_DUTY = {"mold", "water_damage", "pest", "no_heat_indicator", "broken_lock", "broken_window",
                 "missing_smoke_detector", "exposed_wiring", "accessibility_barrier", "other"}


# What counts as an emergency in what the camera sees: only active danger, so an old water
# stain "from a past flood" doesn't set off the alarm.
VISUAL_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("fire", re.compile(r"\b(flames?|sparks?|sparking|active fire|smoke (coming|pouring|rising))\b", re.I)),
    ("flood", re.compile(r"\b(water (is )?(pouring|gushing|spraying)|active(ly)? flooding|burst pipe)\b", re.I)),
]


def emergency_in(text: str, spoken: bool = True) -> Emergency | None:
    for kind, pattern in EMERGENCY_PATTERNS if spoken else VISUAL_PATTERNS:
        if pattern.search(text or ""):
            return EMERGENCIES[kind]
    return None


def classify(issue_type: str, label: str, note: str, severity: int, renter: bool) -> dict:
    """Returns {"tier", "headline", "steps"} for one finding."""
    if emergency := emergency_in(f"{label} {note}", spoken=False):
        return {"tier": "emergency", "headline": emergency.title, "steps": emergency.steps, "emergency": emergency.kind}

    steps = SAFE_STEPS.get(issue_type, [])
    big_mold = issue_type == "mold" and severity >= 4  # stand-in for "bigger than ~10 sq ft"
    needs_pro = issue_type in ALWAYS_PRO or big_mold or bool(NEVER_DIY.search(f"{label} {note}"))

    if needs_pro:
        reason = PRO_REASON.get(issue_type) or (
            "This looks like more than a small patch. Mold this size needs a professional." if big_mold
            else "Please don't try this yourself. It needs a licensed professional.")
        if renter and issue_type in LANDLORD_DUTY:
            reason += " As a renter, it's your landlord's job to get it fixed."
        if big_mold:
            stopgap = ["Don't scrub or disturb it. Run a fan or open a window, and keep that room's door closed."]
        elif issue_type in ALWAYS_PRO:
            stopgap = []
        else:
            stopgap = [s for s in steps if "professional" not in s][:1]
        return {"tier": "pro", "headline": reason, "steps": stopgap}

    if renter and issue_type in LANDLORD_DUTY:
        return {"tier": "landlord", "headline": "Your landlord has to fix this. Here's what you can safely do meanwhile.",
                "steps": steps[:2]}

    if steps:
        return {"tier": "diy", "headline": "You can handle this yourself.", "steps": steps}
    return {"tier": "pro", "headline": "Have a professional take a look.", "steps": []}


REFUSAL_TOPICS = [
    (re.compile(r"panel|fuse box|breaker", re.I), "the electrical panel"),
    (re.compile(r"rewir|wire|outlet|switch", re.I), "wiring, outlets or switches"),
    (re.compile(r"gas|pilot", re.I), "gas lines or gas appliances"),
    (re.compile(r"relief valve|t&p|water heater", re.I), "the water heater"),
    (re.compile(r"asbestos|popcorn|lead|paint", re.I), "old paint or ceilings that may contain lead or asbestos"),
    (re.compile(r"roof|ladder", re.I), "roofs or ladders"),
    (re.compile(r"load.bearing|structural|foundation", re.I), "structural repairs"),
]


def refuse_reason(question: str) -> str | None:
    """A fixed answer for questions asking how to do a never-DIY job, or None if it's fine to answer."""
    match = NEVER_DIY.search(question or "")
    if not match:
        return None
    topic = next((name for pattern, name in REFUSAL_TOPICS if pattern.search(match.group(0))), "that kind of repair")
    return (f"I can't walk you through work on {topic}. It's dangerous without training and needs a licensed "
            "professional. If you rent, that's your landlord's job to arrange.")
