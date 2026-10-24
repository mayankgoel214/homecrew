"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Character from "@/components/Character";
import { PERSONAS, type AgentId, type TradeId } from "@/lib/crew";
import { routeProblem } from "@/lib/api";
import { emergencyIn, type EmergencyKind } from "@/lib/safety";
import EmergencyCard from "@/components/call/EmergencyCard";

export type StartOptions = { source: "camera" | "demo"; trade: TradeId; renter: boolean; problem?: string };

const PROMPTS = ["My sink won't drain", "There's no heat in the bedroom", "Black spots on the bathroom ceiling", "The outlet sparks when I plug in"];
const SPRING = { type: "spring" as const, stiffness: 260, damping: 24 };

/** One crew member on the stage: pops up, then idles (breathes, blinks). Tap to hear their pitch. */
function Member({ id, size, delay, x, z, onPick, picked }: {
  id: AgentId; size: number; delay: number; x: number; z: number; onPick: () => void; picked: boolean;
}) {
  const p = PERSONAS[id];
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onPick}
      aria-label={`${p.name}, ${p.role}`}
      className="pointer-events-none absolute bottom-0 flex flex-col items-center rounded-lg focus-visible:outline-2 focus-visible:outline-brass"
      style={{ left: `calc(50% + ${x}px)`, width: size, marginLeft: -size / 2, zIndex: z }}
      initial={reduce ? false : { y: 60, opacity: 0 }}
      animate={{ y: picked ? -6 : 0, opacity: 1, transition: { ...SPRING, delay } }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
    >
      {/* a soft backlight in their own color separates them from the dark stage */}
      <div aria-hidden className="absolute left-1/2 top-[8%] -translate-x-1/2 rounded-full"
        style={{ width: size * 0.95, height: size * 0.95, background: `radial-gradient(circle, ${p.accent}55 0%, ${p.accent}18 45%, transparent 70%)` }} />
      {/* only the middle of each character takes taps, so overlapping neighbours don't steal them */}
      <span aria-hidden className="pointer-events-auto absolute inset-y-0 left-[24%] right-[24%] z-10" />
      <div className="breathe relative w-full" style={{ animationDelay: `${delay * 2}s` }}>
        <Character agent={id} speaking={picked} trade={id === "inspector" ? "general" : undefined} />
      </div>
    </motion.button>
  );
}

