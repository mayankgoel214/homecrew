"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import CrewBadge from "@/components/CrewBadge";
import { type TradeId } from "@/lib/crew";
import { routeProblem } from "@/lib/api";
import { emergencyIn, type EmergencyKind } from "@/lib/safety";
import EmergencyCard from "@/components/call/EmergencyCard";

export type StartOptions = { source: "camera" | "demo"; trade: TradeId; renter: boolean; problem?: string };

const EXAMPLES = ["sink won't drain", "no heat", "black spots on the ceiling", "outlet sparks"];

// Rise: 8px up + fade, 280ms, staggered 40ms (docs/design.md).
const rise = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.06 + i * 0.04, duration: 0.28, ease: [0.2, 0, 0, 1] as const } }),
};

export default function Lobby({
  onStart,
  openCase,
  starting,
}: {
  onStart: (o: StartOptions) => void;
  openCase: { issues: number; onOpen: () => void } | null;
  starting: boolean;
}) {
  const [renter, setRenter] = useState(true);
  const [problem, setProblem] = useState("");
  const [routing, setRouting] = useState(false);
  const [emergency, setEmergency] = useState<EmergencyKind | null>(null);
  const reduce = useReducedMotion();
  const busy = starting || routing;

  async function describe(e: React.FormEvent) {
    e.preventDefault();
    const text = problem.trim();
    if (!text) return;
    const local = emergencyIn(text);
    if (local) return setEmergency(local); // instant, no round trip
    setRouting(true);
    try {
      const r = await routeProblem(text);
      if (r.emergency) return setEmergency(r.emergency as EmergencyKind);
      onStart({ source: "camera", trade: r.trade as TradeId, renter, problem: text });
    } catch {
      onStart({ source: "camera", trade: "general", renter, problem: text });
    } finally {
      setRouting(false);
    }
  }

  const M = reduce ? "div" : motion.div;
  const anim = (i: number) => (reduce ? {} : { variants: rise, initial: "hidden", animate: "show", custom: i });

  return (
    <main
      className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-canvas px-5"
      style={{ paddingTop: "max(20px, env(safe-area-inset-top))", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
    >
      <M {...anim(0)} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
            <rect width="32" height="32" rx="7" fill="#E0A83A" />
            <path d="M8 16.5 16 9l8 7.5V24a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" fill="#0C0B09" />
            <path d="m12.5 18.5 2.5 2.5 4.5-5" stroke="#E0A83A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-display text-[17px] font-medium">HomeCrew</span>
        </div>
        <div role="radiogroup" aria-label="Do you rent or own?" className="flex rounded-md border border-hair bg-surface-1 p-0.5 text-xs">
          {([["Renting", true], ["Own", false]] as const).map(([label, value]) => (
            <button
              key={label}
              role="radio"
              aria-checked={renter === value}
              onClick={() => setRenter(value)}
              className={`tap rounded-sm px-2.5 py-1.5 font-medium ${renter === value ? "bg-surface-3 text-ink" : "text-ink-3"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </M>

      <M {...anim(1)} className="mt-14">
        <h1 className="font-display text-[44px] font-normal leading-[0.98] tracking-[-0.025em]" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144' }}>
          What&apos;s wrong
          <br />
          <span className="italic text-brass">at home?</span>
        </h1>
        <p className="mt-4 max-w-[30ch] text-[15px] leading-relaxed text-ink-2">
          Video-call someone who knows. They look, tell you what&apos;s safe, and{renter ? " what your landlord has to fix." : " when to call a pro."}
        </p>
      </M>

      <M {...anim(2)} className="mt-8">
        <form onSubmit={describe}>
          <label htmlFor="problem" className="sr-only">Describe the problem</label>
          <div className="flex items-center gap-2 rounded-lg border border-hair-strong bg-surface-1 p-1.5 transition-colors focus-within:border-brass">
            <input
              id="problem"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Describe it in a few words"
              autoComplete="off"
              enterKeyHint="go"
              className="min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-[16px] text-ink placeholder:text-ink-3 focus:outline-none"
            />
            <button type="submit" disabled={busy || !problem.trim()} className="tap shrink-0 rounded-md bg-brass px-3.5 py-2.5 text-sm font-semibold text-brass-ink disabled:opacity-30">
              {routing ? "Finding…" : "Call"}
            </button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Examples">
            {EXAMPLES.map((ex) => (
              <li key={ex}>
                <button type="button" onClick={() => setProblem(ex)} className="tap rounded-sm border border-hair px-2.5 py-1 font-mono text-[11px] text-ink-2 hover:border-hair-strong hover:text-ink">
                  {ex}
                </button>
              </li>
            ))}
          </ul>
        </form>
      </M>

      <M {...anim(3)} className="mt-10">
        <section aria-labelledby="inspect-title" className="rounded-lg border border-hair bg-surface-1 p-4">
          <div className="flex items-end gap-1.5">
            <CrewBadge agent="inspector" size={52} trade="general" label />
            <CrewBadge agent="lawyer" size={52} label />
            <CrewBadge agent="advocate" size={52} label />
          </div>
          <h2 id="inspect-title" className="mt-4 font-display text-[22px] font-medium leading-tight tracking-[-0.01em]">
            Full walk-through
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-ink-2">
            Rosa finds the problems. Theo checks Virginia law. June writes the letter. About five minutes.
          </p>
          <button
            onClick={() => onStart({ source: "camera", trade: "general", renter })}
            disabled={busy}
            className="tap mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-ink py-3.5 text-[15px] font-semibold text-canvas disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
              <path d="M15 8.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1.5l5 3.5V5z" fill="currentColor" />
            </svg>
            {starting ? "Connecting…" : "Start video call"}
          </button>
        </section>
      </M>

      <M {...anim(4)} className="mt-auto flex flex-col items-center gap-2 pt-8">
        <div className="flex gap-4 text-[13px]">
          <button onClick={() => onStart({ source: "demo", trade: "general", renter })} disabled={busy} className="tap text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            Try the demo feed
          </button>
          {openCase && (
            <button onClick={openCase.onOpen} className="tap text-brass underline-offset-4 hover:underline">
              Your case file · {openCase.issues}
            </button>
          )}
        </div>
        <p className="text-center font-mono text-[10px] leading-relaxed text-ink-3">
          General guidance · not a licensed contractor or attorney · photos deleted after 30 days
        </p>
      </M>

      {emergency && <EmergencyCard kind={emergency} onDismiss={() => setEmergency(null)} />}
    </main>
  );
}
