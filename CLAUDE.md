# HomeCrew: instructions for Claude Code

Hackathon project, **hard deadline Sunday Oct 25 2026, 12:30 PM**. Read [PLAN.md](PLAN.md) for full scope, verified facts and timeline. This file is the short version.

## Product
Phone-first website. The user video-calls a crew: the live camera feed is analyzed by Gemma 4 (Rosa, or a trade expert picked from a typed problem), a fixed safety router rates every finding (emergency / pro / landlord / diy), and for renters Theo names the Virginia rule and June adds it to the repair letter. Hanging up gives a case file: findings, the Lawyer's grounded legal review, the § 55.1-1234 21-day clock, and the repair notice, code-complaint packet and .ics. Nothing exports without the user's Approve click.

## Repo layout
- `web/`: Next.js 15 App Router, TypeScript, Tailwind. Runs in the phone's browser. Deployed to Vercel (HTTPS is required for the camera).
- `api/`: FastAPI (Python 3.12, uv). Agents, orchestrator, exports. Deployed to Cloud Run. Run: `cd api && uv run uvicorn app.main:app --reload --port 8000`. Test: `uv run pytest -q`.
- `api/data/statutes.json`: pre-cached Virginia Code sections (refresh: `cd api && uv run python scripts/cache_statutes.py`). The demo must never depend on the live statute API. Lawyer grounding is enforced in code (`api/app/agents/lawyer.py`): citations must be looked-up sections, quotes must be verbatim or get replaced by the closest real sentence, and deadlines and disclaimers come from code, not the model.
- `api/app/store.py`: cases on local disk under `api/uploads/cases/` (gitignored), swappable for Firestore + Cloud Storage. The evidence ledger is append-only and hash-chained; "removing" a photo only excludes it from the case. Any change to evidence clears the legal review and draft (`Case.invalidate`).
- Case API: `POST /cases`, `POST /cases/{id}/frames` (runs Inspector), `PATCH /cases/{id}/frames/{fid}` (remove / dismiss findings), `GET /cases/{id}/verify`, `POST /cases/{id}/lawyer`, `POST /cases/{id}/advocate`, `POST /cases/{id}/approve`, `GET /cases/{id}/export/{letter.pdf|complaint.pdf|deadlines.ics|evidence.json}` (all but evidence.json are 403 until approved).
- Crew chat: agents post to `Case.chat` via `api/app/crew.py` (messages are built from agent outputs, never generated); `GET /cases/{id}/stream` is SSE, each stream closes after 25 s and the browser resumes with Last-Event-ID. API responses also carry the full chat as a fallback.
- **Live call (main experience):** `web/src/components/call/CallScreen.tsx`. Full-screen camera (or labeled demo feed, `lib/demoFeed.ts`), `lib/sceneWatch.ts` auto-captures when the picture is steady and new (min 4.5 s apart), frames sent with `live=true`. Server keeps a live frame only if it shows a problem type not recorded in the last 60 s (tapped snapshots are always kept); Rosa's spoken line comes from Gemma (`say`) plus a tail from the safety router; for renters Theo's one-line take is a fixed restatement of § 55.1-1220 / 1244.1 subsections (`crew.RULES`, shown as a citation card) and June acknowledges, once per problem type per call (`crew.theo_covers`). During a call the browser also re-reads the case every 2 s in case SSE stalls. Hanging up runs the full Gemma Lawyer review (landlord/pro findings only, `Case.landlord_issues`), then the Advocate on Approve flow.
- **Trades + safety router:** `api/app/trades.py` (expert per trade: name, voice, focus; `route()` picks one from a typed problem) and `api/app/safety.py` (4 tiers: emergency / pro / landlord / diy; fixed safe steps; spoken + visual emergency patterns; never-DIY refusals). The router runs on every finding and every question; `POST /cases/{id}/ask` answers emergencies and refusals by rule before Gemma. Frontend mirror for instant emergencies: `web/src/lib/safety.ts`. Voice questions use browser speech recognition (`web/src/lib/listen.ts`), paused while the crew talks.
- Human voices: Cartesia via `POST /tts` (`api/app/voice.py`, key in Secret Manager `cartesia-api-key`, model sonic-3, voices Skylar/Clive/Jacqueline). Browser falls back to built-in speech, then captions.
- Crew characters (Rosa, Theo, June, trade experts) are defined in `web/src/lib/crew.ts`; `hooks/useCrewPlayback.ts` plays lines one at a time (silent once the call ends). Voice is pluggable via the `CrewVoice` interface: Cartesia, then browser speech, then captions only. Voice is app output, not Gemma.
- **Phone testing: use ngrok (`ngrok http 3000`), not a Cloudflare quick tunnel.** Quick tunnels hold SSE back until the stream closes.
- Async endpoints must not call Gemma or the store directly (it freezes the event loop and the chat stream); use `asyncio.to_thread`.
- `samples/`: test photos (no people, faces or addresses).

