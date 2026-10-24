from app.agents import inspector
from app.gemma import parse_json


def test_parse_json_strips_fences():
    assert parse_json('```json\n{"issues": []}\n```') == {"issues": []}
    assert parse_json('Sure! {"a": 1} hope that helps') == {"a": 1}


def test_bbox_conversion():
    # Gemma gives [ymin, xmin, ymax, xmax] in 0..1000; we store normalized [x, y, w, h].
    assert inspector._to_bbox([100, 200, 500, 600]) == [0.2, 0.1, 0.4, 0.4]
    assert inspector._to_bbox([500, 500, 100, 100]) is None
    assert inspector._to_bbox("nope") is None


def test_inspect_normalizes_and_flags(monkeypatch):
    reply = {
        "room_guess": "bathroom",
        "issues": [
            {"type": "mold", "label": "Black mold", "box_2d": [0, 0, 500, 500], "region": "top-left",
             "severity": 4, "confidence": 0.9, "evidence_note": "Mold on ceiling."},
            {"type": "ghost", "label": "Odd stain", "region": "somewhere", "severity": 2,
             "confidence": 0.3, "evidence_note": "Faint stain."},
            {"type": "mold", "label": "bad", "severity": 9, "confidence": 0.9, "evidence_note": "x"},
        ],
    }
    monkeypatch.setattr(inspector, "generate_json", lambda prompt, images: (reply, "fake-gemma"))
    result = inspector.inspect(b"img")
    assert [i.type for i in result.issues] == ["mold", "other"]
    assert result.issues[0].bbox == [0.0, 0.0, 0.5, 0.5]
    assert result.issues[1].region == "center"
    assert result.issues[1].needs_human_check is True
    assert result.issues[0].needs_human_check is False
