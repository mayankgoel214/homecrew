# Research: "pick your expert" video call (Oct 24, 2026)

Question: should HomeCrew let people pick a trade (plumber, electrician, HVAC, pest, locksmith) and get guided around their home by an AI expert on a live video call?

**Answer: yes, as an extension of HomeCrew, not a pivot.** Keep renters as the core user and keep the Virginia lawyer and advocate. Add a trade picker on top of the same call. Every finding goes through a safety check written in code that sorts it into four tiers: safe DIY, call a licensed pro, landlord must fix, or emergency.

## The problem (US numbers)
- **Things break all the time (2023 American Housing Survey, 133M homes):**
  - mice or rats: 15.7M homes
  - water leaking in from outside: 11.8M; leaking from plumbing inside: 11.2M
  - uncomfortably cold for 24+ hours: 10.0M; uncomfortably hot: 13.2M
  - mold: 3.9M; exposed wiring: 3.7M

  ([Census AHS 2023](https://www.census.gov/content/dam/Census/library/visualizations/2024/demo/2023_AHS-Housing%20Qualities_Final(tagged).pdf))
- **Emergency repairs average $1,143 per household (2025)** ([Angi via Stocktitan](https://www.stocktitan.net/news/ANGI/millennials-are-driving-the-future-of-home-spending-according-to-9p7nmzgljb7d.html)). Water damage is the #2 home insurance claim at about $15,400 per claim ([Triple-I](https://www.iii.org/fact-statistic/facts-statistics-homeowners-and-renters-insurance)).
- **Just having someone look costs $75–$200** before any repair: electrician $100–$200 first hour, HVAC diagnostic $75–$150 ([HomeAdvisor](https://www.homeadvisor.com/cost/electrical/hire-an-electrician), [ServiceTitan](https://www.servicetitan.com/blog/hvac-diagnostic-fee)). For renters earning under $30k, who have about $250 a month left after housing, that's a crisis ([NLIHC](https://nlihc.org/resource/latest-state-nations-housing-report-finds-record-number-housing-cost-burdened-renters)).
- **More than half of homeowners misdiagnose their problem** and about 85% struggle to find the right expert. This is Thumbtack's own survey ([BusinessWire, Apr 2026](https://www.businesswire.com/news/home/20260430186888/en/Thumbtack-Introduces-AI-Powered-Experience-to-Reinvent-How-Homeowners-Care-for-Their-Homes)).
- **Health:** about 21% of US asthma is linked to dampness and mold ([HUD Healthy Homes](https://www.hud.gov/sites/dfiles/HH/documents/hh_strategic_plan.web_posting.pdf)).
- **Blacksburg:** about 57–67% of homes are rented, roughly twice the US share ([ACS via zip-codes.com](https://www.zip-codes.com/zip-code/24060/zip-code-24060.asp)).

## How people get help today (and the gap)
| Option | What it is | Gap |
|---|---|---|
| YouTube (87% of DIYers who use social media) | Generic videos | Not about your unit, no safety rules |
| Gemini Live / ChatGPT video | General camera assistants | No trade safety rules, no landlord or legal layer |
| Frontdoor / AHS (Streem) | **Human** experts on video | Limited sessions; $99/yr for 3 |
| Angi, Thumbtack (AI, 2025–26) | AI that sends you to a paid pro | Doesn't help you fix it or deal with your landlord |
| Toolbox, Picmend (2026 startups) | AI on **recorded** video or photos | Not a live two-way call |

**Nobody combines a live AI video call, trade-specific safety rules, and tenant law.** That combination is HomeCrew.

## How real techs diagnose over video
- **Rating plate (model and serial number).** It gives the unit's age and lets you check recalls.
- **Error codes, after a power cycle.**
- **For "no heat":** check the thermostat mode and setpoint, reset the breaker once (if it trips again, stop), then replace the filter. One vendor says those three cause about 73% of no-heat calls ([Sears](https://www.searshomeservices.com/symptom/gas-furnace-not-working); unverified as a national figure).
- **Remote triage avoids a truck visit 42–75% of the time** (Frontdoor/Streem, company-reported) ([release](https://www.stocktitan.net/news/FTDR/frontdoor-streem-technology-reimagines-the-future-of-home-services-4ius9r8qesfe.html)).

## Safety: what the AI must never guide
- **Gas smell:** leave now, no switches or phones inside, call 911 or the utility from outside.
- **CO:** about 400–500 deaths a year ([CDC](https://www.cdc.gov/mmwr/preview/mmwrhtml/mm5402a2.htm)).
- **Electrical panel work:** more than 400 electrocutions a year (older CPSC data via ESFI).
- **Water heater relief valve:** never cap or plug it.
- **Mold over about 10 sq ft, or after flooding or sewage:** needs a pro ([EPA](https://www.epa.gov/node/59549)).
- **Pre-1978 paint or "popcorn" ceilings:** no sanding, scraping or drilling ([EPA RRP](https://epa.gov/lead/lead-renovation-repair-and-painting-program)).
- **Ladders over about 6 ft, roofs, anything structural.**
- **Legal:** a 2025 court let product-liability claims against a chatbot go ahead (*Garcia v. Character Technologies*). Step-by-step gas or electrical instructions are exactly what a plaintiff would attack, so these refusals belong in code, not just in the prompt.

## What the AI can and can't see
- **Good:** large visible defects (stains, mold-like growth, pests, broken locks and windows, missing smoke detectors, exposed wire). Our evaluation scored 11/12.
- **Weak:**
  - gauge and dial readings: the best model scored 25.7% ([InSituMeasure](https://arxiv.org/pdf/2609.04014))
  - dark or blurry frames
  - small text on model plates, so read it back to the user to confirm

  Mold vs. a plain stain can't be told apart by eye, so the AI should say "possible mold."
- **Speed:** about 3.5 s per frame plus voice works for step-by-step guidance ("show me X"), not instant conversation.
- **Voice input:** Gemma 4 31B on the API takes no audio. Use the browser's speech recognition (Chrome; Safari is partial) with a text fallback.

## Options weighed (about 18 h left)
| | (a) Renters only | **(b) Expert picker on the same call** | (c) Full home-repair pivot |
|---|---|---|---|
| Fit with "AI for Housing" | Strong | Strong (renter-first) | Weak (homeowner consumer tool) |
| Build effort | 0 | About 4–6 h | 12 h+ |
| Responsible-AI story | Good | Best (the four tiers are visible on screen) | Riskiest |
| Stands out | Medium | High | Medium (Frontdoor does this with humans) |

## Recommendation: "HomeCrew, the AI repair crew that knows when to stop"
- **Picker before the call:** Plumber · Electrician · Heating/HVAC · Pest · Locks & doors · Mold & water.
- **Each trade gets its own persona and Cartesia voice.** It asks for what a real tech would: "show me under the sink", "show me the thermostat", "show me the rating plate".
- **Every finding goes through a deterministic router:**
  - 🟢 safe DIY steps
  - 🟡 stop, call a licensed pro
  - 🔵 landlord must fix (Theo cites the statute, June drafts the notice)
  - 🔴 emergency (full-screen card: 911 or utility; this one fires on keywords instantly, before the AI)
- **Demo scenarios:**
  1. Plumber finds a leak plus a small mold patch: 🟢 cleanup steps, then 🔵 landlord notice.
  2. Electrician sees exposed wiring: refuses DIY, shows 🟡/🔵. This is the responsible-AI moment.
  3. Saying "I smell gas" mid-call: the 🔴 card appears instantly.
- **Nonprofit deployment:** pre-visit triage for Habitat for Humanity critical repair, weatherization intake, and legal aid evidence packets.
