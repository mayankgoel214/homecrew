"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { frameImageUrl, runLawyer, type Case, type Issue, type LegalFinding, type Tier } from "@/lib/api";
import { TIER } from "@/lib/safety";
import { TierTag } from "@/components/ui";
import Paperwork from "@/components/report/Paperwork";

const ORDER: Tier[] = ["emergency", "pro", "landlord", "diy"];
const SETTLE = [0.2, 0, 0, 1] as const;

type Row = { issue: Issue; frameId: string; legal?: LegalFinding };

/** Every active finding once, joined with the Lawyer's finding for it, most urgent first. */
function rowsOf(kase: Case): Row[] {
  const legalByKey = new Map<string, LegalFinding>();
  kase.legal?.findings.forEach((f, n) => {
    const ref = kase.legal_refs[n];
    if (ref) legalByKey.set(`${ref.frame_id}:${ref.issue_index}`, f);
  });
  const rows: Row[] = [];
  for (const f of kase.frames) {
    if (f.removed) continue;
    f.issues.forEach((issue, n) => {
      if (!f.dismissed.includes(n)) rows.push({ issue, frameId: f.id, legal: legalByKey.get(`${f.id}:${n}`) });
    });
  }
  return rows.sort((a, b) => ORDER.indexOf(a.issue.safety?.tier ?? "diy") - ORDER.indexOf(b.issue.safety?.tier ?? "diy"));
}

function verdict(rows: Row[], renter: boolean): { big: string; small: string } {
  const n = rows.length;
  const count = (t: Tier) => rows.filter((r) => r.issue.safety?.tier === t).length;
  const landlord = count("landlord") + (renter ? count("pro") : 0);
  if (count("emergency")) return { big: "Get safe first.", small: `${n} problem${n > 1 ? "s" : ""}, one is an emergency.` };
  if (renter && landlord) return { big: `Your landlord must fix ${landlord === n ? (n === 1 ? "it" : "all " + n) : landlord}.`, small: `${n} problem${n > 1 ? "s" : ""} found` };
  if (count("pro")) return { big: `${count("pro")} need${count("pro") > 1 ? "" : "s"} a licensed pro.`, small: `${n} problem${n > 1 ? "s" : ""} found` };
  return { big: "You can fix these yourself.", small: `${n} problem${n > 1 ? "s" : ""} found` };
}

