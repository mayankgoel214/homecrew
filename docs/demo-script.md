# HomeCrew: 2-minute demo video script (v2)

**Structure:** two recordings, voiceover added after.
- **Recording A (one take):** front page → call → 3 problems → End Call → scroll the report. About 1:45 raw.
- **Recording B:** the maintenance feature (sink drain with Marco). About 45 s raw.

**Rules for both takes:**
- Nobody on your side talks while recording. The crew's voices are the call audio.
- After **End Call** the app is silent, so the report is yours to narrate.
- No gas line in the video.

**Track:** MLH Best Use of Gemma 4. Say "Gemma 4" out loud twice and show it on screen once.

---

## Final cut at a glance (exactly 2:00)
| Time | Length | Footage | Audio |
|---|---|---|---|
| 0:00 | 15 s | A: front page, crew pops up | VO: the problem |
| 0:15 | 40 s | A: the call, 3 problems | Crew voices only |
| 0:55 | 3 s | A: tap End Call → case file stamps in | Silence or a light whoosh |
| 0:58 | 12 s | A: the report (verdict, rows, clock) | VO: what the report is |
| 1:10 | 15 s | A: keep scrolling the report (letter → approve → downloads) | VO: how it's built |
| 1:25 | 28 s | B: maintenance, sink drain | VO line in, then Marco's voice |
| 1:53 | 7 s | End card | VO: close |

---

