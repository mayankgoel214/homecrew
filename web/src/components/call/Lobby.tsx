"use client";

import { useState } from "react";
import Character from "@/components/Character";
import { TRADES, type TradeId } from "@/lib/crew";

export default function Lobby({
  onStart,
  openCase,
  starting,
}: {
  onStart: (source: "camera" | "demo", trade: TradeId, renter: boolean) => void;
  openCase: { issues: number; onOpen: () => void } | null;
  starting: boolean;
}) {
  const [trade, setTrade] = useState<TradeId>("general");
  const [renter, setRenter] = useState(true);
  const chosen = TRADES.find((t) => t.id === trade)!;

  return (
    <main
      className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#07080a] px-5 text-white"
      style={{ paddingTop: "max(24px, env(safe-area-inset-top))", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
    >
      <div aria-hidden className="pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl transition-colors duration-500" style={{ background: `${chosen.accent}1f` }} />

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
          {[["I rent", true], ["I own", false]].map(([label, value]) => (
            <button
              key={String(label)}
              role="radio"
              aria-checked={renter === value}
              onClick={() => setRenter(value as boolean)}
              className={`rounded-full px-3 py-1.5 transition-colors ${renter === value ? "bg-white text-black" : "text-white/70"}`}
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>

      <h1 className="relative mt-8 text-[34px] font-extrabold leading-[1.05] tracking-tight">
        Who should
        <br />
        take a look?
      </h1>
      <p className="relative mt-3 text-sm leading-relaxed text-white/65">
        Video-call an expert. They guide you around your place, tell you what&apos;s safe to fix yourself, and
        {renter ? " what your landlord has to fix." : " when to call a pro."}
      </p>

      <ul role="radiogroup" aria-label="Choose an expert" className="relative mt-6 grid grid-cols-2 gap-2.5">
        {TRADES.map((t) => {
          const on = t.id === trade;
          return (
            <li key={t.id} className={t.id === "general" ? "col-span-2" : ""}>
              <button
                role="radio"
                aria-checked={on}
                onClick={() => setTrade(t.id)}
                className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${on ? "bg-white/[0.09]" : "bg-white/[0.04] hover:bg-white/[0.07]"}`}
                style={{ boxShadow: on ? `0 0 0 2px ${t.accent}` : "0 0 0 1px rgba(255,255,255,0.08)" }}
              >
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full" style={{ background: `radial-gradient(circle at 50% 30%, ${t.accent}66, #07080a 75%)` }}>
                  <span className="block h-full w-full translate-y-1 scale-[1.3]">
                    <Character agent="inspector" speaking={false} trade={t.id} />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-tight">{t.role}</span>
                  <span className="block truncate text-[11px] text-white/55">{t.name} · {t.checks}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="relative mt-auto flex flex-col items-center gap-2.5 pt-6">
        <button
          onClick={() => onStart("camera", trade, renter)}
          disabled={starting}
          className="flex w-full max-w-sm items-center justify-center gap-2.5 rounded-full bg-[#34c759] py-4 text-[17px] font-bold text-black shadow-[0_10px_40px_rgba(52,199,89,0.35)] transition-transform active:scale-[0.98] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path d="M15 8.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1.5l5 3.5V5z" fill="currentColor" />
          </svg>
          {starting ? "Calling…" : `Call ${chosen.name}`}
        </button>
        <button onClick={() => onStart("demo", trade, renter)} disabled={starting} className="text-sm text-white/65 underline-offset-4 hover:underline">
          No camera handy? Try the demo feed
        </button>
        {openCase && (
          <button onClick={openCase.onOpen} className="text-sm font-medium text-[#f5b301] underline-offset-4 hover:underline">
            Open your case file ({openCase.issues} issue{openCase.issues === 1 ? "" : "s"})
          </button>
        )}
        <p className="text-center text-[11px] text-white/40">General guidance, not a licensed contractor or attorney · Photos auto-delete in 30 days</p>
      </div>
    </main>
  );
}
