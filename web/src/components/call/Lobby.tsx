"use client";

import { useState } from "react";
import Character from "@/components/Character";
import { PERSONAS, TRADES, type TradeId } from "@/lib/crew";
import { routeProblem } from "@/lib/api";
import { EMERGENCY, emergencyIn, type EmergencyKind } from "@/lib/safety";
import EmergencyCard from "@/components/call/EmergencyCard";

export type StartOptions = { source: "camera" | "demo"; trade: TradeId; renter: boolean; problem?: string };

const EXAMPLES = ["my sink won't drain", "no heat in the bedroom", "black spots on the ceiling", "the outlet sparks"];

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

  const busy = starting || routing;

  return (
    <main
      className="relative flex min-h-[100dvh] flex-col bg-[#07080a] px-5 text-white"
      style={{ paddingTop: "max(24px, env(safe-area-inset-top))", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
    >
      <div aria-hidden className="pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#f5b301]/10 blur-3xl" />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
            <rect width="32" height="32" rx="9" fill="#f5b301" />
            <path d="M8 16.5 16 9l8 7.5V24a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" fill="#07080a" />
            <path d="m12.5 18.5 2.5 2.5 4.5-5" stroke="#f5b301" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-bold tracking-tight">HomeCrew</span>
        </div>
        <div role="radiogroup" aria-label="Do you rent or own?" className="flex rounded-full bg-white/10 p-0.5 text-xs font-semibold">
          {([["I rent", true], ["I own", false]] as const).map(([label, value]) => (
            <button
              key={label}
              role="radio"
              aria-checked={renter === value}
              onClick={() => setRenter(value)}
              className={`rounded-full px-3 py-1.5 transition-colors ${renter === value ? "bg-white text-black" : "text-white/70"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <h1 className="relative mt-9 text-[34px] font-extrabold leading-[1.05] tracking-tight">
        What&apos;s going on
        <br />
        at home?
      </h1>

      <form onSubmit={describe} className="relative mt-5">
        <label htmlFor="problem" className="sr-only">Describe the problem</label>
        <div className="flex items-center gap-2 rounded-2xl bg-white/[0.07] p-2 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-[#f5b301]">
          <input
            id="problem"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="e.g. my sink won't drain"
            autoComplete="off"
            enterKeyHint="go"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[16px] text-white placeholder:text-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !problem.trim()}
            className="shrink-0 rounded-xl bg-[#f5b301] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
          >
            {routing ? "Finding…" : "Call an expert"}
          </button>
        </div>
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Examples">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <button type="button" onClick={() => setProblem(ex)} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/70 hover:bg-white/10">
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </form>

      <div className="relative mt-7 flex items-center gap-3 text-xs text-white/40">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <section className="relative mt-5 rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.03] p-4 ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3">
            {(["inspector", "lawyer", "advocate"] as const).map((id) => (
              <span key={id} className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-[#0b0c0f]" style={{ background: `radial-gradient(circle at 50% 30%, ${PERSONAS[id].accent}77, #07080a 75%)` }}>
                <span className="block h-full w-full translate-y-1 scale-[1.3]">
                  <Character agent={id} speaking={false} trade="general" />
                </span>
              </span>
            ))}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight">Full home inspection</h2>
            <p className="text-xs text-white/60">Rosa inspects, Theo checks Virginia law, June writes the letter.</p>
          </div>
        </div>
        <button
          onClick={() => onStart({ source: "camera", trade: "general", renter })}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-full bg-[#34c759] py-3.5 text-[16px] font-bold text-black shadow-[0_10px_30px_rgba(52,199,89,0.3)] transition-transform active:scale-[0.98] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path d="M15 8.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1.5l5 3.5V5z" fill="currentColor" />
          </svg>
          {starting ? "Calling…" : "Start the video call"}
        </button>
      </section>

      <div className="relative mt-auto flex flex-col items-center gap-2 pt-5">
        <button onClick={() => onStart({ source: "demo", trade: "general", renter })} disabled={busy} className="text-sm text-white/60 underline-offset-4 hover:underline">
          No camera handy? Try the demo feed
        </button>
        {openCase && (
          <button onClick={openCase.onOpen} className="text-sm font-medium text-[#f5b301] underline-offset-4 hover:underline">
            Open your case file ({openCase.issues} issue{openCase.issues === 1 ? "" : "s"})
          </button>
        )}
        <p className="text-center text-[11px] text-white/40">
          Experts: {TRADES.filter((t) => t.id !== "general").map((t) => t.role.toLowerCase()).join(", ")} · General guidance, not a licensed contractor or attorney
        </p>
      </div>

      {emergency && <EmergencyCard kind={emergency} onDismiss={() => setEmergency(null)} />}
      {emergency && <span className="sr-only">{EMERGENCY[emergency].title}</span>}
    </main>
  );
}
