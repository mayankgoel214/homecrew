# HomeCrew: consolidated build plan

GDG Build with AI x Hacktoberfest 2026, Virginia Tech (Oct 24-25, D&DS Building, Blacksburg). Theme: AI for Housing.
**Hard deadline: Sunday Oct 25, 12:30 PM, both platforms. Late = not accepted.**
MLH track: **Best Use of Gemma 4**. GDG track (Best Overall AI for Housing): everyone is entered.

This file is the source of truth for scope. Facts in section 2 were checked on 2026-10-24; the source is next to each one.

---

## 1. One-liner and pitch

**One-liner:** Point your phone at your apartment. Three Gemma 4 agents inspect it, cite the Virginia law your landlord is breaking, and build your evidence file and paperwork.

**Pitch (30 s, all numbers verified, see section 2):**
> Virginia has had 705,120 eviction filings since March 2020, and 10,712 in September 2026 alone. In 2024, 74.6% of landlords had a lawyer and 0.8% of tenants did. Tenants with a lawyer are 7 times more likely to win. Since July 1, 2026, a Virginia tenant facing eviction over unpaid rent can raise serious repair problems like no heat, no water or rodents as a defense without first paying rent into court. But only if they can prove it and proved they gave written notice. HomeCrew turns a phone walkthrough into timestamped evidence, statute citations and a 21-day repair notice, for free.

---

## 2. Verified facts (use these, not the old numbers)

| Fact | Value | Source |
|---|---|---|
| VA eviction filings since 3/16/2020 | **705,120** | LSC Civil Court Data Initiative, https://civilcourtdata.lsc.gov/data/eviction/virginia |
| Filings, Sept 2026 | **10,712** (10,004 judgments, 3,679 defaults) | same |
| Representation, 2024 | landlords **74.6%**, tenants **0.8%** (137,918 cases) | same |
| Tenants with a lawyer | **7x** more likely to win | https://civilcourtdata.lsc.gov/research/reports/va-2023-eviction-and-debt |
| ~~"67% of landlord wins are defaults"~~ | **DROPPED: no source found** | n/a |
| SB 373 (2026) | Chapter 959, effective **July 1, 2026**. Amends **§ 55.1-1241**: removes the requirement to pay rent into court before raising the landlord's noncompliance as a defense. **The defense itself dates from 1974. Do NOT say SB 373 "made mold a defense."** | https://lis.virginia.gov/bill-details/20261/SB373, https://law.lis.virginia.gov/vacode/55.1-1241/ |
| § 55.1-1241 conditions | fire hazard or serious threat to life, health or safety: no heat, no running water, light, electricity or adequate sewage; rodent infestation; material noncompliance. Needs **written notice** to the landlord (or an agency violation notice). More than **30 days** after notice is presumed unreasonable. | Code text |
| Companion | HB 281 (c. 1041), effective Jan 1, 2027 | policyrisk.com |

### Statutes the Lawyer agent may cite (pre-cache all of these)
| § | Title | Use |
|---|---|---|
| 55.1-1220 | Landlord to maintain fit premises (A.5 = moisture/mold) | Main duty cited for every defect |
| 55.1-1234 | Noncompliance by landlord | **The repair-letter deadline: 21 days to fix, or the lease ends at 30 days** |
| 55.1-1241 | Landlord noncompliance as defense to nonpayment possession (SB 373) | The eviction-defense flag |
| 55.1-1244 | Tenant's assertion / rent escrow | Next step if the landlord ignores the letter |
| 55.1-1244.1 | Tenant's remedy by repair | Alternative remedy |
| 55.1-1231 | Relocation for mold remediation | Mold findings |
| 55.1-1239 | Wrongful failure to supply essential service | No heat, water or electricity |
| 55.1-1258 | Retaliatory conduct prohibited | Always mention: the landlord can't retaliate for a complaint |
| 55.1-1227 | Tenant to maintain unit (A.10 = tenant must report mold) | Tenant duties, used honestly |
| 55.1-1226 | Security deposits | Only if it's raised |

**Not tenant tools:** 55.1-1245 is the *landlord's* remedy, and 55.1-1227 is a tenant *duty*. The original plan had these wrong.

