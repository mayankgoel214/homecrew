"""Files the tenant downloads after approving: letter PDF, complaint PDF, deadlines .ics."""

from datetime import datetime, timedelta, timezone

from fpdf import FPDF

from app.agents.advocate import Deadline
from app.agents.lawyer import DISCLAIMER

_ASCII = str.maketrans({"\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
                        "\u2013": "-", "\u2014": "-", "\u2026": "...", "\u00a0": " "})


def _latin1(text: str) -> str:
    # fpdf2's built-in fonts are Latin-1 only (which still includes the § sign).
    return text.translate(_ASCII).encode("latin-1", "replace").decode("latin-1")


def _pdf(title: str, body: str, footer: str) -> bytes:
    pdf = FPDF(format="Letter")
    pdf.set_margins(25, 25, 25)
    pdf.set_auto_page_break(True, margin=25)
    pdf.set_title(title)
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 6, _latin1(body))
    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(110)
    pdf.multi_cell(0, 4, _latin1(footer))
    return bytes(pdf.output())


def letter_pdf(letter_text: str) -> bytes:
    return _pdf("Repair notice", letter_text, "Prepared with HomeCrew. " + DISCLAIMER)


def complaint_pdf(complaint: dict) -> bytes:
    to = complaint["to"]
    lines = [
        "CODE ENFORCEMENT COMPLAINT PACKET",
        "",
        f"To: {to['office']}",
        f"Phone: {to['phone']} (building inspection: {to['building_inspection_phone']})",
        f"Note: {to['note']}",
        "",
        f"Property address: {complaint['property_address'] or '(not provided)'}",
        f"Tenant: {complaint['tenant_name'] or '(not provided)'}",
        f"Landlord: {complaint['landlord_name'] or '(not provided)'}",
        f"Date landlord was notified in writing: {complaint['date_landlord_notified']}",
        "",
        "Conditions:",
    ]
    for n, c in enumerate(complaint["conditions"], start=1):
        lines.append(f"  {n}. {c['issue']} (severity {c['severity']}/5): {c['description']}")
    lines += ["", "Description:", complaint["description"], "", f"Evidence: {complaint['evidence']}"]
    return _pdf("Code complaint packet", "\n".join(lines), "Prepared with HomeCrew. " + DISCLAIMER)


def _ics_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _fold(line: str) -> str:
    # RFC 5545: lines longer than 75 octets continue on the next line after a space.
    out, data = [], line.encode()
    while len(data) > 75:
        cut = 75
        while (data[cut] & 0xC0) == 0x80:  # don't split a UTF-8 character
            cut -= 1
        out.append(data[:cut].decode())
        data = b" " + data[cut:]
    out.append(data.decode())
    return "\r\n".join(out)


def deadlines_ics(draft_id: str, deadlines: list[Deadline]) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HomeCrew//Repair deadlines//EN", "CALSCALE:GREGORIAN"]
    for n, d in enumerate(deadlines):
        lines += [
            "BEGIN:VEVENT",
            f"UID:{draft_id}-{n}@homecrew",
            f"DTSTAMP:{stamp}",
            f"DTSTART;VALUE=DATE:{d.day.strftime('%Y%m%d')}",
            f"DTEND;VALUE=DATE:{(d.day + timedelta(days=1)).strftime('%Y%m%d')}",
            f"SUMMARY:{_ics_escape('HomeCrew: ' + d.title)}",
            f"DESCRIPTION:{_ics_escape(d.detail)}",
            "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-PT12H", f"DESCRIPTION:{_ics_escape(d.title)}", "END:VALARM",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(l) for l in lines) + "\r\n"