## Before recording (10 minutes)
- [ ] One room with 3 problems. Real is best; otherwise print `samples/mold_1.jpg`, `samples/wiring_1.jpg` and `samples/lock_1.jpg` at letter size (matte) and tape them up a few steps apart.
- [ ] A sink for Recording B: fill it with a few inches of water so it looks clogged (stopper in).
- [ ] Every light on. Phone: Do Not Disturb on, silent switch **off**, volume about 70%, brightness max.
- [ ] Open https://homecrew-vt.vercel.app → if a case file is shown, tap **New case**. Keep **I RENT**.
- [ ] Do one throwaway call to wake the server (the first call after idle is slow).
- [ ] Record the phone: cable to Mac → QuickTime → New Movie Recording → choose the iPhone as **camera and microphone** (this captures the screen and the crew's voices).

---

## Recording A: the full call + report (one take, about 1:45 raw)

| Step | Do this | Raw time | Kept in the edit |
|---|---|---|---|
| A1 | Start recording on the **front page**. Let the crew pop up and breathe. Tap **Rosa** once (her bubble appears). | 20 s | **15 s** |
| A2 | Tap **Start a video call**. Rosa says: *"Hi, I'm Rosa. Show me what's wrong."* | 6 s | **4 s** |
| A3 | **Mold:** walk to it, hold still 2 s. Brackets draw, then the box + tag. Rosa: *"Extensive mold growth on the wall. Don't touch it."* Theo (the **citation card** `VA. CODE § 55.1-1220` appears on screen): *"Virginia Code 55.1-1220: the landlord must fix visible mold."* June: *"I'll add it to your repair notice. They get 21 days."* **Walk to the wiring as soon as the tag appears.** | 15 s | **12 s** |
| A4 | **Wiring:** hold still; tag `#02 · EXPOSED WIRING · CALL A PRO`. Rosa: *"Exposed wiring in a damaged enclosure. Don't touch it."* Theo: *"Same section: the landlord keeps the electrical safe."* June: *"Added to the notice."* **Walk to the lock as soon as the tag appears.** | 15 s | **12 s** |
| A5 | **Lock:** tag `#03 · BROKEN LOCK · LANDLORD FIXES`. Rosa: *"The door is badly damaged and broken."* Theo: *"Same section: the landlord makes the repairs."* June: *"That's in the notice too."* | 15 s | **12 s** |
| A6 | Tap the red **End Call**. The case file stamps in; everything goes silent. | 3 s | **3 s** |
| A7 | **Report, slowly** (about 3 s per action): hold on the verdict → tap the mold row open → close it → scroll to the clock → tap **Write my letter** (June takes ~6 s; cut that) → tap **Approve** → hold on the 3 download tiles → tap **Letter** so the PDF shows | 45 s | **27 s** |
| | **Total** | **~2:00** | **1:25** |

> **The 40-second call (A2–A5):** measured on the live server: each problem is ~5 s of analysis and a 6–10 s Rosa → Theo → June exchange. Because the next problem is analyzed while they're still talking, the whole call ends at **~36 s** if you walk on as soon as each tag appears (48 s if you wait for June every time). Two problems instead of three: ~28 s.

---

## Recording B: maintenance (about 45 s raw → 28 s kept)
| Step | Do this | Raw | Kept |
|---|---|---|---|
| B1 | Front page → tap **Describe a problem instead** → type **"my sink won't drain"** | 10 s | **5 s** |
| B2 | Tap **Call the right expert** → **Marco** (cap and overalls) picks up: *"Hi, I'm Marco, your plumber. Show me the problem."* | 8 s | **6 s** |
| B3 | Point at the sink full of water and hold still. Box + tag `CLOGGED DRAIN · SAFE DIY`. Marco: *"Standing water in the sink. You can fix this."* | 15 s | **12 s** |
| B4 | Tap **End Call** → the report shows the **Safe DIY** tag. Tap the row: stopper, plunger, no mixing drain cleaners. | 12 s | **5 s** |
| | **Total** | **~45 s** | **28 s** |

---

## Voiceover (record after; about 150 words / 70 s)
Read at a calm pace. Each block's target length is in brackets.

**0:00, over the front page [15 s]**
> "In Virginia, landlords bring a lawyer to eviction court three times out of four. Tenants? Less than one percent. And repair problems only help you in court if you documented them. HomeCrew does that for you, on a video call."

**0:15–0:55: no voiceover.** Let the crew talk.

**0:58, over the verdict and rows [12 s]**
> "Hang up, and your case file is ready: what's wrong, how urgent it is, what to do now, and exactly which Virginia law your landlord has to follow."

**1:10, over the letter, approve and downloads [15 s]**
> "Every agent runs on **Gemma 4**. It sees the problem and marks where it is. Theo pulls the real statute from Virginia's official legal API. Fixed safety rules rate every finding. June drafts the letter; you approve it."

**On-screen text during this block (small, corner):** `Gemma 4 31B · Gemini API · law.lis.virginia.gov API · Cartesia voices · Cloud Run · Firestore`

**1:25, over the start of the maintenance clip [6 s]**
> "And it's not just for disputes. Describe any problem, and HomeCrew calls the right expert."

*(Then let Marco's voice play for the rest of the clip.)*

**1:53, over the end card [7 s]**
> "Built on **Gemma 4** and free tiers. A crew in every renter's pocket."

**End card:** `HomeCrew · homecrew-vt.vercel.app · github.com/mayankgoel214/homecrew · Built with Gemma 4`

---

## If you're over 2:00, cut in this order
1. Recording B step B4 (the report tap): 5 s
2. The **Letter** PDF tap in A7: 3 s
3. The Rosa bubble tap in A1: 2 s
4. The lock (A5): 12 s. Keep this as the last resort; three problems reads stronger than two.

## Honesty rules (judges check)
- Don't fake findings. If Rosa misses, re-shoot.
- If you speed up any wait, show a small "2x".
- Stats: LSC Civil Court Data (2024: 74.6% of landlords vs 0.8% of tenants had a lawyer). Say repair problems "can help you in court", not that the law "made mold a defense".

## Shot checklist
- [ ] Front page crew pop-up + Rosa bubble
- [ ] Greeting
- [ ] Mold: box + tag + Rosa + Theo
- [ ] Wiring: box + tag + "Don't touch it"
- [ ] Lock: box + tag
- [ ] End Call → case file stamp (silent)
- [ ] Verdict → row open → clock → Write my letter → Approve → downloads → Letter PDF
- [ ] B: Describe "my sink won't drain" → Marco → sink → "You can fix this" → Safe DIY steps
- [ ] End card
