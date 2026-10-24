"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { approveDraft, exportUrl, runAdvocate, type Case, type TenantInfo } from "@/lib/api";
import { Icon } from "@/components/ui";
import CrewBadge from "@/components/CrewBadge";

const today = () => new Date().toLocaleDateString("en-CA");
const field = "w-full rounded-md border border-hair-strong bg-surface-2 px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-3 focus:border-brass focus:outline-none";
const FILES = [
  { kind: "letter.pdf", title: "Letter", icon: "file" },
  { kind: "complaint.pdf", title: "Complaint", icon: "shield" },
  { kind: "deadlines.ics", title: "Calendar", icon: "calendar" },
] as const;

/** June's card: one tap to draft, a peek at the letter, approve, download. Details are optional. */
export default function Paperwork({ kase, onChange }: { kase: Case; onChange: (c: Case) => void }) {
  const draft = kase.draft;
  const [tenant, setTenant] = useState<TenantInfo>({ tenant_name: "", unit_address: "", landlord_name: "", notice_date: today(), mode: "repair", notes: "" });
  const [details, setDetails] = useState(false);
  const [reading, setReading] = useState(false);
  const [letter, setLetter] = useState(draft?.letter_text ?? "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const set = (k: keyof TenantInfo) => (e: React.ChangeEvent<HTMLInputElement>) => setTenant((t) => ({ ...t, [k]: e.target.value }));

  async function act(kind: "draft" | "approve") {
    setBusy(kind);
    setError("");
    try {
      const c = kind === "draft" ? await runAdvocate(kase.id, tenant) : await approveDraft(kase.id, letter);
      onChange(c);
      if (kind === "draft") setLetter(c.draft?.letter_text ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy("");
    }
  }

  return (
    <section aria-labelledby="paperwork-title" className="rounded-lg border border-hair bg-surface-1 p-4">
      <div className="flex items-center gap-3">
        <CrewBadge agent="advocate" size={40} state={busy === "draft" ? "thinking" : "idle"} />
        <div className="min-w-0 flex-1">
          <h2 id="paperwork-title" className="font-display text-[20px] leading-tight">
            {!draft ? "Your repair letter" : draft.approved ? "Ready to send" : "Letter drafted"}
          </h2>
          <p className="font-mono text-[10px] text-ink-3">
            {!draft ? "JUNE WRITES IT · YOU APPROVE IT" : draft.approved ? "NOTHING IS SENT FOR YOU" : "READ IT, THEN APPROVE"}
          </p>
        </div>
      </div>

      {!draft && (
        <>
          <AnimatePresence initial={false}>
            {details && (
              <motion.div className="mt-3 space-y-2 overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                <input className={field} placeholder="Your name" value={tenant.tenant_name} onChange={set("tenant_name")} autoComplete="name" />
                <input className={field} placeholder="Unit address" value={tenant.unit_address} onChange={set("unit_address")} autoComplete="street-address" />
                <input className={field} placeholder="Landlord or property manager" value={tenant.landlord_name} onChange={set("landlord_name")} />
                <label className="flex items-start gap-2 pt-1 text-[13px] text-ink-2">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#E0A83A]" checked={tenant.mode === "repair_or_terminate"}
                    onChange={(e) => setTenant((t) => ({ ...t, mode: e.target.checked ? "repair_or_terminate" : "repair" }))} />
                  Also end my lease if repairs aren&apos;t made (talk to legal aid first)
                </label>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mt-3 flex gap-2">
            <button onClick={() => act("draft")} disabled={!!busy} className="tap flex-1 rounded-md bg-brass py-3 text-[15px] font-semibold text-brass-ink disabled:opacity-50">
              {busy === "draft" ? "June is writing…" : "Write my letter"}
            </button>
            {!details && (
              <button onClick={() => setDetails(true)} className="tap rounded-md border border-hair-strong px-3 text-[13px] text-ink-2">
                + My details
              </button>
            )}
          </div>
        </>
      )}

      {draft && !draft.approved && (
        <>
          <div className="relative mt-3">
            <textarea
              aria-label="Your repair letter"
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              rows={reading ? 14 : 5}
              className="w-full resize-none rounded-md border border-hair bg-[#fbfaf7] px-3.5 py-3 font-display text-[14px] leading-relaxed text-[#1c1a16] focus:outline-none focus:ring-2 focus:ring-brass"
            />
            {!reading && (
              <button onClick={() => setReading(true)} className="absolute inset-x-0 bottom-0 rounded-b-md bg-gradient-to-t from-[#fbfaf7] via-[#fbfaf7]/90 to-transparent pb-2 pt-8 text-[13px] font-medium text-[#1c1a16]">
                Read the whole letter
              </button>
            )}
          </div>
          <button onClick={() => act("approve")} disabled={!!busy} className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-brass py-3 text-[15px] font-semibold text-brass-ink disabled:opacity-50">
            <Icon name="check" /> {busy === "approve" ? "Approving…" : "Approve"}
          </button>
        </>
      )}

      {draft?.approved && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {FILES.map((f) => (
            <a key={f.kind} href={exportUrl(kase.id, f.kind)} download className="tap flex flex-col items-center gap-1.5 rounded-md border border-hair-strong bg-surface-2 py-3 text-[12px] font-medium text-ink hover:bg-surface-3">
              <Icon name={f.icon} className="h-5 w-5 text-june" />
              {f.title}
            </a>
          ))}
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-[13px] text-critical">{error}</p>}
      <p className="mt-3 font-mono text-[10px] text-ink-3">
        FREE HELP · <a className="underline" href="tel:18882012772">SW VA LEGAL AID 888-201-2772</a> · <a className="underline" href="tel:18336638428">833-NOEVICT</a>
      </p>
    </section>
  );
}