**Statute API (tested, returns JSON):** `https://law.lis.virginia.gov/api/CoVSectionsGetSectionDetailsJson/55.1-1220/`
Response shape: `ChapterList[]` → `SectionTitle`, `ArticleName`, `Body` (HTML). Some sections return several versions ("Effective until January 1, 2027"), so pick the one in force today. **Pre-cache to `api/data/statutes.json` at build time; the demo never calls the live API.**

### Gemma 4 facts
- Gemini API model IDs: **`gemma-4-31b-it`** (primary) and `gemma-4-26b-a4b-it` (faster MoE fallback). https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api
- Image input: yes. **Audio: NOT on the 26B/31B API models** (only E2B/E4B/12B). Voice intake therefore needs Ollama `gemma4:e4b` locally, or gets cut.
- Video: the model accepts frames. We send frames, never raw video.
- Function calling: native. Strict JSON mode: undocumented, so prompt for JSON, strip fences, validate with Pydantic, retry once.
- Bounding boxes: "object detection" is listed but the output format is undocumented. **Test in hour one.** Fallback: whole-frame tag plus a rough region (top/middle/bottom, left/center/right).
- License Apache 2.0. Context 256K. Free-tier limits: check https://aistudio.google.com/rate-limit (rumored 15 RPM, 1,500/day; unverified).
- Ollama tags: `gemma4:e2b`, `gemma4:e4b`, `gemma4:12b`, `gemma4:26b`, `gemma4:31b`.

### Local help to hand off to (show in the app)
- Southwest Virginia Legal Aid Society (covers Montgomery County / Blacksburg): **1-888-201-2772**, apply at https://svlas.kempscaseworks.com/app/, Christiansburg office (540) 382-6157.
- Virginia Eviction Legal Helpline: **1-833-NoEvict (833-663-8428)**. Hours unverified; someone should call to confirm.
- Statewide: 1-866-LEGL-AID (1-866-534-5243).
- Blacksburg code inspector (Office of Housing and Community Connections): **(540) 443-1612**. Building Inspection: (540) 961-0672.
- **The Blacksburg online complaint form's fields could not be verified** (the town site blocks bots). A teammate must open it in a browser Saturday and copy the real fields. Until then the Advocate fills a generic "code complaint packet": address, unit, issue, location in unit, date first observed, date landlord notified, description, photos, contact.

---

## 3. Decisions (settled, don't re-debate)

1. **Phone-first website, no native app.** Next.js in the phone's browser. No Expo, no Xcode, no simulator (the iOS Simulator has no camera anyway).
2. **The live camera is the main demo.** The page opens the rear camera with `getUserMedia({video:{facingMode:"environment"}})` (`playsinline`, `muted`), and the user taps capture (optionally auto-capturing every ~3 s). The frame freezes, the box animates in, and the agents reply. Not 30 fps tracking; each Gemma call takes seconds.
3. **The camera needs HTTPS.** The phone can't use `http://<laptop-ip>`. During dev, use a Cloudflare tunnel (`cloudflared tunnel --url http://localhost:3000`) or a Vercel preview. Test on everyone's iPhone and Android **in hour one**.
4. **Photo upload stays as a backup path** (`<input type="file" accept="image/*" capture="environment">`). Same pipeline.
5. **Frames, not video, go to the model.** The browser downsizes to 1024px JPEG with canvas. That fixes HEIC, speeds upload, and **strips EXIF/GPS** (privacy points).
6. **Hash in the browser** (SHA-256 via WebCrypto) before upload, and re-hash on the server. "Verify" compares the two.
7. **Demo-day safety net:**
   - phone hotspot for wifi
   - QuickTime screen mirror of the iPhone over the cable for the projector and for recording
   - Safari Web Inspector over the cable for debugging
   - printed photos of mold and a broken lock to aim the camera at
   - a `DEMO_REPLAY=1` switch that replays a cached real run if Gemma is rate-limited (labeled honestly in code)
8. **Stack:**
   - `web/` Next.js 15 + Tailwind (Vercel, HTTPS)
   - `api/` FastAPI (Cloud Run)
   - Firestore + Cloud Storage
   - Gemma 4 via the Gemini API (`google-genai`)
   - Orchestrator: a plain Python state machine first; Google ADK only if it's quick
