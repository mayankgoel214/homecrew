"""Lays the voiceover memos onto the finished cut at their cue times (docs/voiceover-cues.md).

Each memo is trimmed of leading silence, cut off at its slot's end, and mixed over the crew audio
(the crew is never talking during a slot, so no ducking is needed).

    python3 voiceover.py <folder with vo1..vo7 (m4a/mp3/wav)>   ->  edit/homecrew-final.mp4
"""

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


def main(folder):
    found = []
    for name, slot in SLOTS.items():
        files = [p for p in Path(folder).glob(f"{name}.*") if p.suffix.lower() in (".m4a", ".mp3", ".wav", ".aac", ".caf")]
        if files:
            found.append((name, files[0], slot))
    if not found:
        sys.exit(f"no vo1..vo7 files in {folder}")
    inputs, chains = ["-i", str(CUT)], []
    for n, (name, f, (start, end)) in enumerate(found, 1):
        inputs += ["-i", str(f)]
        ms = int(start * 1000)
        # trim leading silence, normalize loudness, keep inside the slot, then place it
        chains.append(f"[{n}:a]silenceremove=start_periods=1:start_threshold=-45dB,loudnorm=I=-16:TP=-1.5,"
                      f"atrim=0:{end - start:.2f},afade=t=out:st={max(0, end - start - 0.15):.2f}:d=0.15,"
                      f"aformat=sample_rates=48000:channel_layouts=stereo,adelay={ms}|{ms}[v{n}]")
        spoken = length(f)
        flag = "  (will be cut off)" if spoken > end - start + 0.6 else ""
        print(f"{name}: {start:6.1f}s  slot {end - start:4.1f}s  memo {spoken:4.1f}s{flag}")
    mix = "[0:a]" + "".join(f"[v{n}]" for n in range(1, len(found) + 1))
    chains.append(f"{mix}amix=inputs={len(found) + 1}:normalize=0:dropout_transition=0,alimiter=limit=0.95[a]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chains),
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-movflags", "+faststart", str(OUT)], check=True)
    print(f"{OUT}  {length(OUT):.2f}s")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
