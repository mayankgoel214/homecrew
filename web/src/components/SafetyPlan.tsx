"use client";

import type { Case, Issue, Tier } from "@/lib/api";
import { PERSONAS } from "@/lib/crew";
import { TIER } from "@/lib/safety";
import { Panel, SectionHeader } from "@/components/ui";

const ORDER: Tier[] = ["emergency", "pro", "landlord", "diy"];

/** Every finding, sorted by how urgent it is, with the router's fixed steps. */
export default function SafetyPlan({ kase }: { kase: Case }) {
  const items: Issue[] = [];
  for (const f of kase.frames) {
    if (f.removed) continue;
    f.issues.forEach((issue, n) => {
      if (!f.dismissed.includes(n) && issue.safety) items.push(issue);
    });
  }
  if (!items.length) return null;
  items.sort((a, b) => ORDER.indexOf(a.safety!.tier) - ORDER.indexOf(b.safety!.tier));

  return (
    <Panel agent="inspector" labelledBy="plan-heading">
      <SectionHeader
        agent="inspector"
        id="plan-heading"
        title="What to do now"
        subtitle={`${PERSONAS.inspector.name}'s safety plan. Ratings come from fixed safety rules, not the AI.`}
      />
      <ol className="flex flex-col gap-2.5">
        {items.map((issue, i) => {
          const s = issue.safety!;
          const t = TIER[s.tier];
          return (
            <li key={i} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold first-letter:uppercase">{issue.label}</h3>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: t.color, color: t.ink }}>
                  {t.label}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-neutral-200">{s.headline}</p>
              {s.steps.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-300">
                  {s.steps.map((step, n) => (
                    <li key={n} className="flex gap-2">
                      <span aria-hidden style={{ color: t.color }}>•</span>
                      {step}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
