"use client";

import { useState } from "react";
import { frameImageUrl, runLawyer, type Case } from "@/lib/api";
import StatuteCard from "@/components/StatuteCard";

export default function LegalReview({
  kase,
  findingCount,
  onChange,
}: {
  kase: Case;
  findingCount: number;
  onChange: (c: Case) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <section aria-labelledby="legal-heading" className="rounded-md border border-sky-900 p-4">
      <h2 id="legal-heading" className="text-lg font-semibold text-sky-100">Lawyer: what Virginia law says</h2>

      {!kase.legal && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm text-neutral-300">
            {findingCount
              ? `${findingCount} finding${findingCount > 1 ? "s" : ""} in your case. Done photographing?`
              : "No findings yet. Photograph the problems first."}
          </p>
          <button
            onClick={review}
            disabled={busy || findingCount === 0}
            className="rounded-md bg-sky-300 py-3 font-medium text-black disabled:opacity-40"
          >
            {busy ? "Lawyer is checking Virginia law…" : "Check the law for all findings"}
          </button>
        </div>
      )}

      {kase.legal && (
        <div className="mt-2 flex flex-col gap-4">
          {kase.legal.findings.map((f, n) => {
            const ref = kase.legal_refs[n];
            return (
              <article key={n} className="flex flex-col">
                <div className="flex items-center gap-2">
                  {ref && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={frameImageUrl(kase.id, ref.frame_id)} alt="" className="h-10 w-10 rounded object-cover" />
                  )}
                  <h3 className="font-medium capitalize">{f.issue_label}</h3>
                </div>
                <StatuteCard finding={f} />
              </article>
            );
          })}
          <p className="text-xs text-neutral-400">
            Looked up {kase.legal.lookups.map((s) => `§ ${s}`).join(", ")}. {kase.legal.disclaimer}
          </p>
        </div>
      )}
      {error && <p role="alert" className="mt-2 rounded-md bg-red-950 p-3 text-sm text-red-200">{error}</p>}
    </section>
  );
}
