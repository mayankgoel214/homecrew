"""The experts a tenant can call. Each is the same Inspector agent with a trade focus, a name,
a voice, and the walk-through a real tech of that trade would ask for on a video call."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Trade:
    id: str
    name: str  # the expert's first name
    role: str
    voice: str  # Cartesia voice id
    focus: str  # what this expert looks for (goes into the Inspector prompt)
    checklist: tuple[str, ...]  # what they ask to see, in order


TRADES: dict[str, Trade] = {
    "general": Trade(
        "general", "Rosa", "Home inspector", "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",
        "any habitability or safety problem anywhere in the home",
        ("the room that worries you most", "the bathroom, around the tub and under the sink",
         "the kitchen sink and the cabinet under it", "the smoke alarm and the door locks"),
    ),
    "plumber": Trade(
        "plumber", "Marco", "Plumber", "30894953-bcce-41fe-892c-15ce19c843ff",
        "leaks, drips, water stains, wet cabinets, corroded pipes, running toilets, slow drains and the water heater",
        ("the cabinet under the kitchen sink", "behind and around the toilet",
         "the ceiling and walls near the bathroom", "the water heater and the label on it"),
    ),
    "electrician": Trade(
        "electrician", "Dana", "Electrician", "f786b574-daa5-4673-aa0c-cbe3e8534c02",
        "exposed or damaged wiring, scorched or cracked outlets, missing cover plates, overloaded power strips and missing smoke alarms",
        ("the outlet or switch that worries you", "any outlets that feel warm or look scorched",
         "the smoke alarm on the ceiling", "the breaker panel door, closed is fine"),
    ),
    "hvac": Trade(
        "hvac", "Sam", "Heating & AC tech", "a5136bf9-224c-4d76-b823-52bd5efcffcc",
        "broken heaters or radiators, thermostats, dirty filters, blocked vents, condensation and signs of no heat",
        ("the thermostat screen", "the furnace or air handler and its filter slot",
         "a vent or radiator in the coldest room", "the label with the model number"),
    ),
    "pest": Trade(
        "pest", "Lena", "Pest specialist", "c46cf1f6-49a1-4d67-9a57-ff859a4046d3",
        "droppings, insects, nests, gnaw marks, entry holes and gaps around pipes",
        ("under the kitchen sink and behind the trash", "along the baseboards and corners",
         "gaps around pipes and behind the fridge or stove", "the pantry or food shelves"),
    ),
    "locks": Trade(
        "locks", "Archie", "Locks & doors tech", "ef191366-f52f-447a-a398-ed8c0f2943a1",
        "broken or loose locks and deadbolts, damaged door frames and strike plates, windows that won't lock and broken glass",
        ("the front door lock and deadbolt", "the door frame where the bolt goes in",
         "each window latch", "any sliding door and its lock"),
    ),
    "mold": Trade(
        "mold", "Rosa", "Mold & water specialist", "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",
        "mold, mildew, water damage, damp walls, bubbling paint and the leak causing it",
        ("the spot where you see mold or stains", "the ceiling above it and the wall around it",
         "the bathroom vent fan and window", "under the sinks"),
    ),
}


def get(trade_id: str | None) -> Trade:
    return TRADES.get(trade_id or "general", TRADES["general"])


import re as _re

ROUTES: list[tuple[str, _re.Pattern]] = [
    ("plumber", _re.compile(r"water heater|no (hot )?water|hot water", _re.I)),  # before HVAC's "hot"
    ("electrician", _re.compile(r"outlet|socket|switch|wir|spark|breaker|fuse|power|light.*(flicker|out)|smoke (alarm|detector)|shock", _re.I)),
    ("hvac", _re.compile(r"heat|furnace|thermostat|\bac\b|a/c|air.?con|cold|hot|vent|filter|radiator|boiler", _re.I)),
    ("pest", _re.compile(r"mouse|mice|rat|roach|cockroach|bug|bed.?bug|ant|insect|droppings|pest|termite|spider", _re.I)),
    ("locks", _re.compile(r"lock|deadbolt|door|window|latch|key|glass|broken into|break.?in", _re.I)),
    ("mold", _re.compile(r"mold|mould|mildew|damp|musty|black spots|stain on (the )?(wall|ceiling)", _re.I)),
    ("plumber", _re.compile(r"sink|drain|toilet|leak|drip|faucet|tap|pipe|water heater|shower|tub|clog|flush|no (hot )?water", _re.I)),
]


def route(text: str) -> Trade:
    """Pick the expert for a plain-language problem. Falls back to the general inspector."""
    for trade_id, pattern in ROUTES:
        if pattern.search(text or ""):
            return TRADES[trade_id]
    return TRADES["general"]
