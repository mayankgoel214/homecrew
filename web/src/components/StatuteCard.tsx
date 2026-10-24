"use client";

import { useState } from "react";
import { getStatute, type LegalFinding, type Statute } from "@/lib/api";

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
    <div className="mt-3 rounded-md border border-sky-900 bg-sky-950/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-sky-800 px-2 py-0.5 text-xs font-semibold text-sky-50">
          Va. Code § {finding.statute_section}
        </span>
        <span className="text-xs text-sky-200">{finding.statute_title}</span>
        {finding.is_eviction_defense && (
          <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-semibold text-black">
            Possible eviction defense
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-neutral-100">{finding.plain_english}</p>
      <blockquote className="mt-2 border-l-2 border-sky-700 pl-3 text-xs italic text-neutral-300">
        “{finding.statute_quote}”
        {!finding.quote_verified && (
          <span className="not-italic text-neutral-500"> (closest sentence in the statute)</span>
        )}
      </blockquote>
      <p className="mt-2 text-xs text-neutral-300">
        <strong className="text-neutral-100">{finding.deadline_days}-day repair deadline.</strong>{" "}
        {finding.deadline_basis}
      </p>
      {finding.defense_reason && <p className="mt-1 text-xs text-neutral-400">{finding.defense_reason}</p>}
      <details className="mt-2 text-xs" onToggle={onToggle}>
        <summary className="cursor-pointer text-sky-300 underline-offset-2 hover:underline">
          Read the full statute
        </summary>
        {loadError && <p role="alert" className="mt-2 text-red-300">{loadError}</p>}
        {!statute && !loadError && <p className="mt-2 text-neutral-500">Loading…</p>}
        {statute && (
          <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line rounded bg-black/40 p-2 text-neutral-300">
            {statute.text}
            {statute.upcoming_change && <p className="mt-2 text-amber-300">{statute.upcoming_change}</p>}
            <a href={statute.url} target="_blank" rel="noreferrer" className="mt-2 block text-sky-300 underline">
              Official text on law.lis.virginia.gov
            </a>
          </div>
        )}
      </details>
    </div>
  );
}
