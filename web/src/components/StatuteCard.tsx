"use client";

import { useState } from "react";
import { getStatute, type LegalFinding, type Statute } from "@/lib/api";
import { PERSONAS } from "@/lib/crew";
import { Badge, Icon } from "@/components/ui";

const THEO = PERSONAS.lawyer.accent;

export default function StatuteCard({ finding }: { finding: LegalFinding }) {
  const [statute, setStatute] = useState<Statute | null>(null);
  const [loadError, setLoadError] = useState("");

  async function onToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!e.currentTarget.open || statute) return;
    try {
      setStatute(await getStatute(finding.statute_section));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load the statute");
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge color={THEO}>
          <Icon name="book" className="h-3 w-3" /> Va. Code § {finding.statute_section}
        </Badge>
        {finding.is_eviction_defense && <Badge color="#f5b301">Possible eviction defense</Badge>}
      </div>
      <p className="mt-1 text-xs text-neutral-400">{finding.statute_title}</p>

      <p className="mt-2 text-[15px] leading-snug text-neutral-100">{finding.plain_english}</p>

      <blockquote className="mt-2.5 border-l-2 pl-3 text-[13px] italic leading-snug text-neutral-300" style={{ borderColor: THEO }}>
        “{finding.statute_quote}”
        {!finding.quote_verified && <span className="not-italic text-neutral-400"> (closest sentence in the statute)</span>}
      </blockquote>

      <div className="mt-3 flex gap-2.5 rounded-lg bg-black/40 p-2.5">
        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-black" style={{ background: THEO }}>
          <span className="text-base font-bold leading-none">{finding.deadline_days}</span>
          <span className="text-[9px] font-semibold uppercase">days</span>
        </div>
        <p className="text-xs leading-snug text-neutral-300">{finding.deadline_basis}</p>
      </div>

      {finding.defense_reason && <p className="mt-2 text-xs leading-snug text-neutral-400">{finding.defense_reason}</p>}

      <details className="mt-2 text-xs" onToggle={onToggle}>
        <summary className="cursor-pointer select-none font-medium underline-offset-4 hover:underline" style={{ color: THEO }}>
          Read the full statute
        </summary>
        {loadError && <p role="alert" className="mt-2 text-red-300">{loadError}</p>}
        {!statute && !loadError && <p className="mt-2 text-neutral-400">Loading…</p>}
        {statute && (
          <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line rounded-lg bg-black/50 p-3 leading-relaxed text-neutral-300">
            {statute.text}
            {statute.upcoming_change && <p className="mt-2 text-amber-300">{statute.upcoming_change}</p>}
            <a href={statute.url} target="_blank" rel="noreferrer" className="mt-2 block underline" style={{ color: THEO }}>
              Official text on law.lis.virginia.gov
            </a>
          </div>
        )}
      </details>
    </div>
  );
}
