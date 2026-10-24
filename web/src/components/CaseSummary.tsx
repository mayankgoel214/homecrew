"use client";

import { frameImageUrl, type Case, type Issue, type Tier } from "@/lib/api";
import { TIER } from "@/lib/safety";

const ORDER: Tier[] = ["emergency", "pro", "landlord", "diy"];

/** The one-second version of the case: a number, a colored bar, the photos, and what to do first. */
export default function CaseSummary({ kase }: { kase: Case }) {
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
  const photos = kase.frames.filter((f) => !f.removed);

  return (
    <section aria-label="Summary" className="rounded-3xl bg-gradient-to-b from-neutral-900 to-neutral-950 p-5 ring-1 ring-neutral-800">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[64px] font-extrabold leading-none tracking-tight">{total}</p>
          <p className="mt-1 text-sm text-neutral-300">
            problem{total === 1 ? "" : "s"} found · {photos.length} photo{photos.length === 1 ? "" : "s"}
          </p>
        </div>
        {kase.legal && (
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: "#f5b301" }}>
              {kase.legal.findings.filter((f) => f.is_eviction_defense).length}
            </p>
            <p className="text-[11px] leading-tight text-neutral-400">could be an<br />eviction defense</p>
          </div>
        )}
      </div>

      {total > 0 && (
        <>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-neutral-800" role="img" aria-label={counts.map((c) => `${c.n} ${TIER[c.tier].label}`).join(", ")}>
            {counts.map((c) => (
              <span key={c.tier} style={{ width: `${(c.n / total) * 100}%`, background: TIER[c.tier].color }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-300">
            {counts.map((c) => (
              <li key={c.tier} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: TIER[c.tier].color }} aria-hidden />
                <strong className="text-white">{c.n}</strong> {TIER[c.tier].short.toLowerCase()}
              </li>
            ))}
          </ul>

          <ul className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Photos">
            {items.map(({ issue, frameId }, i) => {
              const t = TIER[issue.safety?.tier ?? "diy"];
              return (
                <li key={i} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={frameImageUrl(kase.id, frameId)} alt={issue.label} className="h-20 w-20 rounded-xl object-cover" />
                  <span className="absolute inset-x-1 bottom-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: t.color, color: t.ink }}>
                    {issue.label}
                  </span>
                </li>
              );
            })}
          </ul>

          {first?.issue.safety && (
            <div className="mt-4 rounded-2xl p-3" style={{ background: `${TIER[first.issue.safety.tier].color}1a`, boxShadow: `inset 0 0 0 1px ${TIER[first.issue.safety.tier].color}55` }}>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TIER[first.issue.safety.tier].color }}>
                Do this first
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {first.issue.safety.steps[0] ?? first.issue.safety.headline}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
