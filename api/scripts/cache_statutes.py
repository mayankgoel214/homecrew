"""Cache the Virginia Code sections the Lawyer may cite into data/statutes.json.

    cd api && uv run python scripts/cache_statutes.py

Source: the Virginia Legislative Information System's public JSON API. The demo reads only
the cached file, so it never depends on the live API. Where a section has several versions
with different effective dates, we keep the one in force today and note the upcoming change.
"""

import html
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path

import httpx

API = "https://law.lis.virginia.gov/api/CoVSectionsGetSectionDetailsJson/{}/"
PAGE = "https://law.lis.virginia.gov/vacode/{}/"
OUT = Path(__file__).resolve().parent.parent / "data" / "statutes.json"

SECTIONS = [
    "55.1-1220",  # landlord to maintain fit premises
    "55.1-1226",  # security deposits
    "55.1-1227",  # tenant duties (incl. reporting mold)
    "55.1-1231",  # relocation for mold remediation
    "55.1-1234",  # landlord noncompliance: 21-day notice
    "55.1-1239",  # failure to supply essential services
    "55.1-1241",  # habitability defense in nonpayment cases (2026 SB 373)
    "55.1-1244",  # tenant's assertion / rent escrow
    "55.1-1244.1",  # tenant's remedy by repair
    "55.1-1258",  # retaliation prohibited
]

_UNTIL = re.compile(r"^\(Effective until (\w+ \d{1,2}, \d{4})\)\s*")
_FROM = re.compile(r"^\(Effective (\w+ \d{1,2}, \d{4})\)\s*")


def to_text(body_html: str) -> str:
    text = re.sub(r"</p>\s*<p[^>]*>", "\n\n", body_html)
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n{3,}", "\n\n", text)).strip()


def parse_date(s: str) -> date:
    return datetime.strptime(s, "%B %d, %Y").date()


def pick_current(versions: list[dict], today: date) -> tuple[dict, str | None]:
    """Return (version in force today, note about an upcoming version or None)."""
    current, upcoming = None, None
    for v in versions:
        title = v["SectionTitle"]
        if m := _FROM.match(title):
            if parse_date(m.group(1)) > today:
                upcoming = m.group(1)
                continue
        if m := _UNTIL.match(title):
            if parse_date(m.group(1)) <= today:
                continue
        current = v
    if current is None:
        raise ValueError("no version in force today")
    return current, (f"A new version takes effect {upcoming}." if upcoming else None)


def main() -> None:
    today = date.today()
    statutes = {}
    with httpx.Client(timeout=30, headers={"User-Agent": "HomeCrew hackathon (statute cache)"}) as client:
        for section in SECTIONS:
            data = client.get(API.format(section)).raise_for_status().json()
            version, note = pick_current(data["ChapterList"], today)
            title = _FROM.sub("", _UNTIL.sub("", version["SectionTitle"])).strip()
            statutes[section] = {
                "section": section,
                "title": title,
                "article": version["ArticleName"],
                "text": to_text(version["Body"]),
                "url": PAGE.format(section),
                "upcoming_change": note,
            }
            print(f"§ {section}  {title}  ({len(statutes[section]['text'].split())} words)"
                  + (f"  [{note}]" if note else ""))

    OUT.write_text(json.dumps({
        "source": "Code of Virginia via law.lis.virginia.gov JSON API",
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "in_force_on": today.isoformat(),
        "sections": statutes,
    }, indent=2, ensure_ascii=False))
    print(f"\nWrote {len(statutes)} sections to {OUT}")


if __name__ == "__main__":
    main()
