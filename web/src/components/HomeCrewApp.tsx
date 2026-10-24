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
    return (
      <main className="min-h-[100dvh] bg-neutral-950 text-neutral-100">
        <header
          className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-800 bg-neutral-950/90 px-4 py-3 backdrop-blur"
          style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
        >
          <button onClick={() => start({ source, trade, renter })} className="flex items-center gap-1.5 rounded-full bg-[#34c759] px-3 py-1.5 text-xs font-bold text-black">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path d="M15 8.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1.5l5 3.5V5z" fill="currentColor" />
            </svg>
            Call again
          </button>
          <h1 className="text-sm font-bold">Your case file</h1>
          <button onClick={newCase} className="text-xs text-neutral-400 underline-offset-4 hover:underline">New case</button>
        </header>

        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-5 pb-28">
          {kase.frames.length === 0 ? (
            <p className="rounded-2xl border border-neutral-800 p-5 text-sm text-neutral-300">
              No photos in this case yet. Call the crew and show them around.
            </p>
          ) : (
            <>
              <CaseSummary kase={kase} />
              <SafetyPlan kase={kase} />
              {renter && (
                <>
                  <LegalReview kase={kase} findingCount={findings} uploading={false} autoStart={justEnded} onChange={setKase} />
                  {kase.legal && kase.legal.findings.length > 0 && (
                    <AdvocatePanel key={kase.legal.findings.length + kase.ledger.length} kase={kase} onChange={setKase} />
                  )}
                </>
              )}
              <EvidenceLedger kase={kase} onChange={setKase} />
            </>
          )}
          <details className="rounded-2xl border border-neutral-800 p-4 text-sm">
            <summary className="cursor-pointer font-semibold">What the crew said</summary>
            <div className="mt-3">
              <Transcript messages={messages} />
            </div>
          </details>
        </div>

        {playback.current && playback.speaking && (
          <div aria-live="polite" className="fixed inset-x-3 bottom-3 z-20 mx-auto max-w-xl rounded-2xl bg-black/85 px-4 py-3 shadow-2xl ring-1 ring-white/10 backdrop-blur" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: speaker?.accent ?? "#d4d4d4" }}>
              {speaker?.name ?? "HomeCrew"}
            </p>
            <p className="mt-0.5 line-clamp-3 text-sm leading-snug">{namedMentions(playback.current.text)}</p>
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
