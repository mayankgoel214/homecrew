"""Hour-one test: run the Inspector on every photo in samples/ and draw its boxes.

    cd api && uv run python scripts/eval_inspector.py [../samples]

Writes samples/out/<name>.jpg (boxes drawn) and samples/out/results.json.
Name photos after what's in them (mold_1.jpg, lock_2.jpg, clean_kitchen.jpg) so the
summary can show whether the expected issue type was found.
"""

import json
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.agents.inspector import inspect  # noqa: E402

COLORS = {1: "#22c55e", 2: "#84cc16", 3: "#eab308", 4: "#f97316", 5: "#ef4444"}
EXPECT = {
    "clean": None,  # checked first so "clean_smoke_detector" expects no issues
    "mold": "mold", "water": "water_damage", "lock": "broken_lock", "wiring": "exposed_wiring",
    "outlet": "exposed_wiring", "pest": "pest", "roach": "pest", "mouse": "pest",
    "window": "broken_window", "smoke": "missing_smoke_detector"
}


def load_jpeg(path: Path) -> tuple[Image.Image, bytes]:
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    img.thumbnail((1024, 1024))
    from io import BytesIO

    buf = BytesIO()
    img.save(buf, "JPEG", quality=85)
    return img, buf.getvalue()


def main() -> None:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parents[2] / "samples")
    out = src / "out"
    out.mkdir(exist_ok=True)
    photos = sorted(p for p in src.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
    if not photos:
        sys.exit(f"No photos in {src}")

    results, rows = [], []
    for path in photos:
        img, data = load_jpeg(path)
        t0 = time.time()
        try:
            res = inspect(data)
        except Exception as e:  # keep going so one bad photo doesn't kill the run
            rows.append((path.name, "ERROR", str(e)[:80], ""))
            continue
        secs = time.time() - t0

        draw = ImageDraw.Draw(img)
        w, h = img.size
        for issue in res.issues:
            if issue.bbox:
                x, y, bw, bh = issue.bbox
                color = COLORS[issue.severity]
                draw.rectangle([x * w, y * h, (x + bw) * w, (y + bh) * h], outline=color, width=4)
                draw.text((x * w + 6, y * h + 4), f"{issue.type} {issue.confidence:.2f}", fill=color)
        img.save(out / f"{path.stem}.jpg")

        expected = next((v for k, v in EXPECT.items() if k in path.stem.lower()), "?")
        found = [i.type for i in res.issues]
        if expected == "?":
            verdict = "-"
        elif expected is None:
            verdict = "OK" if not found else "FALSE POSITIVE"
        else:
            verdict = "OK" if expected in found else "MISSED"
        rows.append((path.name, verdict, ", ".join(found) or "(none)", f"{secs:.1f}s"))
        results.append({"file": path.name, "seconds": round(secs, 1), **res.model_dump()})

    (out / "results.json").write_text(json.dumps(results, indent=2))
    width = max(len(r[0]) for r in rows)
    for name, verdict, found, secs in rows:
        print(f"{name:<{width}}  {verdict:<15} {secs:>6}  {found}")
    ok = sum(r[1] == "OK" for r in rows)
    scored = sum(r[1] in {"OK", "MISSED", "FALSE POSITIVE"} for r in rows)
    print(f"\n{ok}/{scored} correct. Boxes drawn in {out}")


if __name__ == "__main__":
    main()
