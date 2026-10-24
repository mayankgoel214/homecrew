"use client";

import { useState } from "react";
import { approveDraft, exportUrl, runAdvocate, type Case, type TenantInfo } from "@/lib/api";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
const prettyDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const field = "w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100";

export default function AdvocatePanel({ kase, onChange }: { kase: Case; onChange: (c: Case) => void }) {
  const [tenant, setTenant] = useState<TenantInfo>({
    tenant_name: "", unit_address: "", landlord_name: "", notice_date: today(), mode: "repair", notes: "",
  });
  const draft = kase.draft;
  const [editing, setEditing] = useState(false); // back to the details form
  const [letter, setLetter] = useState(draft?.letter_text ?? "");
  const [busy, setBusy] = useState<"" | "drafting" | "approving">("");
  const [error, setError] = useState("");

  const set = (key: keyof TenantInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setTenant((t) => ({ ...t, [key]: e.target.value }));

  async function onDraft(e: React.FormEvent) {
    e.preventDefault();
    setBusy("drafting");
    setError("");
    try {
      const updated = await runAdvocate(kase.id, tenant);
      onChange(updated);
      setLetter(updated.draft?.letter_text ?? "");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Advocate failed");
    } finally {
      setBusy("");
    }
  }

  async function onApprove() {
    if (!draft) return;
    setBusy("approving");
    setError("");
    try {
      onChange(await approveDraft(kase.id, letter));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <section aria-labelledby="advocate-heading" className="rounded-md border border-emerald-900 bg-emerald-950/30 p-4">
      <h2 id="advocate-heading" className="text-lg font-semibold text-emerald-100">Advocate: your paperwork</h2>

      {(!draft || editing) && (
        <form onSubmit={onDraft} className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-neutral-400">
            All optional. Used only to fill in your letter. Leave blank to fill in by hand later.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Your name
            <input className={field} value={tenant.tenant_name} onChange={set("tenant_name")} autoComplete="name" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Unit address
            <input className={field} value={tenant.unit_address} onChange={set("unit_address")} autoComplete="street-address" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Landlord or property manager
            <input className={field} value={tenant.landlord_name} onChange={set("landlord_name")} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Date your landlord will receive the notice
            <input type="date" className={field} value={tenant.notice_date} onChange={set("notice_date")} required />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={tenant.mode === "repair_or_terminate"}
              onChange={(e) => setTenant((t) => ({ ...t, mode: e.target.checked ? "repair_or_terminate" : "repair" }))}
            />
            <span>
              Also end my lease if repairs aren&apos;t made in 21 days
              <span className="block text-xs text-neutral-400">
                Adds the § 55.1-1234 termination wording. Only choose this if you&apos;re ready to move out. Talk to legal aid first.
              </span>
            </span>
          </label>
          <button
            type="submit"
            disabled={busy !== ""}
            className="rounded-md bg-emerald-300 py-3 font-medium text-black disabled:opacity-50"
          >
            {busy === "drafting" ? "Advocate is drafting…" : "Draft my letter and complaint"}
          </button>
        </form>
      )}

      {draft && !editing && (
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="letter" className="text-sm font-medium">
              Repair notice {draft.approved ? "(approved)" : "(review and edit before approving)"}
            </label>
            <textarea
              id="letter"
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              readOnly={draft.approved}
              rows={14}
              className={`${field} font-mono text-xs leading-relaxed`}
            />
          </div>

          <div>
            <h3 className="text-sm font-medium">Code complaint packet</h3>
            <p className="mt-1 text-sm text-neutral-300">{draft.complaint.description}</p>
            <p className="mt-1 text-xs text-neutral-400">
              File with: {draft.complaint.to.office}, {draft.complaint.to.phone}. {draft.complaint.to.note}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium">Your deadlines</h3>
            <ol className="mt-1 flex flex-col gap-2">
              {draft.deadlines.map((d) => (
                <li key={d.title} className="text-sm">
                  <span className="font-semibold text-emerald-200">{prettyDate(d.day)}</span>: {d.title}
                  <span className="block text-xs text-neutral-400">{d.detail}</span>
                </li>
              ))}
            </ol>
          </div>

          {!draft.approved ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-neutral-400">
                Nothing is sent to anyone. HomeCrew never contacts your landlord or the town. You approve, download and send it yourself.
              </p>
              <button
                onClick={onApprove}
                disabled={busy !== ""}
                className="rounded-md bg-emerald-300 py-3 font-medium text-black disabled:opacity-50"
              >
                {busy === "approving" ? "Approving…" : "I've reviewed this. Approve."}
              </button>
              <button onClick={() => setEditing(true)} disabled={busy !== ""} className="text-sm text-neutral-400 underline">
                Change my details
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-emerald-200">Approved. Download your files:</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <a href={exportUrl(kase.id, "letter.pdf")} download className="rounded-md bg-white py-2 text-center text-sm font-medium text-black">
                  Letter (PDF)
                </a>
                <a href={exportUrl(kase.id, "complaint.pdf")} download className="rounded-md bg-white py-2 text-center text-sm font-medium text-black">
                  Complaint (PDF)
                </a>
                <a href={exportUrl(kase.id, "deadlines.ics")} download className="rounded-md bg-white py-2 text-center text-sm font-medium text-black">
                  Deadlines (calendar)
                </a>
              </div>
            </div>
          )}

          <div className="rounded-md bg-black/30 p-3 text-xs text-neutral-300">
            <p className="font-medium text-neutral-100">Free legal help</p>
            {draft.legal_help.map((h) => (
              <p key={h.name}>
                {h.name}: <a className="underline" href={`tel:${h.phone.replace(/[^0-9]/g, "")}`}>{h.phone}</a>
              </p>
            ))}
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-md bg-red-950 p-3 text-sm text-red-200">{error}</p>}
    </section>
  );
}
