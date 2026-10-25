"""Cuts the three recorded takes into the 2:00 demo video (no voiceover yet).

Each segment is a time range of one take at one speed, laid over that section's side panel. Crew
lines only ever play at 1x; sped-up stretches are silent and carry a speed badge. Prints the cue
sheet (where each voiceover goes) at the end.

    node panels.mjs && python3 edit.py      ->  edit/homecrew-demo.mp4
"""

import subprocess
from pathlib import Path

HERE = Path(__file__).parent
TAKES, PANELS, WORK = HERE / "takes", HERE / "edit" / "panels", HERE / "edit" / "segments"
OUT = HERE / "edit" / "homecrew-demo.mp4"
TOTAL = 120.0
PHONE = (729, 40, 462, 1000)  # x, y, w, h; same as panels.mjs
BADGE_AT = (1205, 40)

# (section, take, start s, end s, speed). Times are from takes/<take>/demo.mp4.
SEGMENTS = [
    ("intro", "renter", 0.0, 4.0, 1),     # crew pops up
    ("intro", "plumber", 1.0, 5.8, 1),
    ("intro", "owner", 1.0, 5.2, 1),
    ("intro", "renter", 4.0, 6.0, 1),     # tap "Start a video call"
    ("renter", "renter", 6.0, 14.6, 1),   # Rosa, Theo, June say hi
    ("renter", "renter", 14.6, 19.4, 3),
    ("renter", "renter", 19.4, 30.5, 1),  # door: Rosa -> Theo + law card -> June
    ("renter", "renter", 30.5, 42.3, 4),
    ("renter", "renter", 42.3, 47.0, 1),  # chair: "yours to fix"
    ("report", "renter", 47.0, 63.0, 2),  # hang up, verdict, open the door's row
    ("report", "renter", 63.0, 78.2, 4),  # write letter, approve, downloads
    ("owner", "owner", 4.5, 10.0, 1),     # I RENT -> I OWN, call, Rosa says hi
    ("owner", "owner", 10.0, 26.8, 6),
    ("owner", "owner", 26.8, 33.8, 1),    # wall stain + how-to
    ("owner", "owner", 33.8, 41.5, 3),    # case file: DIY steps
    ("plumber", "plumber", 5.8, 9.0, 1),  # type "my sink won't drain"
    ("plumber", "plumber", 9.0, 12.0, 1), # Marco says hi
    ("plumber", "plumber", 12.0, 17.2, 3),
    ("plumber", "plumber", 17.2, 27.3, 1),  # sink + how-to
    ("plumber", "plumber", 27.3, 32.5, 4),
    ("plumber", "plumber", 32.5, 40.0, 2),  # case file: DIY steps
]
BUILT_SECONDS = 16.0  # "How we built it" slide; the end card takes whatever is left of 2:00

ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30",
       "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]


def run(args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def badge(speed):
    label = f"{speed:g}x"
    return PANELS / f"badge-{label}.png"


def phone_segment(i, section, take, start, end, speed):
    dur = (end - start) / speed
    x, y, w, h = PHONE
    inputs = ["-loop", "1", "-i", str(PANELS / f"{section}.png"),
              "-i", str(TAKES / take / "demo.mp4"),
              "-loop", "1", "-i", str(PANELS / "mask.png")]
    v = (f"[1:v]trim={start}:{end},setpts=(PTS-STARTPTS)/{speed},fps=30,scale={w}:{h},format=rgba[ph];"
         f"[2:v]scale={w}:{h},format=gray[m];[ph][m]alphamerge[phm];"
         f"[0:v][phm]overlay={x}:{y}:shortest=1[v0]")
    if speed != 1:
        inputs += ["-loop", "1", "-i", str(badge(speed))]
        v += f";[v0][3:v]overlay={BADGE_AT[0]}:{BADGE_AT[1]}[v]"
        a = f"anullsrc=r=48000:cl=stereo,atrim=0:{dur}[a]"
    else:
        v += ";[v0]null[v]"
        fade = min(0.04, dur / 4)
        a = (f"[1:a]atrim={start}:{end},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,"
             f"afade=t=in:d={fade},afade=t=out:st={dur - fade}:d={fade}[a]")
    out = WORK / f"{i:02d}.mp4"
    run([*inputs, "-filter_complex", f"{v};{a}", "-map", "[v]", "-map", "[a]", "-t", f"{dur:.3f}", *ENC, str(out)])
    return out, dur


def slide(i, png, dur):
    out = WORK / f"{i:02d}.mp4"
    run(["-loop", "1", "-i", str(PANELS / png), "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
         "-vf", "fps=30,format=yuv420p", "-t", f"{dur:.3f}", *ENC, str(out)])
    return out, dur


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    parts, t, starts = [], 0.0, {}
    for i, seg in enumerate(SEGMENTS):
        starts.setdefault(seg[0], t)
        out, dur = phone_segment(i, *seg)
        parts.append(out)
        t += dur
    starts["built"] = t
    parts.append(slide(len(parts), "built.png", BUILT_SECONDS)[0])
    t += BUILT_SECONDS
    end = TOTAL - t
    assert end >= 4, f"cut is {t:.1f}s before the end card; trim something"
    starts["end"] = t
    parts.append(slide(len(parts), "end.png", end)[0])

    (WORK / "list.txt").write_text("".join(f"file '{p}'\n" for p in parts))
    run(["-f", "concat", "-safe", "0", "-i", str(WORK / "list.txt"), "-c", "copy", "-movflags", "+faststart", str(OUT)])
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                         "-of", "csv=p=0", str(OUT)]))
    print(f"{OUT}  {dur:.2f}s")
    fmt = lambda s: f"{int(s // 60)}:{s % 60:05.2f}"
    for name, s in starts.items():
        print(f"  {fmt(s)}  {name}")


if __name__ == "__main__":
    main()
