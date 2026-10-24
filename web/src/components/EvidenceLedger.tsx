"use client";

import { useState } from "react";
import { exportUrl, frameImageUrl, updateFrame, verifyCase, type Case, type Verification } from "@/lib/api";
import { PERSONAS } from "@/lib/crew";
import { Badge, Button, Icon, Panel, SectionHeader } from "@/components/ui";

const ROSA = PERSONAS.inspector.accent;
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
    <Panel agent="inspector" labelledBy="ledger-heading">
      <SectionHeader
        agent="inspector"
        id="ledger-heading"
        title="Evidence ledger"
        subtitle="Fingerprinted on your phone and on the server, each entry chained to the last. Edits break the chain."
        aside={<Badge color={ROSA}>{kase.ledger.length} photo{kase.ledger.length === 1 ? "" : "s"}</Badge>}
      />

      <ol className="flex flex-col gap-2">
        {kase.ledger.map((entry) => {
          const f = frames[entry.frame_id];
          const v = verification?.entries.find((x) => x.frame_id === entry.frame_id);
          const ok = v && v.image_matches && v.matches_phone_hash && v.chain_ok;
          return (
            <li
              key={entry.frame_id}
              className={`flex gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5 ${f?.removed ? "opacity-45" : ""}`}
            >
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frameImageUrl(kase.id, entry.frame_id)}
                  alt={`Evidence photo ${entry.seq + 1}${f?.issues.length ? `: ${f.issues.map((i) => i.label).join(", ")}` : ""}`}
                  className="h-[4.5rem] w-[4.5rem] rounded-lg object-cover"
                />
                <span className="absolute -left-1 -top-1 rounded-md bg-black/80 px-1.5 text-[10px] font-bold text-white">
                  #{entry.seq + 1}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-neutral-300">{time(entry.received_at)}</p>
                  {f && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => act(() => updateFrame(kase.id, f.id, { removed: !f.removed }))}
                      className="text-xs"
                    >
                      {f.removed ? "Restore" : "Remove"}
                    </Button>
                  )}
                </div>
                <p className="truncate font-mono text-[11px] text-neutral-400" title={entry.sha256}>
                  sha256 {entry.sha256.slice(0, 16)}…
                </p>
                {v && (
                  <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${ok ? "text-emerald-300" : "text-red-300"}`}>
                    <Icon name={ok ? "check" : "x"} className="h-3.5 w-3.5" />
                    {ok ? "Untouched since capture" : "Changed after capture"}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
                          dismissed ? "bg-neutral-800 text-neutral-400 line-through" : "text-black"
                        }`}
                        style={dismissed ? undefined : { background: ROSA }}
                      >
                        {issue.label}
                        {issue.needs_human_check && !dismissed && (
                          <span className="rounded bg-black/20 px-1 text-[10px] font-bold">CHECK</span>
                        )}
                        <Icon name={dismissed ? "check" : "x"} className="h-3 w-3" />
                      </button>
                    );
                  })}
                  {f && f.issues.length === 0 && <span className="text-xs text-neutral-400">No problems found</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] text-neutral-400">Tap a finding to mark it as not a problem.</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => act(() => verifyCase(kase.id), true)}>
          <Icon name="shield" /> Verify all photos
        </Button>
        <a
          href={exportUrl(kase.id, "evidence.json")}
          download
          className="inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm text-neutral-300 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <Icon name="download" /> Evidence record
        </a>
      </div>
      {verification && (
        <p
          role="status"
          className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
            verification.all_ok ? "bg-emerald-950/60 text-emerald-200" : "bg-red-950/60 text-red-200"
          }`}
        >
          <Icon name={verification.all_ok ? "check" : "x"} />
          {verification.all_ok
            ? `All ${verification.entries.length} photos verified. Nothing has been altered.`
            : "Some records don't match. See the marked photos."}
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </Panel>
  );
}