9. **Everything ends in an artifact.** Agents that only talk lose. Every beat produces a tagged frame, a statute card, a ledger row, a letter, a complaint or an .ics.
10. **Nothing exports or "files" without the user's Approve click.** HomeCrew never contacts the landlord or the town itself.

---

## 4. Scope

**Core (must work by Saturday 9 PM):**
1. Live camera capture (plus upload backup) → 1024px JPEG frames, hashed in the browser.
2. **Inspector** (Gemma 4 vision) → per frame: `[{type, label, bbox|region, severity 1-5, confidence, evidenceNote, needs_human_check}]`.
3. **Lawyer** (Gemma 4 + `va_code_lookup` over the cached statutes) → section, plain English, deadline, `isEvictionDefense` (§ 55.1-1241 conditions), quoted snippet (<40 words). Cites only sections the tool returned. "Informational, not legal advice."
4. **Advocate** (Gemma 4 + tools `draft_letter`, `fill_complaint`, `make_ics`) → § 55.1-1234 21-day notice letter, code complaint packet, deadlines. Posts "Ready for your approval."
5. Group chat UI: agents post to each other, streamed over SSE (fallback: sequential posts with a typing animation).
6. Evidence ledger: frame + SHA-256 + timestamp + tags, with a Verify button.
7. Approve → export the letter PDF, complaint PDF/JSON and .ics. A "Get human help" card shows SVLAS and the helpline.

