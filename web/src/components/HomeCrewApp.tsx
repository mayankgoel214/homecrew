"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createCase, endCall, getCase, startCall, type Case } from "@/lib/api";
import { PERSONAS, applyTrade, browserVoice, cartesiaVoice, isAgent, namedMentions, silentVoice, unlockAudio, type TradeId } from "@/lib/crew";
import { useCrewMessages } from "@/hooks/useCrewMessages";
import { useCrewPlayback } from "@/hooks/useCrewPlayback";
import Lobby, { type StartOptions } from "@/components/call/Lobby";
import CaseSummary from "@/components/CaseSummary";
import CallScreen, { type Source } from "@/components/call/CallScreen";
import EvidenceLedger from "@/components/EvidenceLedger";
import LegalReview from "@/components/LegalReview";
import AdvocatePanel from "@/components/AdvocatePanel";
import Transcript from "@/components/Transcript";
import SafetyPlan from "@/components/SafetyPlan";
import CrewBadge from "@/components/CrewBadge";
import { motion } from "motion/react";

type View = "lobby" | "call" | "file";
const CASE_KEY = "homecrew.caseId";
const VOICE_KEY = "homecrew.voice";
const NO_CHAT: Case["chat"] = [];

// Small per-viewer conveniences. Storage can be blocked (private mode), so every access is wrapped.
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
};

