"use client";

import { useState } from "react";
import { approveDraft, exportUrl, runAdvocate, type Case, type TenantInfo } from "@/lib/api";
import { PERSONAS } from "@/lib/crew";
import { Button, Icon, Panel, SectionHeader } from "@/components/ui";

const JUNE = PERSONAS.advocate.accent;
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
const prettyDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const field =
  "w-full rounded-lg border border-hair-strong bg-surface-2 px-3 py-2.5 text-sm text-ink " +
  "placeholder:text-ink-3 focus:border-brass focus:outline-none";

const DOWNLOADS = [
  { kind: "letter.pdf", title: "Repair notice", sub: "PDF to send your landlord", icon: "file" },
  { kind: "complaint.pdf", title: "Code complaint", sub: "PDF for the Blacksburg inspector", icon: "shield" },
  { kind: "deadlines.ics", title: "Deadlines", sub: "Add to your calendar", icon: "calendar" },
] as const;

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
    <Panel agent="advocate" labelledBy="advocate-heading">
      <SectionHeader
        agent="advocate"
        id="advocate-heading"
        title="Your paperwork"
        subtitle="Nothing is sent to anyone. You review, approve and send it yourself."
      />

      {(!draft || editing) && (
        <form onSubmit={onDraft} className="flex flex-col gap-3">
          <p className="text-xs text-ink-2">All optional, used only to fill in your letter.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              Your name
              <input className={field} value={tenant.tenant_name} onChange={set("tenant_name")} autoComplete="name" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              Landlord or property manager
              <input className={field} value={tenant.landlord_name} onChange={set("landlord_name")} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs font-medium text-ink">
            Unit address
            <input className={field} value={tenant.unit_address} onChange={set("unit_address")} autoComplete="street-address" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-ink">
            Date your landlord will receive the notice
            <input type="date" className={field} value={tenant.notice_date} onChange={set("notice_date")} required />
          </label>
          <label className="flex items-start gap-2.5 rounded-lg border border-hair bg-surface-2 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#E0A83A]"
              checked={tenant.mode === "repair_or_terminate"}
              onChange={(e) => setTenant((t) => ({ ...t, mode: e.target.checked ? "repair_or_terminate" : "repair" }))}
            />
            <span>
              Also end my lease if repairs aren&apos;t made in 21 days
              <span className="mt-0.5 block text-xs text-ink-2">
                Adds the § 55.1-1234 termination wording. Only if you&apos;re ready to move out. Talk to legal aid first.
              </span>
            </span>
          </label>
          <Button type="submit" accent={JUNE} disabled={busy !== ""}>
            {busy === "drafting" ? "June is drafting…" : "Draft my letter and complaint"}
          </Button>
        </form>
      )}

      {draft && !editing && (
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="letter" className="text-sm font-semibold text-ink">
                Repair notice
              </label>
              <span className="text-[11px] text-ink-2">{draft.approved ? "Approved" : "Edit anything before approving"}</span>
            </div>
            <textarea
              id="letter"
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              readOnly={draft.approved}
              rows={13}
              className="w-full rounded-lg border border-hair bg-[#fbfaf7] px-4 py-3 font-display text-[14px] leading-relaxed text-[#1c1a16] focus:outline-none focus:ring-2"
              style={{ ["--tw-ring-color" as string]: JUNE }}
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink">Code complaint</h3>
            <p className="mt-1 text-sm leading-snug text-ink">{draft.complaint.description}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-2">
              <Icon name="phone" className="h-3.5 w-3.5" /> {draft.complaint.to.office}, {draft.complaint.to.phone}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink">Your deadlines</h3>
            <ol className="relative mt-2 flex flex-col gap-3 border-l border-hair pl-5">
              {draft.deadlines.map((d) => (
                <li key={d.title} className="relative">
                  <span aria-hidden className="absolute -left-[1.6rem] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-canvas" style={{ background: JUNE }} />
                  <p className="text-xs font-semibold" style={{ color: JUNE }}>{prettyDate(d.day)}</p>
                  <p className="text-sm text-ink">{d.title}</p>
                  <p className="text-xs leading-snug text-ink-2">{d.detail}</p>
                </li>
              ))}
            </ol>
          </div>

          {!draft.approved ? (
            <div className="flex flex-col gap-2">
              <Button accent={JUNE} onClick={onApprove} disabled={busy !== ""}>
                <Icon name="check" /> {busy === "approving" ? "Approving…" : "I've reviewed this. Approve."}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(true)} disabled={busy !== ""} className="self-center text-xs">
                Change my details
              </Button>
            </div>
          ) : (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium" style={{ color: JUNE }}>
                <Icon name="check" /> Approved. Your files are ready.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {DOWNLOADS.map((d) => (
                  <a
                    key={d.kind}
                    href={exportUrl(kase.id, d.kind)}
                    download
                    className="flex items-center gap-3 rounded-lg border border-hair bg-surface-2 p-3 transition-colors hover:border-hair-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-black" style={{ background: JUNE }}>
                      <Icon name={d.icon} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{d.title}</span>
                      <span className="block truncate text-[11px] text-ink-2">{d.sub}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-hair bg-canvas p-3 text-sm">
            <p className="font-semibold text-ink">Free legal help</p>
            {draft.legal_help.map((h) => (
              <a
                key={h.name}
                href={`tel:${h.phone.replace(/[^0-9]/g, "")}`}
                className="mt-1.5 flex items-center justify-between gap-2 text-ink hover:text-ink"
              >
                <span className="truncate text-xs">{h.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold" style={{ color: JUNE }}>
                  <Icon name="phone" className="h-3.5 w-3.5" /> {h.phone}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg bg-critical/15 p-3 text-sm text-critical">{error}</p>}
    </Panel>
  );
}