/** Today → 14 → 21 → 30 days, as a line you can read in a glance. */
function DeadlineStrip({ hasRodentHeat }: { hasRodentHeat: boolean }) {
  const day = (d: number) => {
    const t = new Date();
    t.setDate(t.getDate() + d);
    return t.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const stops = [
    { d: 0, label: "Send notice" },
    ...(hasRodentHeat ? [{ d: 14, label: "Repair window" }] : []),
    { d: 21, label: "Must be fixed" },
    { d: 30, label: "Delay presumed" },
  ];
  return (
    <div aria-label="Deadlines" className="rounded-lg border border-hair bg-surface-1 px-4 py-3.5">
      <p className="font-mono text-[10px] text-ink-3">YOUR CLOCK · VA. CODE § 55.1-1234</p>
      <ol className="relative mt-3 flex justify-between">
        <span aria-hidden className="absolute left-2 right-2 top-[5px] h-px bg-hair-strong" />
        {stops.map((s, i) => (
          <li key={s.d} className="relative flex flex-col items-center text-center" style={{ width: `${100 / stops.length}%` }}>
            <span aria-hidden className="h-[11px] w-[11px] rounded-full border-2" style={{ borderColor: i === 0 ? "#E0A83A" : "#7FB7FF", background: i === 0 ? "#E0A83A" : "#0C0B09" }} />
            <span className="mt-1.5 font-mono text-[10px] text-ink">{s.d === 0 ? "TODAY" : `DAY ${s.d}`}</span>
            <span className="font-mono text-[10px] text-ink-3">{day(s.d).toUpperCase()}</span>
            <span className="mt-0.5 text-[11px] leading-tight text-ink-2">{s.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FindingRow({ row, kaseId, open, onToggle, lawPending }: { row: Row; kaseId: string; open: boolean; onToggle: () => void; lawPending: boolean }) {
  const s = row.issue.safety;
  const t = TIER[s?.tier ?? "diy"];
  const reduce = useReducedMotion();
  return (
    <li className="overflow-hidden rounded-lg border border-hair bg-surface-1">
      <button onClick={onToggle} aria-expanded={open} className="tap flex w-full items-center gap-3 p-2.5 text-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={frameImageUrl(kaseId, row.frameId)} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-ink first-letter:uppercase">{row.issue.label}</span>
          <span className="mt-0.5 block font-mono text-[10px] text-ink-3">
            {row.legal ? `§ ${row.legal.statute_section}` : lawPending ? "CHECKING THE LAW…" : "NO LANDLORD DUTY"}
            {row.legal?.is_eviction_defense && <span className="text-brass"> · DEFENSE</span>}
          </span>
        </span>
        {s && <TierTag tier={s.tier} size="sm" />}
        <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { duration: 0.24, ease: SETTLE } }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.18 } }}
          >
            <div className="space-y-3 border-t border-hair px-3 pb-3 pt-3">
              {s && (
                <div>
                  <p className="font-mono text-[10px]" style={{ color: t.color }}>WHAT TO DO</p>
                  <ul className="mt-1 space-y-1">
                    {(s.steps.length ? s.steps : [s.headline]).map((step, i) => (
                      <li key={i} className="flex gap-2 text-[13px] leading-snug text-ink">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: t.color }} aria-hidden />
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {row.legal && (
                <div>
                  <p className="font-mono text-[10px] text-theo">THE LAW · § {row.legal.statute_section}</p>
                  <p className="mt-1 text-[13px] leading-snug text-ink">{row.legal.plain_english}</p>
                  <a href={row.legal.statute_url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-mono text-[10px] text-ink-3 underline-offset-2 hover:text-ink hover:underline">
                    READ § {row.legal.statute_section} ON LAW.LIS.VIRGINIA.GOV ↗
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export default function Report({ kase, renter, autoReview, onChange }: { kase: Case; renter: boolean; autoReview: boolean; onChange: (c: Case) => void }) {
  const rows = rowsOf(kase);
  // The law, the clock and the letter only apply when something is the landlord's job.
  const legal = renter && rows.some((r) => r.issue.safety?.tier !== "diy");
  const [open, setOpen] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const started = useRef(false);
  const reduce = useReducedMotion();

  // Right after a call: Theo's full Gemma review runs on its own.
  useEffect(() => {
    if (!legal || kase.legal || started.current || !autoReview) return;
    started.current = true;
    setReviewing(true);
    runLawyer(kase.id).then(onChange).catch(() => {}).finally(() => setReviewing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReview, legal, kase.legal]);

  if (!rows.length) {
    return <p className="rounded-lg border border-hair bg-surface-1 p-5 text-[15px] text-ink-2">Nothing on record yet. Call the crew and show them around.</p>;
  }

  const v = verdict(rows, renter);
  const counts = ORDER.map((t) => ({ t, n: rows.filter((r) => r.issue.safety?.tier === t).length })).filter((c) => c.n);
  const hasRodentHeat = rows.some((r) => ["pest", "no_heat_indicator", "exposed_wiring"].includes(r.issue.type));

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Verdict" className="rounded-lg border border-hair bg-surface-1 p-4">
        <p className="font-mono text-[11px] text-ink-3">{v.small.toUpperCase()}</p>
        <h2 className="mt-1 font-display text-[30px] font-normal leading-[1.05] tracking-[-0.02em]">{v.big}</h2>
        <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-sm" role="img" aria-label={counts.map((c) => `${c.n} ${TIER[c.t].label}`).join(", ")}>
          {counts.map((c, i) => (
            <motion.span
              key={c.t}
              style={{ width: `${(c.n / rows.length) * 100}%`, background: TIER[c.t].color, transformOrigin: "left" }}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1, transition: { delay: 0.2 + i * 0.08, duration: 0.4, ease: SETTLE } }}
            />
          ))}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {counts.map((c) => (
            <li key={c.t} className="flex items-center gap-1 font-mono text-[10px] text-ink-2">
              <span className="h-1.5 w-1.5 rounded-[1px]" style={{ background: TIER[c.t].color }} aria-hidden />
              {c.n} {TIER[c.t].short.toUpperCase()}
            </li>
          ))}
        </ul>
      </section>

      <ul className="flex flex-col gap-2" aria-label="Problems">
        {rows.map((row, i) => (
          <FindingRow key={i} row={row} kaseId={kase.id} open={open === i} onToggle={() => setOpen(open === i ? null : i)} lawPending={renter && row.issue.safety?.tier !== "diy" && (reviewing || !kase.legal)} />
        ))}
      </ul>

      {legal && <DeadlineStrip hasRodentHeat={hasRodentHeat} />}
      {legal && kase.legal && <Paperwork kase={kase} onChange={onChange} />}
      {legal && !kase.legal && (
        <button
          onClick={() => { started.current = true; setReviewing(true); runLawyer(kase.id).then(onChange).catch(() => {}).finally(() => setReviewing(false)); }}
          disabled={reviewing}
          className="tap rounded-lg border border-hair-strong bg-surface-2 py-3.5 text-[15px] font-medium text-ink disabled:opacity-60"
        >
          {reviewing ? "Theo is checking Virginia law…" : "Check the law and prepare my letter"}
        </button>
      )}
    </div>
  );
}
