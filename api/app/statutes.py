"""The Lawyer's only source of law: Virginia Code sections cached in data/statutes.json."""

import json
import re
from functools import cache
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "statutes.json"


@cache
def _load() -> dict:
    return json.loads(DATA.read_text())


def normalize_section(section: str) -> str:
    """'§ 55.1-1220', 'Va. Code 55.1-1220.' -> '55.1-1220'."""
    match = re.search(r"\d+(?:\.\d+)?-\d+(?:\.\d+)?", str(section))
    return match.group(0) if match else ""


def catalog() -> list[dict]:
    return [{"section": s["section"], "title": s["title"]} for s in _load()["sections"].values()]


def va_code_lookup(section: str) -> dict | None:
    """Tool: return the cached text of one Virginia Code section, or None if we don't have it."""
    return _load()["sections"].get(normalize_section(section))


