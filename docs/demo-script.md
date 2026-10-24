# HomeCrew: 2-minute demo video script

**Goal:** in 2:00, a judge should get (1) the problem, (2) the magic moment (a live call where the crew finds problems and talks), (3) why it's safe and grounded, (4) what tech it runs on, and (5) the impact. The crew's voices carry the call, so the narrator stays quiet there and talks over the report.

**Track:** MLH Best Use of Gemma 4. Say "Gemma 4" out loud at least twice and show it on screen once.

---

## Before you hit record (15 minutes)

**Props and location**
- [ ] One room with 3 "problems". Real ones are best. Otherwise **print** the test photos big (letter size, matte, not glossy) and tape them up:
  - `samples/mold_1.jpg` on a wall or ceiling (bathroom feel)
  - `samples/wiring_1.jpg` next to an outlet
  - `samples/lock_1.jpg` on a door near the handle
- [ ] Good light. Turn on every lamp. The Inspector struggles in dim light.

**Phone**
- [ ] Do Not Disturb on, silent switch **off**, volume about 70%, brightness max.
- [ ] Open https://homecrew-vt.vercel.app. If there's an old case, tap **New case** (or clear the case file) so the counter starts at 0.
- [ ] Keep **I RENT** selected.
- [ ] Do one throwaway call first to wake the server. The first call after a quiet stretch is slow.

**Recording**
- [ ] iPhone to Mac with a cable, then QuickTime → File → New Movie Recording → pick the iPhone as **camera and microphone**. This records the screen *and* the crew's voices.
- [ ] Record the voiceover separately in a quiet room (Voice Memos is fine). Read the script out loud once; it should come in under 2:00.
- [ ] Editor: CapCut, iMovie or Premiere. Duck the crew audio to about 30% under the voiceover; keep it at 100% when no one's narrating.

**Backup:** if the camera misbehaves, use **Try the demo feed** on the front page. It plays the same three problems as a camera stream. The screen says "DEMO FEED", so it's honest.

---

## The script