export default function HomeCrewApp() {
  const [view, setView] = useState<View>("lobby");
  const [kase, setKase] = useState<Case | null>(null);
  const [source, setSource] = useState<Source>("camera");
  const [starting, setStarting] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [justEnded, setJustEnded] = useState(false);
  const [trade, setTrade] = useState<TradeId>("general");
  const [renter, setRenter] = useState(true);
  const historyUpTo = useRef(Number.MAX_SAFE_INTEGER); // nothing plays until a call starts

  useEffect(() => {
    if (read(VOICE_KEY) === "off") setVoiceOn(false);
    const id = read(CASE_KEY);
    if (id)
      getCase(id)
        .then((c) => {
          applyTrade(c.trade as TradeId);
          setTrade(c.trade as TradeId);
          setRenter(c.renter);
          setKase(c);
        })
        .catch(() => write(CASE_KEY, null));
  }, []);

  const voice = useMemo(() => {
    const fallback = browserVoice() ?? silentVoice();
    return voiceOn ? cartesiaVoice(fallback) : silentVoice();
  }, [voiceOn]);

  const { messages } = useCrewMessages(kase?.id ?? null, kase?.chat ?? NO_CHAT);
  const playback = useCrewPlayback(messages, historyUpTo.current, voice);

  async function start(o: StartOptions) {
    const { source: src, trade: t, renter: rent, problem = "" } = o;
    unlockAudio(); // must happen inside this tap for iPhones to allow sound
    applyTrade(t);
    setTrade(t);
    setRenter(rent);
    setStarting(true);
    try {
      let c = kase;
      if (!c) {
        c = await createCase();
        write(CASE_KEY, c.id);
      }
      historyUpTo.current = c.chat.length ? c.chat[c.chat.length - 1].seq : -1;
      setKase(c);
      setSource(src);
      setStartedAt(Date.now());
      setView("call");
      await startCall(c.id, t, rent, problem); // the expert says hello
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't start the call");
    } finally {
      setStarting(false);
    }
  }

  async function hangUp() {
    if (!kase) return;
    setView("file");
    setJustEnded(true);
    window.scrollTo(0, 0);
    try {
      await endCall(kase.id);
      setKase(await getCase(kase.id));
    } catch {}
  }

  function toggleVoice() {
    playback.skip();
    write(VOICE_KEY, voiceOn ? "off" : "on");
    if (!voiceOn) unlockAudio();
    setVoiceOn(!voiceOn);
  }

  function newCase() {
    if (kase?.frames.length && !confirm("Start a new case? This one stays saved, but this page will forget it.")) return;
    write(CASE_KEY, null);
    setKase(null);
    setJustEnded(false);
    setView("lobby");
  }

  const findings = kase
    ? kase.frames.filter((f) => !f.removed).reduce((n, f) => n + f.issues.length - f.dismissed.length, 0)
    : 0;

  if (view === "call" && kase) {
    return (
      <CallScreen
        kase={kase}
        messages={messages}
        source={source}
        startedAt={startedAt}
        current={playback.current}
        speaking={playback.speaking}
        tool={playback.tool}
        thinking={playback.thinking}
        voiceOn={voiceOn}
        onToggleVoice={toggleVoice}
        onCaseChange={setKase}
        onEnd={hangUp}
      />
    );
  }

  if (view === "file" && kase) {
    const speaker = playback.current && isAgent(playback.current.agent) ? PERSONAS[playback.current.agent] : null;
    const caseNo = kase.id.slice(0, 4).toUpperCase();
    const opened = new Date(kase.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const sections = kase.frames.length === 0
      ? [<p key="empty" className="rounded-lg border border-hair bg-surface-1 p-5 text-sm text-ink-2">No photos in this case yet. Call the crew and show them around.</p>]
      : [
          <CaseSummary key="summary" kase={kase} />,
          <SafetyPlan key="plan" kase={kase} />,
          ...(renter
            ? [
                <LegalReview key="legal" kase={kase} findingCount={findings} uploading={false} autoStart={justEnded} onChange={setKase} />,
                ...(kase.legal && kase.legal.findings.length > 0
                  ? [<AdvocatePanel key="advocate" kase={kase} onChange={setKase} />]
                  : []),
              ]
            : []),
          <EvidenceLedger key="ledger" kase={kase} onChange={setKase} />,
        ];
    return (
      <main className="grain min-h-[100dvh] bg-canvas text-ink">
        <header
          className="sticky top-0 z-10 flex items-center justify-between border-b border-hair bg-canvas/95 px-4 py-2.5"
          style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}
        >
          <button onClick={() => start({ source, trade, renter })} className="tap flex items-center gap-1.5 rounded-md border border-hair-strong bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
              <path d="M15 8.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1.5l5 3.5V5z" fill="currentColor" />
            </svg>
            Call again
          </button>
          <span className="font-mono text-[11px] text-ink-3">HOMECREW</span>
          <button onClick={newCase} className="tap text-xs text-ink-2 underline-offset-4 hover:text-ink hover:underline">New case</button>
        </header>

        <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.2, 0, 0, 1] } }}
            className="relative"
          >
            <p className="font-mono text-[11px] text-ink-3">OPENED {opened.toUpperCase()} · {renter ? "RENTAL" : "OWNER"} · VIRGINIA</p>
            <h1 className="mt-2 font-display text-[44px] font-normal leading-none tracking-[-0.025em]" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144' }}>
              Case file
            </h1>
            <span className="stamp absolute right-0 top-4 rounded-sm border-2 border-brass px-2 py-1 font-mono text-[13px] font-medium text-brass">
              No. {caseNo}
            </span>
            <div className="mt-5 h-px w-full bg-gradient-to-r from-brass/80 via-brass/20 to-transparent" />
          </motion.div>

          <div className="mt-6 flex flex-col gap-4">
            {sections.map((node, i) => (
              <motion.div
                key={(node as React.ReactElement).key ?? i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.12 + i * 0.06, duration: 0.28, ease: [0.2, 0, 0, 1] } }}
              >
                {node}
              </motion.div>
            ))}
            <details className="rounded-lg border border-hair bg-surface-1 p-4 text-sm">
              <summary className="cursor-pointer font-medium text-ink-2">What the crew said</summary>
              <div className="mt-3">
                <Transcript messages={messages} />
              </div>
            </details>
          </div>
        </div>

        {playback.current && playback.speaking && (
          <div aria-live="polite" className="fixed inset-x-3 bottom-3 z-20 mx-auto flex max-w-xl items-center gap-3 rounded-lg border border-hair-strong bg-surface-2 px-3 py-2.5" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
            {speaker && <CrewBadge agent={speaker.id} size={36} state="speaking" />}
            <p className="line-clamp-2 text-[14px] leading-snug text-ink">{namedMentions(playback.current.text)}</p>
          </div>
        )}
      </main>
    );
  }

  return (
    <Lobby
      onStart={start}
      starting={starting}
      openCase={kase && kase.frames.length ? { issues: findings, onOpen: () => setView("file") } : null}
    />
  );
}
