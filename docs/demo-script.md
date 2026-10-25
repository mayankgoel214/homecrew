# HomeCrew demo video (v3): exactly 2:00

**How it gets made:** you film 3 short clips on your phone and send them. I run each one through the real app (the clip is fed in as the camera; Gemma 4 analyzes it for real), record the phone screen in sharp full resolution, lay the crew's real voices on, and edit everything into one 2:00 video with your voiceover.

**Final look:** a 1920×1080 landscape video (what YouTube/Devpost players show). The phone screen sits in the center at full height, large and sharp. The left side shows the step title ("1 · Show the problem"); the right side shows short callouts ("Gemma 4 sees it", "Virginia Code § 55.1-1220, pulled from the state's legal API"). Dark background in the app's colors. No tiny phone in a corner.

---

## Real timings (measured on the live app, not guesses)
| What | How long it really takes |
|---|---|
| Tap "Start a video call" → crew finishes introducing itself | **11 s** |
| Camera on a problem → Rosa speaks | **6–8 s** (camera steadies, Gemma looks) |
| Rosa → Theo (the law) → June | **+9 s** after Rosa starts |
| So one landlord problem, start to finish | **~17 s** |
| A "you fix it" problem (Rosa only) | **~10 s** |
| Expert-only greeting (owner or plumber call) | **3 s** |
| Hang up → report with the law filled in | **8–12 s** (we cut most of this) |
| June drafting the letter | **~6 s** (cut) |

Raw app time is about **2:40**. The edit cuts the waiting (marked with a small "2x" where sped up, never faked).

---

## The 2:00 cut
| # | Time | Length | On screen | Audio |
|---|---|---|---|---|
| 1 | 0:00 | 10 s | Front page: crew pops up | **VO 1** |
| 2 | 0:10 | 11 s | Renter call: crew introduces itself | Crew voices |
| 3 | 0:21 | 18 s | **Broken door**: box + tag, Rosa → Theo + law card → June | Crew voices |
| 4 | 0:39 | 11 s | **Chair**: Rosa: *"That's yours to fix, not your landlord's."* No Theo. | Crew voices |
| 5 | 0:50 | 22 s | End call → report: verdict, the door's law, the chair "yours", deadline clock → Write my letter → Approve → downloads (sped up) | **VO 2 + VO 3** |
| 6 | 1:12 | 16 s | **Owner**: flip I RENT → I OWN, call, **wall stain**: Rosa says what to do; no landlord, no letter | **VO 4** over the flip, then Rosa |
| 7 | 1:28 | 25 s | **Plumber**: "Describe a problem" → *"my sink won't drain"* → Marco picks up → **clogged sink** → *"You can fix this one"* → Safe DIY steps | **VO 5** over the typing, then Marco |
| 8 | 1:53 | 7 s | End card | **VO 6** |

---

## What to film and send me (3 clips)
Portrait, normal phone camera, 30 fps, every light on, **no talking** (I replace the audio). Move slowly. Holding still is what makes Rosa catch it.

**Clip 1: renter (about 35 s)**
| Your clip | Point at |
|---|---|
| 0:00–0:12 | The room, nothing broken (covers the crew's 11 s intro) |
| 0:12–0:22 | **Broken door**, dead still, damage filling about half the screen |
| 0:22–0:25 | Slow pan |
| 0:25–0:35 | **The chair** (broken leg, crack, whatever's wrong with it), dead still |

**Clip 2: owner (about 15 s)**
| 0:00–0:04 | Room |
| 0:04–0:15 | **Wall stain**, dead still |

**Clip 3: plumber (about 15 s)**
| 0:00–0:15 | **Sink with a few inches of standing water** (stopper in), dead still the whole time |

AirDrop them to your Mac and tell me where they are. I'll check each one runs cleanly before building the video, and tell you right away if Rosa misses something so you can re-shoot just that clip.

---

## Voiceover (you record it after; I give you a timed version)
Read calm and steady. Brackets = time it has to fit.

**VO 1, front page [10 s]**
> "Landlords show up to eviction court with a lawyer three times out of four. Tenants, almost never. HomeCrew puts a crew in your pocket."

**VO 2, report [10 s]**
> "Hang up, and your case file is ready: what's wrong, who has to fix it, and the exact Virginia law."

**VO 3, letter → downloads [12 s]**
> "Every agent runs on Gemma 4. Theo pulls the real statute from Virginia's legal API. June writes the repair letter, and nothing goes out until you approve it."

**VO 4, owner flip [5 s]**
> "Own your place? Same crew. They tell you what's safe to fix yourself."

**VO 5, describe a problem [6 s]**
> "Or just describe the problem, and HomeCrew calls the right expert."

**VO 6, end card [7 s]**
> "HomeCrew. Built on Gemma 4. A crew in every renter's pocket."

**End card text:** `HomeCrew · homecrew-vt.vercel.app · github.com/mayankgoel214/homecrew · Built with Gemma 4`

---

## Honesty rules (judges check)
- Every finding in the video is Gemma's real output on your real footage. If Rosa misses or mislabels, re-shoot; never fake it.
- Sped-up waits get a small "2x" label.
- Don't say "live" in the voiceover. Say "on a video call".
- Stats: LSC Civil Court Data 2024 (landlords 74.6% vs tenants 0.8% had a lawyer).