## Live deployment
- Web: https://homecrew-vt.vercel.app (Vercel project `homecrew`). API: Cloud Run `homecrew-api`, project `homecrew-vt`, us-east4, `STORE=firestore`. Commands in [docs/deploy.md](docs/deploy.md). After `vercel deploy --prod`, re-run `vercel alias set` for the short link.

## Hard rules
1. **No feature past core (PLAN.md section 4, items 1-7) until the Saturday 9 PM dry run passes.**
2. **One feature per session, commit after each.** Commits must all be from the event weekend.
3. **Every agent action ends in an artifact.** No agents that only chat.
4. **No native app, no Expo, no simulator.** Live camera = `getUserMedia({video:{facingMode:"environment"}})` with `playsinline muted`, plus a file-input upload backup on the same pipeline.
5. **Send frames, never video.** Downscale to 1024px JPEG with canvas (strips EXIF/GPS), SHA-256 in the browser via WebCrypto, re-hash on the server.
6. **Gemma model:** `gemma-4-31b-it` via `google-genai`. Fallbacks: `gemma-4-26b-a4b-it`, then `OLLAMA=1` → `gemma4:e4b`. API models have **no audio input**.
7. **Gemma call pattern:** `thinking_level="minimal"` by default (thinking on = 12-50 s per photo, see docs/inspector-eval.md) → prompt for JSON → strip ``` fences → validate with Pydantic → retry once → else mark `needs_human_check`.
8. **Lawyer cites only sections returned by `va_code_lookup`.** Allowed: 55.1-1220, -1226, -1227, -1231, -1234, -1239, -1241, -1244, -1244.1, -1258. Append "Informational, not legal advice."
9. **Legal framing:** SB 373 (2026, c. 959) amended § 55.1-1241 so tenants no longer must pay rent into court before raising landlord noncompliance as a defense. It did **not** create the defense. Never claim otherwise. Never use the unverified "67%" stat.
10. **Privacy:** no accounts, name and address optional, no secrets in git (`.env` is gitignored, use `.env.example`).
11. **Accessibility:** every control keyboard-reachable and labeled; WCAG AA contrast; alt text on evidence images.

## Agent contracts
- **Inspector** in: image (+ optional notes). Out: `[{type, label, bbox:[x,y,w,h] normalized | region, severity:1-5, confidence:0-1, evidenceNote, needs_human_check}]`. Types: mold, water_damage, broken_lock, exposed_wiring, no_heat_indicator, pest, broken_window, missing_smoke_detector, accessibility_barrier, clogged_drain, own_furniture, other. `safety.correct_type` fixes known model slips in code (a dry hole is not water damage). Never invent an issue that isn't visible. `confidence < 0.85` → `needs_human_check: true` (measured: Gemma 4 rates clear defects 0.9+, ambiguous ones ~0.8).
- **Lawyer** in: findings. Tool: `va_code_lookup(section)`. Out per finding: `statuteSection, plainEnglish, deadlineDays, isEvictionDefense, statuteSnippet (<40 words)`.
- **Advocate** in: findings + statutes + optional name/address. Tools: `draft_letter`, `fill_complaint`, `make_ics`. Posts "Ready for your approval."

## Reference numbers (verified, cite as in README)
705,120 VA filings since 3/2020; 10,712 in Sept 2026; 2024 representation landlords 74.6% / tenants 0.8%; lawyer → 7x more likely to win. Help: SVLAS 1-888-201-2772, 1-833-NoEvict, Blacksburg code inspector (540) 443-1612.