export default function Lobby({
  onStart,
  openCase,
  starting,
}: {
  onStart: (o: StartOptions) => void;
  openCase: { issues: number; onOpen: () => void } | null;
  starting: boolean;
}) {
  const [renter, setRenter] = useState(true);
  const [describing, setDescribing] = useState(false);
  const [problem, setProblem] = useState("");
  const [routing, setRouting] = useState(false);
  const [emergency, setEmergency] = useState<EmergencyKind | null>(null);
  const [picked, setPicked] = useState<AgentId | null>(null);
  const [hint, setHint] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  const busy = starting || routing;

  // The placeholder cycles through real examples instead of a wall of chips.
  useEffect(() => {
    if (!describing || problem) return;
    const t = setInterval(() => setHint((h) => (h + 1) % PROMPTS.length), 2600);
    return () => clearInterval(t);
  }, [describing, problem]);

  useEffect(() => {
    if (describing) setTimeout(() => input.current?.focus(), 250);
  }, [describing]);

  async function describe(e: React.FormEvent) {
    e.preventDefault();
    const text = problem.trim();
    if (!text) return;
    const local = emergencyIn(text);
    if (local) return setEmergency(local);
    setRouting(true);
    try {
      const r = await routeProblem(text);
      if (r.emergency) return setEmergency(r.emergency as EmergencyKind);
      onStart({ source: "camera", trade: r.trade as TradeId, renter, problem: text });
    } catch {
      onStart({ source: "camera", trade: "general", renter, problem: text });
    } finally {
      setRouting(false);
    }
  }

  const blurb: Record<AgentId, string> = {
    inspector: "I spot what's broken.",
    lawyer: renter ? "I know what your landlord owes you." : "I'll tell you when it's a pro's job.",
    advocate: renter ? "I write the letter for you." : "I put together your repair plan.",
  };

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-canvas">
      {/* the stage: a warm spotlight from above */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[62%]"
        style={{ background: "radial-gradient(70% 60% at 50% 18%, rgba(224,168,58,0.22), rgba(224,168,58,0.06) 45%, transparent 75%)" }} />

      <header className="relative z-10 flex items-center justify-between px-5" style={{ paddingTop: "max(18px, env(safe-area-inset-top))" }}>
        <span className="font-display text-[19px] font-medium tracking-[-0.01em]">HomeCrew</span>
        <button
          onClick={() => setRenter(!renter)}
          className="tap rounded-sm px-1 font-mono text-[11px] text-ink-2 hover:text-ink"
          aria-label={`You ${renter ? "rent" : "own"}. Tap to change.`}
        >
          {renter ? "I RENT" : "I OWN"} <span className="text-ink-3">· CHANGE</span>
        </button>
      </header>

      {/* the crew */}
      <section aria-label="Your crew" className="relative mt-2 h-[310px] shrink-0">
        <div aria-hidden className="absolute inset-x-6 bottom-0 h-16 rounded-[50%] bg-black/50 blur-2xl" />
        <Member id="lawyer" size={172} delay={0.12} x={-104} z={1} picked={picked === "lawyer"} onPick={() => setPicked(picked === "lawyer" ? null : "lawyer")} />
        <Member id="advocate" size={172} delay={0.2} x={104} z={1} picked={picked === "advocate"} onPick={() => setPicked(picked === "advocate" ? null : "advocate")} />
        <Member id="inspector" size={214} delay={0.04} x={0} z={2} picked={picked === "inspector"} onPick={() => setPicked(picked === "inspector" ? null : "inspector")} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-canvas to-transparent" style={{ zIndex: 3 }} />
        <AnimatePresence>
          {picked && (
            <motion.p
              key={picked}
              className="absolute left-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-hair-strong bg-surface-2 px-3 py-1.5 text-[13px] text-ink"
              initial={reduce ? false : { opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.18 } }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              <span className="font-mono text-[11px]" style={{ color: PERSONAS[picked].accent }}>{PERSONAS[picked].name.toUpperCase()} </span>
              {blurb[picked]}
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      <div className="relative z-10 mt-3 flex justify-center gap-6 font-mono text-[10px] text-ink-3" aria-hidden>
        {(["lawyer", "inspector", "advocate"] as AgentId[]).map((id) => (
          <span key={id}><span style={{ color: PERSONAS[id].accent }}>{PERSONAS[id].name.toUpperCase()}</span> · {PERSONAS[id].role.toUpperCase()}</span>
        ))}
      </div>

      <motion.div
        className="relative z-10 mt-6 px-5"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.28, ease: [0.2, 0, 0, 1] } }}
      >
        <h1 className="font-display text-[40px] font-normal leading-[1] tracking-[-0.025em]" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144' }}>
          Your home&apos;s crew,
          <br />
          <span className="italic text-brass">on call.</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Show them what&apos;s wrong. They tell you what&apos;s safe{renter ? ", what the law says, and write the letter." : " and when to call a pro."}
        </p>
      </motion.div>

      <motion.div
        className="relative z-10 mt-auto px-5 pt-6"
        style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.45, duration: 0.32, ease: [0.2, 0, 0, 1] } }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {!describing ? (
            <motion.div key="call" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
              <button
                onClick={() => onStart({ source: "camera", trade: "general", renter })}
                disabled={busy}
                className="tap group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-lg bg-brass py-4 text-[16px] font-semibold text-brass-ink disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path d="M15 8.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1.5l5 3.5V5z" fill="currentColor" />
                </svg>
                {starting ? "Connecting…" : "Start a video call"}
              </button>
              <button onClick={() => setDescribing(true)} className="tap mt-2 w-full rounded-lg border border-hair-strong py-3.5 text-[15px] font-medium text-ink hover:bg-surface-1">
                Describe a problem instead
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="describe"
              onSubmit={describe}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.2, 0, 0, 1] } }}
            >
              <label htmlFor="problem" className="font-mono text-[11px] text-ink-3">WHAT&apos;S GOING ON?</label>
              <div className="relative mt-2">
                <input
                  ref={input}
                  id="problem"
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  autoComplete="off"
                  enterKeyHint="go"
                  className="w-full rounded-lg border border-hair-strong bg-surface-1 px-4 py-4 text-[16px] text-ink focus:border-brass focus:outline-none"
                />
                {!problem && (
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={hint}
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[16px] text-ink-3"
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.22 } }}
                      exit={{ opacity: 0, y: -6, transition: { duration: 0.16 } }}
                    >
                      {PROMPTS[hint]}…
                    </motion.span>
                  </AnimatePresence>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setDescribing(false)} className="tap rounded-lg border border-hair-strong px-4 py-3.5 text-[15px] text-ink-2">
                  Back
                </button>
                <button type="submit" disabled={busy || !problem.trim()} className="tap flex-1 rounded-lg bg-brass py-3.5 text-[15px] font-semibold text-brass-ink disabled:opacity-40">
                  {routing ? "Finding the right expert…" : "Call the right expert"}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="mt-4 flex items-center justify-between font-mono text-[10px] text-ink-3">
          <button onClick={() => onStart({ source: "demo", trade: "general", renter })} disabled={busy} className="tap underline-offset-4 hover:text-ink hover:underline">
            TRY THE DEMO FEED
          </button>
          {openCase ? (
            <button onClick={openCase.onOpen} className="tap text-brass underline-offset-4 hover:underline">
              YOUR CASE FILE · {openCase.issues}
            </button>
          ) : (
            <span>FREE · VIRGINIA · NOT LEGAL ADVICE</span>
          )}
        </div>
      </motion.div>

      {emergency && <EmergencyCard kind={emergency} onDismiss={() => setEmergency(null)} />}
    </main>
  );
}
