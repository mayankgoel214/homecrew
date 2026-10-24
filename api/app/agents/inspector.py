from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, field_validator

from app.gemma import GemmaError, Image, generate_json

PROMPT = (Path(__file__).parent.parent / "prompts" / "inspector.md").read_text()
HUMAN_CHECK_BELOW = 0.5

IssueType = Literal[
    "mold",
    "water_damage",
    "broken_lock",
    "exposed_wiring",
    "no_heat_indicator",
    "pest",
    "broken_window",
    "missing_smoke_detector",
    "accessibility_barrier",
    "other",
]
Region = Literal[
    "top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"
]


class Issue(BaseModel):
    type: IssueType = "other"
    label: str
    # Normalized [x, y, w, h] in 0..1, converted from Gemma's [ymin, xmin, ymax, xmax] 0..1000.
    bbox: list[float] | None = None
    region: Region = "center"
    severity: int = Field(ge=1, le=5)
    confidence: float = Field(ge=0, le=1)
    evidence_note: str
    needs_human_check: bool = False

    @field_validator("type", mode="before")
    @classmethod
    def _unknown_type_is_other(cls, v):
        return v if v in IssueType.__args__ else "other"

    @field_validator("region", mode="before")
    @classmethod
    def _unknown_region_is_center(cls, v):
        return v if v in Region.__args__ else "center"


class InspectorResult(BaseModel):
    room_guess: str = "other"
    issues: list[Issue]
    model: str


def _to_bbox(box) -> list[float] | None:
    if not (isinstance(box, list) and len(box) == 4):
        return None
    try:
        ymin, xmin, ymax, xmax = (min(max(float(v), 0), 1000) / 1000 for v in box)
    except (TypeError, ValueError):
        return None
    if xmax <= xmin or ymax <= ymin:
        return None
    return [round(xmin, 4), round(ymin, 4), round(xmax - xmin, 4), round(ymax - ymin, 4)]


def inspect(image: bytes, notes: str = "", mime_type: str = "image/jpeg") -> InspectorResult:
    prompt = PROMPT + (f"\n\nTenant's note about this photo: {notes[:500]}" if notes else "")
    raw, model = generate_json(prompt, [Image(image, mime_type)])
    if isinstance(raw, list):
        raw = {"issues": raw}
    if not isinstance(raw, dict):
        raise GemmaError("Inspector reply was not a JSON object")

    issues: list[Issue] = []
    for item in raw.get("issues") or []:
        if not isinstance(item, dict):
            continue
        item = {**item, "bbox": _to_bbox(item.get("box_2d"))}
        item.setdefault("label", item.get("type", "issue"))
        item.setdefault("evidence_note", item["label"])
        try:
            issue = Issue.model_validate(item)
        except ValidationError:
            continue
        issue.needs_human_check = issue.confidence < HUMAN_CHECK_BELOW
        issues.append(issue)

    return InspectorResult(room_guess=str(raw.get("room_guess") or "other"), issues=issues, model=model)
