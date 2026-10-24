# Inspector evaluation (hour one, Sat Oct 24 2026)

12 openly licensed photos from Wikimedia Commons (credits in [samples/CREDITS.md](../samples/CREDITS.md)):
9 with a defect and 3 clean rooms. Run with `cd api && uv run python scripts/eval_inspector.py`.

## Result: 11/12, about 3.5 s per photo

| Photo | Expected | Found | Time |
|---|---|---|---|
| clean_bedroom, clean_loft, clean_smoke_detector | nothing | nothing (no false alarms) | 1.3–1.6 s |
| lock_1 | broken_lock | broken_lock 0.90, water_damage 0.80 (flagged for human check) | 5.7 s |
| mold_1 | mold | mold 0.95 | 3.4 s |
| mouse_droppings | pest | pest 0.90 (one grouped box) | 3.5 s |
| roach_1 | pest | pest 0.90, peeling paint 0.80 (flagged) | 6.2 s |
| roach_2 | pest | pest 0.95 | 3.3 s |
| water_1 | water_damage | water_damage 0.80 (flagged) | 3.4 s |
| water_2 | water_damage | water_damage 0.90 | 3.9 s |
| window_1 (glass shards on the floor, no window in frame) | broken_window | accessibility_barrier "broken glass on floor" 0.95 | 3.7 s |
| wiring_1 | exposed_wiring | exposed_wiring 0.95 | 3.6 s |

The window_1 "miss" is arguably correct: the photo shows glass on a floor, not a window.

## What we learned
1. **Bounding boxes are accurate.** Gemma 4's `box_2d` ([ymin, xmin, ymax, xmax] on a 0–1000 scale) landed on the actual defect in every photo. The 3x3 region fallback is kept for safety but wasn't needed.
2. **Thinking mode was the latency problem.** By default Gemma 4 31B spent 300–1,400 hidden reasoning tokens per photo (12–51 s). `ThinkingConfig(thinking_level="minimal")` gave the same boxes in about 3.5 s. (`thinking_budget` and other levels are rejected for Gemma 4 on the Gemini API.)
3. **With thinking off, the model over-reports.** It split 5 droppings into 5 issues and double-labeled areas. Prompt rules ("one issue per distinct defect", "don't report the same area twice") fixed this.
4. **Confidence is optimistic.** Gemma 4 rated nearly everything 0.8–1.0 even after a calibration instruction. Clear defects come in at 0.9+ and ambiguous ones (stains, peeling paint) at about 0.8. So the human-check cutoff is **0.85**, not 0.5.
5. `gemma-4-26b-a4b-it` gives near-identical boxes and is slightly faster (3.3 s vs 4.0 s), so it's a good fallback.