Times are where each beat **starts** in the final edit. **VO** = narrator voiceover. **CREW** = what the app says (roughly; Rosa's lines come from Gemma, so the wording varies).

### 0:00 · Cold open: the problem (8 s)
**Screen:** the front page as the crew pops up. Slow push-in if your editor can.
**VO:**
> "In Virginia, landlords bring a lawyer to eviction court three times out of four. Tenants? Less than one percent."

**On-screen text (small, bottom):** `Legal Services Corporation, 2024`

### 0:08 · Why it matters (7 s)
**Screen:** stay on the crew. Tap **Rosa** so her bubble says "I spot what's broken."
**VO:**
> "Serious repair problems can protect you in court, but only if you documented them and told your landlord in writing. Most people never do."

### 0:15 · Start the call (5 s)
**Screen:** tap **Start a video call**. The camera opens full screen with the crew badges at the bottom.
**VO:**
> "HomeCrew is a video call with a crew that knows what to do."

### 0:20 · The greeting (6 s), no VO
**CREW (Rosa):** "Hi, I'm Rosa. Walk me around slowly. Start with the room that worries you most."
**CREW (Theo):** "Theo here. I'll flag anything your landlord has to fix."

### 0:26 · Problem 1: mold (14 s), no VO
**Screen:** point at the mold and **hold still for 2 seconds**. The gold corner brackets draw (Rosa is looking). Then:
- a tier-colored box **draws onto the live camera** around the mold
- the tag stamps in: `#01 · MOLD GROWTH · LANDLORD FIXES` (or `CALL A PRO` if it's a big patch)
- the counter top-right goes to **1 FOUND**

**CREW (Rosa):** "I see mold growth on the ceiling here… That's your landlord's to fix."
**CREW (Theo):** "Section 55.1-1220: your landlord has to keep moisture and mold out, and when mold is visible they have to promptly remediate it."

> **Edit:** cut the ~4 s while Rosa is analyzing down to about 1 s, or speed it up 2x with a small "2x" label. Don't hide it entirely.

### 0:40 · Problem 2: exposed wiring (10 s), no VO
**Screen:** point at the wiring and hold. The box and tag draw: `#02 · EXPOSED WIRING · CALL A PRO`.
**CREW (Rosa):** "Those exposed wires are a serious hazard… Don't touch it; that needs a licensed pro."
**CREW (Theo):** "Section 55.1-1220: your landlord has to keep the electrical in good and safe working order."

> **Edit:** if Theo runs long, cut after "safe working order".

### 0:50 · Problem 3: lock (5 s), quick cut
**Screen:** point at the lock. Tag: `#03 · BROKEN LOCK · LANDLORD FIXES`. Show the tag stamping, then cut before Rosa finishes. The pace is the point here.

### 0:55 · The safety moment: gas (10 s)
**Screen:** tap the **mic** button (it turns brass and the screen edge glows). Say clearly: **"Wait, I think I smell gas."** The **red emergency screen** appears instantly.
**VO (over the red screen):**
> "Some things should never be DIY. Emergencies, gas, panel work: those rules are written in code, not left to the AI."

**Screen:** tap **I'm safe, go back to the call**.

### 1:05 · Hang up (5 s)
**Screen:** tap the red **end call** button. The case file opens: "Case file" + the brass **No. XXXX** stamp + the verdict.
**CREW (June):** "June here. 3 things to put in your repair letter. Your case file is ready."

### 1:10 · The report + how it works (27 s)
**Screen, in order, slowly:**
1. Hold on the verdict: **"Your landlord must fix all 3."** and the color bar (3 s)
2. Tap the **mold** row to open "What to do" and "The law" (4 s)
3. Scroll to the **clock**: Today → Day 14 → Day 21 → Day 30 (3 s)
4. Tap **Write my letter** → the letter appears → **Approve** → the 3 download tiles (8 s)
5. Tap **Letter** to show the PDF for a second (3 s)

**VO (this is where the tech goes):**
> "Every agent runs on **Gemma 4**. Rosa finds the problem and draws exactly where it is. Theo can only cite statutes he actually looked up, and every quote is checked word for word against the Virginia Code. A fixed safety router rates every finding. And every photo is fingerprinted and hash-chained, so the evidence holds up. June writes a ready-to-send repair notice. You approve it. Nothing is ever sent for you."

**On-screen text (small, corner, appears during the VO):** `Gemma 4 31B · Gemini API · Cloud Run · Firestore · Cartesia voices`

### 1:37 · Any home problem (11 s)
**Screen:** back to the front page → **Describe a problem instead** → type **"my sink won't drain"** → **Call the right expert** → **Marco the plumber** picks up in his cap and overalls.
**VO:**
> "Not sure who to call? Describe it, and HomeCrew connects you to the right expert: plumber, electrician, heating, pests, locks."

**CREW (Marco):** "Hi, I'm Marco, your plumber. Show me the problem…" (let a second play, then cut)

### 1:48 · Close (12 s)
**Screen:** the front page crew again, or a simple end card: logo, `homecrew-vt.vercel.app`, `github.com/mayankgoel214/homecrew`.
**VO:**
> "It runs on free tiers, so a legal aid clinic could deploy it tomorrow. HomeCrew: a free inspector, lawyer and paralegal for every renter."

**End card text:** `HomeCrew · Built with Gemma 4 · GDG Build with AI × Hacktoberfest 2026`

---

## The voiceover, all in one place (for recording)
About 205 words, roughly 85 seconds at a calm pace. The remaining time is the crew talking.

> In Virginia, landlords bring a lawyer to eviction court three times out of four. Tenants? Less than one percent.
>
> Serious repair problems can protect you in court, but only if you documented them and told your landlord in writing. Most people never do.
>
> HomeCrew is a video call with a crew that knows what to do.
>
> *(pause: the crew talks)*
>
> Some things should never be DIY. Emergencies, gas, panel work: those rules are written in code, not left to the AI.
>
> *(pause: June speaks)*
>
> Every agent runs on Gemma 4. Rosa finds the problem and draws exactly where it is. Theo can only cite statutes he actually looked up, and every quote is checked word for word against the Virginia Code. A fixed safety router rates every finding. And every photo is fingerprinted and hash-chained, so the evidence holds up. June writes a ready-to-send repair notice. You approve it. Nothing is ever sent for you.
>
> Not sure who to call? Describe it, and HomeCrew connects you to the right expert: plumber, electrician, heating, pests, locks.
>
> It runs on free tiers, so a legal aid clinic could deploy it tomorrow. HomeCrew: a free inspector, lawyer and paralegal for every renter.

---

## Timing budget
| Beat | Start | Length |
|---|---|---|
| Problem (hook + why) | 0:00 | 15 s |
| Start the call + greeting | 0:15 | 11 s |
| Mold | 0:26 | 14 s |
| Wiring | 0:40 | 10 s |
| Lock | 0:50 | 5 s |
| Gas emergency | 0:55 | 10 s |
| Hang up | 1:05 | 5 s |
| Report + tech | 1:10 | 27 s |
| Maintenance expert | 1:37 | 11 s |
| Close | 1:48 | 12 s |
| **Total** | | **2:00** |

**If you're over time, cut in this order:** the lock (5 s), the Letter PDF tap (3 s), Theo's line on the wiring (4 s), the Rosa bubble tap at the start (2 s).

---

## Honesty rules (judges check)
- Don't fake findings. If Rosa misses something on a take, re-shoot or use the demo feed (it's labeled).
- If you speed up the analysis wait, show a small "2x" label.
- The stats are real and sourced: LSC Civil Court Data (2024 representation), Va. Code § 55.1-1241 as amended by SB 373 (2026). Don't say SB 373 "made mold a defense"; say repair problems "can protect you in court."

## Shot checklist (tick off while filming)
- [ ] Crew pop-up on the front page
- [ ] Rosa tap bubble
- [ ] Call connects + greeting
- [ ] Mold: reticle + tag + Theo line
- [ ] Wiring: "Don't touch it" + tag
- [ ] Lock tag
- [ ] Mic on → "I smell gas" → red card → "I'm safe"
- [ ] Hang up → case file stamp + June line
- [ ] Verdict → expand a row → clock → Write letter → Approve → downloads → Letter PDF
- [ ] Describe "my sink won't drain" → Marco greeting
- [ ] End card
