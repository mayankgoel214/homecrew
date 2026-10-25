"""Lays the voiceover memos onto the finished cut at their cue times (docs/voiceover-cues.md).

Each memo is trimmed of silence at both ends, sped up just enough to fit its slot if it runs long
(pitch kept; capped at 1.25x so it never sounds rushed), and mixed over the crew audio (the crew is
never talking during a slot, so no ducking is needed).

    python3 voiceover.py <folder with vo1..vo7 (m4a/mp3/wav)>   ->  edit/homecrew-final.mp4
"""

import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
CUT, OUT = HERE / "edit" / "homecrew-demo.mp4", HERE / "edit" / "homecrew-final.mp4"
# name: (start s, must end by s)
SLOTS = {"vo1": (0.2, 14.7), "vo2": (44.3, 55.4), "vo3": (56.1, 58.8), "vo4": (66.6, 71.4),
         "vo5": (72.1, 74.8), "vo6": (95.2, 111.5), "vo7": (112.2, 119.7), "vo-extra": (89.8, 94.5)}


def length(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", str(f)]))


# What each line says (docs/voiceover-cues.md), burned in as captions since accents vary.
SCRIPT = {
    "vo1": "Hi, we're Mayank, Mali and Cinthia, and this is HomeCrew. Virginia renters almost never have a lawyer, "
           "so repair problems go undocumented. HomeCrew is a video call with an AI crew that inspects your home, "
           "cites the law, and writes the letter.",
    "vo2": "Hang up, and your case file is ready: who fixes what, the exact Virginia law, and a repair letter. "
           "Nothing's sent until you approve.",
    "vo3": "Own your home? Same crew.",
    "vo4": "And when a job needs a licensed pro, the crew tells you.",
    "vo5": "Or just describe it. The right expert picks up.",
    "vo6": "Gemma 4 does the seeing: it finds and marks each problem on the camera feed. Fixed safety rules, not AI, "
           "decide who has to fix it. Theo pulls the real statute from Virginia's official legal API, "
           "and June drafts the letter.",
    "vo7": "HomeCrew. Built on Gemma 4. A crew in every renter's pocket.",
}
CAPTION_Y = 1080 - 170


def chunks(text, limit=62):
    """Caption-sized pieces: one per sentence, long sentences split at the comma nearest the middle
    (or evenly by words), so no piece is a stranded word or two."""
    out = []
    for sentence in re.split(r"(?<=[.?!])\s+", text.strip()):
        pending = [sentence]
        while pending:
            piece = pending.pop(0)
            if len(piece) <= limit:
                out.append(piece)
                continue
            mid = len(piece) / 2
            commas = [m.end() for m in re.finditer(r"[,:]\s", piece)]
            cut = min(commas, key=lambda c: abs(c - mid)) if commas and min(abs(c - mid) for c in commas) < len(piece) * 0.3 else None
            if cut is None:
                words = piece.split()
                half = len(words) // 2
                left, right = " ".join(words[:half]), " ".join(words[half:])
            else:
                left, right = piece[:cut].strip(), piece[cut:].strip()
            pending[:0] = [left, right]
    merged = []  # a tiny piece rides along with its neighbour ("Own your home? Same crew.")
    for piece in out:
        if merged and (len(piece) < 24 or len(merged[-1]) < 24) and len(merged[-1]) + len(piece) < limit:
            merged[-1] += " " + piece
        else:
            merged.append(piece)
    return merged


TRIM = ("silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
        "silenceremove=start_periods=1:start_threshold=-45dB,areverse")
WORK = HERE / "edit" / "vo"


def prepare(name, f, slot_len):
    """Silence-trimmed WAV, tempo-fitted to the slot. Returns (file, spoken seconds, tempo)."""
    WORK.mkdir(parents=True, exist_ok=True)
    trimmed = WORK / f"{name}-trim.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(f), "-af", TRIM, "-ar", "48000", str(trimmed)], check=True)
    spoken = length(trimmed)
    tempo = min(1.25, max(1.0, spoken / (slot_len - 0.1)))
    fitted = WORK / f"{name}.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(trimmed), "-af", f"atempo={tempo:.4f},loudnorm=I=-16:TP=-1.5",
                    "-ar", "48000", "-ac", "2", str(fitted)], check=True)
    return fitted, spoken, tempo


def main(folder):
    found = []
    for name, slot in SLOTS.items():
        files = [p for p in Path(folder).glob(f"{name}.*") if p.suffix.lower() in (".m4a", ".mp3", ".wav", ".aac", ".caf")]
        if files:
            found.append((name, files[0], slot))
    if not found:
        sys.exit(f"no vo1..vo7 files in {folder}")
    inputs, chains, captions = ["-i", str(CUT)], [], []
    for n, (name, f, (start, end)) in enumerate(found, 1):
        fitted, spoken, tempo = prepare(name, f, end - start)
        if name in SCRIPT:  # spread the line's chunks over the time it's actually spoken, by length
            said = min(spoken / tempo, end - start)
            parts = chunks(SCRIPT[name])
            total, t = sum(len(p) for p in parts), start
            for k, part in enumerate(parts):
                d = said * len(part) / total
                captions.append((WORK / f"{name}-{k}.png", part, t, t + d))
                t += d
        inputs += ["-i", str(fitted)]
        ms = int(start * 1000)
        chains.append(f"[{n}:a]atrim=0:{end - start:.2f},afade=t=out:st={max(0, end - start - 0.12):.2f}:d=0.12,"
                      f"aformat=sample_rates=48000:channel_layouts=stereo,adelay={ms}|{ms}[v{n}]")
        cut = spoken / tempo > end - start
        print(f"{name}: at {start:6.1f}s  slot {end - start:4.1f}s  spoken {spoken:4.1f}s  "
              f"speed {tempo:.2f}x{'  (still too long: re-record faster)' if cut else ''}")
    mix = "[0:a]" + "".join(f"[v{n}]" for n in range(1, len(found) + 1))
    chains.append(f"{mix}amix=inputs={len(found) + 1}:normalize=0:dropout_transition=0,alimiter=limit=0.95[a]")

    jobs = WORK / "captions.json"
    jobs.write_text(json.dumps([{"file": str(png), "text": text} for png, text, _, _ in captions]))
    subprocess.run(["node", str(HERE / "captions.mjs"), str(jobs)], check=True)
    first = len(found) + 1
    prev = "0:v"
    for k, (png, _, a, b) in enumerate(captions):
        inputs += ["-i", str(png)]
        chains.append(f"[{prev}][{first + k}:v]overlay=0:{CAPTION_Y}:enable='between(t,{a:.2f},{b:.2f})'[c{k}]")
        prev = f"c{k}"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chains),
                    "-map", f"[{prev}]" if captions else "0:v", "-map", "[a]",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(OUT)], check=True)
    for _, text, a, b in captions:
        print(f"    {a:6.2f}-{b:6.2f}  {text}")
    print(f"{OUT}  {length(OUT):.2f}s")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