**Stretch A (Saturday night):** room map with severity colors · energy agent (bill photo + window/door findings) · voice narration (only via local `gemma4:e4b`; the API models have no audio).
**Stretch B (only if A is done by Sunday 8 AM):** landlord portfolio lookup (Montgomery County parcel GIS) · before/after render.
**Out of scope:** native app, real phone calls, hardware, AR/3D, scam detection, roommate matching, Document AI. Gemini Live is cut (it isn't Gemma and dilutes the track story).

---

## 5. Architecture

```
iPhone / Android browser (Next.js on Vercel, HTTPS)
  live camera (getUserMedia) | upload backup
  -> canvas: 1024px JPEG, EXIF stripped, SHA-256 in browser
  agent chat (SSE) | evidence ledger | approve + export
        |
        v  HTTPS
FastAPI on Cloud Run
  POST /cases                  create case
  POST /cases/{id}/frames      store frame -> Inspector
  GET  /cases/{id}/stream      SSE: Inspector -> Lawyer -> Advocate messages
  POST /cases/{id}/approve     unlock exports
  GET  /cases/{id}/export/{letter|complaint|ics}
  GET  /cases/{id}/verify/{frameId}
  Orchestrator (Python state machine)
     Inspector -> Gemma 4 31B (image -> JSON)
     Lawyer    -> Gemma 4 31B + va_code_lookup (api/data/statutes.json)
     Advocate  -> Gemma 4 31B + draft_letter / fill_complaint / make_ics
        |
Firestore (cases, chat, evidence, findings)  +  Cloud Storage (frames)
```

**Gemma call pattern:** image + prompt → JSON → strip ```fences → Pydantic validate → one retry on failure → else `needs_human_check`. `OLLAMA=1` switches to local `gemma4:e4b`.

## 6. Data model (Firestore)
```
cases/{caseId}: createdAt, address?, tenantNotes?, status
  chat/{msgId}: agent, text, refs[], ts
  evidence/{frameId}: storagePath, sha256Client, sha256Server, ts,
                      issues[{type, label, bbox|region, severity, confidence, needs_human_check}]
  findings/{findingId}: issueType, frameIds[], statuteSection, statuteSnippet, plainEnglish,
                        deadlineDays, isEvictionDefense, letterParagraph
  exports: approvedAt, letterPath, complaintPath, icsPath
```
Data minimization: address and name are optional and live only in this case. No accounts. Cases auto-delete after 30 days (lifecycle rule on Storage plus a TTL field on Firestore).

---

## 7. Team and timeline (3 people)

Roles: **A = Frontend/camera**, **B = Agents/backend**, **C = Data, exports, deploy, README, validation**. Mayank owns the pitch and video.

| Time | A: Frontend/camera | B: Agents/backend | C: Data/exports/docs |
|---|---|---|---|
| Sat 1:00-2:00 | Live camera page on HTTPS tunnel, tested on every phone | Gemma 4 hello world: image → JSON. **Test bbox quality on 10-15 photos** | Claim Cloud credits (Discord, noon). Firebase project, Firestore + Storage. Open the Blacksburg complaint form and copy its fields |
| 2:00-4:30 | Capture → frame grid → box overlay; upload backup | Inspector prompt tuned on test photos | Cache statutes → `statutes.json`; ledger write/read + verify |
| 4:30-7:00 | Agent chat with SSE | Lawyer agent + `va_code_lookup` | Letter (§55.1-1234), complaint packet, .ics generators |
| 7:00-9:00 | Approve flow, exports, help card | Advocate + orchestrator wiring | Deploy api to Cloud Run, web to Vercel. Talk to 5 renters, record quotes |
| **9:00 PM** | **Core dry run on a real phone. Record a backup video.** | | |
| 9:00-12:00 | Polish, a11y pass (keyboard, contrast, labels) | `DEMO_REPLAY` cache; one stretch item | README: architecture diagram, responsible-AI section |
| 12:00-8:00 | Sleep in shifts | | |
| Sun 8:00-10:00 | Final UI pass on phone | Bug bash | Final deploy; record the final video (QuickTime mirror) |
| 10:00-11:00 | **Code freeze, tag `v1.0`** | | Edit video, final README |
| 11:00-11:45 | **Submit BOTH: OrganizerHQ (MLH, Gemma 4 only) and codingjam.dev Virginia Tech chapter** | | |

**Behind at 9 PM? Cut all stretch, polish core, record the backup video.**

## 8. Demo video (2:00)
- 0:00 Hook: "10,712 Virginians got eviction filings last month. 0.8% had a lawyer." A phone pans a bathroom.
- 0:10 Live camera, tap: the mold box animates in, and the Inspector posts with its confidence.
- 0:25 Lawyer: "§ 55.1-1220 requires fit premises. Since July 2026, under § 55.1-1241, this can be raised in an eviction for unpaid rent without paying into court first, if you've given written notice." Tap the card to show the statute text.
- 0:45 Broken deadbolt, same loop, fast.
- 1:00 Advocate posts the 21-day notice letter and the complaint packet. Approve. Ledger: hashes, Verify → match.
- 1:20 "Get human help": SVLAS + 833-NoEvict.
- 1:35 Architecture: Gemma 4 31B on every agent, Cloud Run, Firestore; free tiers; deployable by a legal aid org.
- 1:50 "A free inspector, lawyer and paralegal in your pocket."

## 9. Submission checklist (both by 12:30 PM Sunday)
- [ ] Repo public, LICENSE (MIT) present, README names **Gemma 4 (`gemma-4-31b-it`)** and shows where it's used
- [ ] **List the AI coding tools used (Claude Code) in the submission and README** (MLH rule)
- [ ] All commits made during the event (from Sat 11:00 AM)
- [ ] 2-minute video uploaded (YouTube unlisted)
- [ ] OrganizerHQ: name, description, tech, GitHub link, video, **one** MLH track = Best Use of Gemma 4
- [ ] codingjam.dev, **Virginia Tech chapter entry**: codebase, video, short description
- [ ] Ask on Discord: max team size; confirm the codingjam.dev chapter link

## 10. Risks and cuts
| Risk | Mitigation |
|---|---|
| Camera blocked (no HTTPS) | Tunnel/Vercel from hour one; upload backup |
| Gemma invents issues | confidence shown, `needs_human_check` below 0.5, "never invent" prompt rule, human approval before export |
| Bad bounding boxes | region fallback (whole frame + 3x3 grid cell) |
| Rate limit / outage | `gemma-4-26b-a4b-it` fallback → Ollama `gemma4:e4b` → `DEMO_REPLAY` |
| Statute API down | pre-cached `statutes.json` |
| Venue wifi | phone hotspot |
| SSE flaky | sequential posts with a typing animation |
