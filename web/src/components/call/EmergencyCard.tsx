"use client";

import { useEffect, useRef } from "react";
import { EMERGENCY, type EmergencyKind } from "@/lib/safety";

/** Full-screen, high-contrast, impossible to miss. Shown instantly on a spoken trigger, or when
 *  the crew sees active danger. Every other piece of guidance stops while it's up. */
export default function EmergencyCard({ kind, onDismiss }: { kind: EmergencyKind; onDismiss: () => void }) {
  const e = EMERGENCY[kind];
  const callRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    callRef.current?.focus();
    navigator.vibrate?.([300, 150, 300]);
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="emergency-title"
      className="fixed inset-0 z-50 flex flex-col bg-[#B3261E] px-6 text-white"
      style={{ paddingTop: "max(28px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
    >
      <p className="font-mono text-xs text-white/85">EMERGENCY · STOP EVERYTHING ELSE</p>
      <h2 id="emergency-title" className="mt-3 font-display text-[38px] font-medium leading-[1.02] tracking-[-0.02em]">{e.title}</h2>
      <ol className="mt-6 flex flex-col gap-3">
        {e.steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-[17px] leading-snug">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white font-mono text-sm font-medium text-[#B3261E]">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <div className="mt-auto flex flex-col gap-3">
        <a
          ref={callRef}
          href="tel:911"
          className="tap flex items-center justify-center gap-2 rounded-md bg-white py-4 text-xl font-semibold text-[#B3261E] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Call 911
        </a>
        <button onClick={onDismiss} className="py-2 text-sm font-semibold text-white/85 underline underline-offset-4">
          I&apos;m safe, go back to the call
        </button>
      </div>
    </div>
  );
}
