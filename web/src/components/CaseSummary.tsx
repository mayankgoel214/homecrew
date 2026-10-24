"use client";

import { motion, useReducedMotion } from "motion/react";
import { frameImageUrl, type Case, type Issue, type Tier } from "@/lib/api";
import { TIER } from "@/lib/safety";
import { TierTag } from "@/components/ui";

const ORDER: Tier[] = ["emergency", "pro", "landlord", "diy"];

/** The one-second version of the case: a number, a tier bar, the evidence, and what to do first. */
export default function CaseSummary({ kase }: { kase: Case }) {
  const reduce = useReducedMotion();
  const items: { issue: Issue; frameId: string }[] = [];
  for (const f of kase.frames) {
    if (f.removed) continue;
    f.issues.forEach((issue, n) => {
      if (!f.dismissed.includes(n)) items.push({ issue, frameId: f.id });
    });
  }
  const total = items.length;
  const counts = ORDER.map((t) => ({ tier: t, n: items.filter((x) => x.issue.safety?.tier === t).length })).filter((c) => c.n > 0);
  const first = [...items].sort(
    (a, b) => ORDER.indexOf(a.issue.safety?.tier ?? "diy") - ORDER.indexOf(b.issue.safety?.tier ?? "diy"),
  )[0];
  const defenses = kase.legal?.findings.filter((f) => f.is_eviction_defense).length ?? 0;

  return (
    <section aria-label="Summary" className="rounded-lg border border-hair bg-surface-1 p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-[72px] font-normal leading-[0.85] tracking-[-0.04em]" style={{ fontVariationSettings: '"opsz" 144' }}>
            {total}
          </p>
          <p className="mt-2 text-sm text-ink-2">problem{total === 1 ? "" : "s"} on record</p>
        </div>
        {kase.legal && (
          <div className="text-right">
            <p className="font-display text-[32px] leading-none text-brass">{defenses}</p>
            <p className="mt-1 font-mono text-[10px] leading-tight text-ink-3">COULD SUPPORT AN<br />EVICTION DEFENSE</p>
          </div>
        )}
      </div>

      {total > 0 && (
        <>
          <div
            className="mt-5 flex h-2 w-full gap-0.5 overflow-hidden rounded-sm"
            role="img"
            aria-label={counts.map((c) => `${c.n} ${TIER[c.tier].label}`).join(", ")}
          >
            {counts.map((c, i) => (
              <motion.span
                key={c.tier}
                className="h-full"
                style={{ background: TIER[c.tier].color, width: `${(c.n / total) * 100}%`, transformOrigin: "left" }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1, transition: { delay: 0.25 + i * 0.08, duration: 0.42, ease: [0.2, 0, 0, 1] } }}
              />
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
            {counts.map((c) => (
              <li key={c.tier} className="flex items-center gap-1.5 font-mono text-[11px] text-ink-2">
                <span className="h-2 w-2 rounded-[1px]" style={{ background: TIER[c.tier].color }} aria-hidden />
                <span className="text-ink">{c.n}</span> {TIER[c.tier].short.toLowerCase()}
              </li>
            ))}
          </ul>

          <ul className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Evidence">
            {items.map(({ issue, frameId }, i) => (
              <li key={i} className="w-[104px] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frameImageUrl(kase.id, frameId)} alt={issue.label} className="aspect-square w-full rounded-md border border-hair object-cover" />
                <p className="mt-1.5 truncate text-[12px] font-medium text-ink first-letter:uppercase">{issue.label}</p>
                {issue.safety && <div className="mt-1"><TierTag tier={issue.safety.tier} size="sm" /></div>}
              </li>
            ))}
          </ul>

          {first?.issue.safety && (
            <div className="mt-5 border-l-2 pl-3" style={{ borderColor: TIER[first.issue.safety.tier].color }}>
              <p className="font-mono text-[10px] text-ink-3">DO THIS FIRST</p>
              <p className="mt-1 text-[15px] leading-snug text-ink">{first.issue.safety.steps[0] ?? first.issue.safety.headline}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
