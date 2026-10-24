"use client";

import type { Case, Issue, Tier } from "@/lib/api";
import { PERSONAS } from "@/lib/crew";
import { TIER } from "@/lib/safety";
import { Panel, SectionHeader, TierTag } from "@/components/ui";

const ORDER: Tier[] = ["emergency", "pro", "landlord", "diy"];

/** Every finding, most urgent first, with the router's fixed steps. */
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
    <Panel labelledBy="plan-heading">
      <SectionHeader
        agent="inspector"
        id="plan-heading"
        title="What to do now"
        subtitle={`${PERSONAS.inspector.name}'s plan. Ratings come from fixed safety rules, not the AI.`}
      />
      <ol className="divide-y divide-hair">
        {items.map((issue, i) => {
          const s = issue.safety!;
          return (
            <li key={i} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-medium text-ink first-letter:uppercase">{issue.label}</h3>
                <TierTag tier={s.tier} />
              </div>
              <p className="mt-1 text-[13px] leading-snug text-ink-2">{s.headline}</p>
              {s.steps.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {s.steps.map((step, n) => (
                    <li key={n} className="flex gap-2 text-[13px] leading-snug text-ink">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: TIER[s.tier].color }} aria-hidden />
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
