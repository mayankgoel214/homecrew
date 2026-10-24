"use client";

import { useEffect, useRef, useState } from "react";
import { frameImageUrl, runLawyer, type Case } from "@/lib/api";
import { PERSONAS } from "@/lib/crew";
import StatuteCard from "@/components/StatuteCard";
import { Badge, Button, Panel, SectionHeader } from "@/components/ui";

const THEO = PERSONAS.lawyer.accent;

export default function LegalReview({
  kase,
  findingCount,
  uploading,
  autoStart = false,
  onChange,
}: {
  kase: Case;
  findingCount: number;
  uploading: boolean; // a photo is still being analyzed
  autoStart?: boolean; // run the review right away (after a call ends)
  onChange: (c: Case) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (autoStart && !started.current && !kase.legal && findingCount > 0) {
      started.current = true;
      review();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  async function review() {
    setBusy(true);
    setError("");
    try {
      onChange(await runLawyer(kase.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lawyer failed");
    } finally {
      setBusy(false);
    }
  }

  const defenses = kase.legal?.findings.filter((f) => f.is_eviction_defense).length ?? 0;

  return (
    <Panel agent="lawyer" labelledBy="legal-heading">
      <SectionHeader
        agent="lawyer"
        id="legal-heading"
        title="What Virginia law says"
        subtitle="Cited only from the official Virginia Code. Informational, not legal advice."
        aside={kase.legal && defenses > 0 ? <Badge color="#f5b301">{defenses} defense{defenses > 1 ? "s" : ""}</Badge> : undefined}
      />

      {!kase.legal && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink">
            {findingCount
              ? `${findingCount} finding${findingCount > 1 ? "s" : ""} in your case. Done photographing?`
              : "No findings yet. Photograph the problems first."}
          </p>
          <Button accent={THEO} onClick={review} disabled={busy || uploading || findingCount === 0}>
            {busy ? "Theo is checking Virginia law…" : uploading ? "Waiting for Rosa…" : "Check the law for all findings"}
          </Button>
        </div>
      )}

      {kase.legal && (
        <div className="flex flex-col gap-4">
          {kase.legal.findings.map((f, n) => {
            const ref = kase.legal_refs[n];
            return (
              <article key={n}>
                <div className="flex items-center gap-2">
                  {ref && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={frameImageUrl(kase.id, ref.frame_id)} alt="" className="h-9 w-9 rounded-lg object-cover" />
                  )}
                  <h3 className="font-semibold first-letter:uppercase">{f.issue_label}</h3>
                </div>
                <StatuteCard finding={f} />
              </article>
            );
          })}
          <p className="text-[11px] leading-snug text-ink-2">
            Looked up {kase.legal.lookups.map((s) => `§ ${s}`).join(", ")}. {kase.legal.disclaimer}
          </p>
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg bg-critical/15 p-3 text-sm text-critical">{error}</p>}
    </Panel>
  );
}
