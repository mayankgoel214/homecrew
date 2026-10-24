# HomeCrew design system: "Site visit"

Three professionals on a call, standing in your apartment. Field notebook meets night-shift control room: warm near-black, evidence tags, stamped findings. Not a chatbot, not an orb. Researched against ElevenLabs, OpenAI voice mode, Gemini Live, Siri, Perplexity voice, Linear, Raycast, Granola, Duolingo (sources in the research brief summarized in the git history).

## Tokens (`web/src/app/globals.css`, Tailwind `@theme`)
| Token | Value | Use |
|---|---|---|
| `canvas` | `#0C0B09` | page background (warm, not neutral) |
| `surface-1/2/3` | `#15130F` / `#1E1B16` / `#27231D` | tonal stacking instead of shadows |
| `hair` / `hair-strong` | white 8% / 14% | 1 px borders |
| `ink` / `ink-2` / `ink-3` | `#F2EDE4` / `#B8B0A2` / `#8A8275` | text ramp |
| `brass` | `#E0A83A` | the one accent: primary CTA, focus, "your turn" |
| `rosa` / `theo` / `june` | `#E7B85C` / `#8FB4FF` / `#7ED4A6` | each crew member's hue (badge rim, caption chip) |
| tiers | critical `#FF6B5B`, caution `#FFB454`, note `#7FB7FF`, good `#6FD39A` | always with a glyph + word, never color alone |

Radius scale 4 / 8 / 12 (`rounded-sm/md/lg`); pills only for round controls. No drop shadows at rest, no backdrop blur on panels, no purple, no emoji in UI.

## Type
- **Fraunces** (display, numbers, stamps; `SOFT 100`, `opsz 144` on big headings)
- **IBM Plex Sans** (UI, captions)
- **IBM Plex Mono** (case numbers, timestamps, tags, citations)

## Motion vocabulary
| Move | Spec | Where |
|---|---|---|
| Tap | 90 ms, scale .97 | every button (`.tap`) |
| Settle | 180 ms, `cubic-bezier(.2,0,0,1)` | caption swaps, state changes |
| Rise | 280 ms, 8 px up + fade, 40-60 ms stagger | lobby, case-file sections |
| Handoff | spring 300 / 26 | speaking badge grows 56→72 px |
| Draw | 1.4 s linear arc | "thinking" rim, looking brackets |
| Breathe | 4 s, scale 1→1.02 | idle badges |
| Stamp | 220 ms, `cubic-bezier(.34,1.56,.64,1)` | finding tags, case-file number |
| Edge glow | inset glow on the screen border | while you're talking (Siri pattern) |

All transforms are dropped under `prefers-reduced-motion`; opacity changes stay.

## Signature moments
1. **Point and tag:** a tier-colored box draws onto the live feed where the problem is, with a stamped tag `#02 · BROKEN LOCK · LANDLORD FIXES`.
2. **Handoff:** the speaking badge springs up, the rim follows the real voice level (Web Audio analyser, sine fallback on iOS), the caption chip takes their color.
3. **Case file:** "Case file" in Fraunces, a brass "No. XXXX" stamp, the count, a tier bar that grows in, evidence photos with tags, and "Do this first".

## Usability rules
Controls in the bottom third with safe-area padding; text over video always on a solid 80-90% surface; captions ≥17 px, max two lines; every tier shown as color + glyph + word; focus ring is brass.
