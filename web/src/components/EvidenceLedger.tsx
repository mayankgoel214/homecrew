"use client";

import { useState } from "react";
import { exportUrl, frameImageUrl, updateFrame, verifyCase, type Case, type Verification } from "@/lib/api";

const time = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function EvidenceLedger({ kase, onChange }: { kase: Case; onChange: (c: Case) => void }) {
  const [verification, setVerification] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const frames = Object.fromEntries(kase.frames.map((f) => [f.id, f]));

  async function act(fn: () => Promise<Case | Verification>, isVerify = false) {
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      if (isVerify) setVerification(result as Verification);
      else {
        onChange(result as Case);
        setVerification(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="ledger-heading" className="rounded-md border border-neutral-700 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="ledger-heading" className="text-lg font-semibold">Evidence ledger</h2>
        <span className="text-xs text-neutral-400">{kase.ledger.length} photo{kase.ledger.length === 1 ? "" : "s"}</span>
      </div>
      <p className="mt-1 text-xs text-neutral-400">
        Each photo is fingerprinted (SHA-256) on your phone and again on the server, and each entry is chained to the
        one before it. Any later edit to a photo or a timestamp breaks the chain.
      </p>

      <ol className="mt-3 flex flex-col gap-3">
        {kase.ledger.map((entry) => {
          const f = frames[entry.frame_id];
          const v = verification?.entries.find((x) => x.frame_id === entry.frame_id);
          const ok = v && v.image_matches && v.matches_phone_hash && v.chain_ok;
          return (
            <li key={entry.frame_id} className={`flex gap-3 ${f?.removed ? "opacity-40" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frameImageUrl(kase.id, entry.frame_id)}
                alt={`Evidence photo ${entry.seq + 1}${f?.issues.length ? `: ${f.issues.map((i) => i.label).join(", ")}` : ""}`}
                className="h-20 w-20 shrink-0 rounded object-cover"
              />
              <div className="min-w-0 flex-1 text-xs">
                <p className="text-neutral-200">
                  #{entry.seq + 1} · {time(entry.received_at)}
                  {f?.removed && <span className="ml-1 text-neutral-400">(removed from case)</span>}
                </p>
                <p className="truncate font-mono text-neutral-500" title={entry.sha256}>
                  {entry.sha256.slice(0, 20)}…
                </p>
                {v && (
                  <p className={ok ? "text-emerald-300" : "text-red-300"}>
                    {ok ? "✓ Verified: untouched since capture" : "✗ Does not match. This photo or its record was changed."}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {f?.issues.map((issue, i) => {
                    const dismissed = f.dismissed.includes(i);
                    return (
                      <button
                        key={i}
                        disabled={busy || f.removed}
                        onClick={() =>
                          act(() =>
                            updateFrame(kase.id, f.id, {
                              dismissed: dismissed ? f.dismissed.filter((d) => d !== i) : [...f.dismissed, i],
                            }),
                          )
                        }
                        aria-pressed={!dismissed}
                        title={dismissed ? "Include this finding again" : "Mark as not a problem"}
                        className={`rounded-full border px-2 py-0.5 ${
                          dismissed ? "border-neutral-700 text-neutral-500 line-through" : "border-neutral-500 text-neutral-200"
                        }`}
                      >
                        {issue.label}
                        {issue.needs_human_check && !dismissed && <span className="ml-1 text-amber-300">check</span>}
                        <span aria-hidden className="ml-1">{dismissed ? "+" : "×"}</span>
                      </button>
                    );
                  })}
                  {f && f.issues.length === 0 && <span className="text-neutral-500">no problems found</span>}
                </div>
              </div>
              {f && (
                <button
                  disabled={busy}
                  onClick={() => act(() => updateFrame(kase.id, f.id, { removed: !f.removed }))}
                  className="self-start text-xs text-neutral-400 underline"
                >
                  {f.removed ? "Restore" : "Remove"}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          disabled={busy}
          onClick={() => act(() => verifyCase(kase.id), true)}
          className="rounded-md border border-neutral-500 px-3 py-2 text-sm disabled:opacity-50"
        >
          Verify all photos
        </button>
        <a href={exportUrl(kase.id, "evidence.json")} download className="text-sm text-neutral-300 underline">
          Download evidence record
        </a>
      </div>
      {verification && (
        <p role="status" className={`mt-2 text-sm ${verification.all_ok ? "text-emerald-300" : "text-red-300"}`}>
          {verification.all_ok
            ? `All ${verification.entries.length} photos verified. Nothing has been altered.`
            : "Some records don't match. See the marked photos."}
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </section>
  );
}
