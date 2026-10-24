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
    <div className="mt-2 rounded-lg border border-hair bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge color={THEO}>
          <Icon name="book" className="h-3 w-3" /> Va. Code § {finding.statute_section}
        </Badge>
        {finding.is_eviction_defense && <Badge color="#E0A83A">Possible eviction defense</Badge>}
      </div>
      <p className="mt-1 text-xs text-ink-2">{finding.statute_title}</p>

      <p className="mt-2 text-[15px] leading-snug text-ink">{finding.plain_english}</p>

      <blockquote className="mt-2.5 border-l-2 pl-3 text-[13px] italic leading-snug text-ink" style={{ borderColor: THEO }}>
        “{finding.statute_quote}”
        {!finding.quote_verified && <span className="not-italic text-ink-2"> (closest sentence in the statute)</span>}
      </blockquote>

      <div className="mt-3 flex gap-2.5 rounded-lg bg-canvas p-2.5">
        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md text-[#06101A]" style={{ background: THEO }}>
          <span className="font-display text-lg leading-none">{finding.deadline_days}</span>
          <span className="font-mono text-[9px]">DAYS</span>
        </div>
        <p className="text-xs leading-snug text-ink">{finding.deadline_basis}</p>
      </div>

      {finding.defense_reason && <p className="mt-2 text-xs leading-snug text-ink-2">{finding.defense_reason}</p>}

      <details className="mt-2 text-xs" onToggle={onToggle}>
        <summary className="cursor-pointer select-none font-medium underline-offset-4 hover:underline" style={{ color: THEO }}>
          Read the full statute
        </summary>
        {loadError && <p role="alert" className="mt-2 text-critical">{loadError}</p>}
        {!statute && !loadError && <p className="mt-2 text-ink-2">Loading…</p>}
        {statute && (
          <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line rounded-lg bg-canvas p-3 leading-relaxed text-ink">
            {statute.text}
            {statute.upcoming_change && <p className="mt-2 text-caution">{statute.upcoming_change}</p>}
            <a href={statute.url} target="_blank" rel="noreferrer" className="mt-2 block underline" style={{ color: THEO }}>
              Official text on law.lis.virginia.gov
            </a>
          </div>
        )}
      </details>
    </div>
  );
}
