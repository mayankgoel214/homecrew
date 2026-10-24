"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/api";
import {
  PERSONAS,
  browserVoice,
  isAgent,
  namedMentions,
  silentVoice,
  unlockBrowserVoice,
  type AgentId,
  type CrewVoice,
} from "@/lib/crew";
import { useCrewMessages } from "@/hooks/useCrewMessages";
import Character from "@/components/Character";
import Transcript from "@/components/Transcript";

const VOICE_KEY = "homecrew.voice";
const TOOL_MS = 1300; // a statute lookup flashes on Theo's tile; it isn't read aloud

function MicIcon({ live }: { live: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${live ? "text-white" : "text-neutral-500"}`} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      {!live && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}

function Dots() {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="crew-dot h-1.5 w-1.5 rounded-full bg-white" />
      ))}
    </span>
  );
}

function Tile({
  agent,
  speaking,
  thinking,
  tool,
}: {
  agent: AgentId;
  speaking: boolean;
  thinking: string | null;
  tool: string | null;
}) {
  const p = PERSONAS[agent];
  const state = speaking ? "speaking" : thinking ? "working" : "listening";
  return (
    <div
      aria-label={`${p.name}, ${p.role}, ${state}`}
      className={`relative flex flex-col overflow-hidden rounded-xl transition-all duration-300 ${
        speaking ? "scale-[1.03]" : "opacity-85"
      }`}
      style={{
        background: `radial-gradient(120% 90% at 50% 15%, ${p.accent}38, #0a0a0a 72%)`,
        boxShadow: speaking ? `0 0 0 3px ${p.accent}, 0 0 28px ${p.accent}66` : "0 0 0 1px #262626",
      }}
    >
      <div className="relative aspect-[5/6] w-full">
        <div className="absolute inset-x-0 bottom-0 top-2">
          <Character agent={agent} speaking={speaking} />
        </div>
        {(thinking || tool) && !speaking && (
          <div className="absolute inset-x-1.5 top-1.5 flex items-center gap-1.5 rounded-md bg-black/75 px-1.5 py-1 text-[10px] text-neutral-200">
            {tool ? (
              <>
                <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" aria-hidden>
                  <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z" fill={p.accent} />
                </svg>
                <span className="truncate">{tool}</span>
              </>
            ) : (
              <>
                <Dots />
                <span className="truncate">{thinking}</span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 border-t border-white/5 bg-black/60 px-2 py-1.5">
        <MicIcon live={speaking} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-xs font-semibold text-white">{p.name}</p>
          <p className="truncate text-[10px]" style={{ color: p.accent }}>{p.role}</p>
        </div>
      </div>
    </div>
  );
}

export default function CrewCall({ caseId, saved }: { caseId: string | null; saved: ChatMessage[] }) {
  const { messages, connected } = useCrewMessages(caseId, saved);
  // Lines said before you opened the page go straight to the transcript; only new ones are played.
  const historyUpTo = useRef(saved.length ? saved[saved.length - 1].seq : -1);
  const enqueued = useRef(new Set<number>());
  const queue = useRef<ChatMessage[]>([]);
  const playing = useRef(false);
  const voice = useRef<CrewVoice>(silentVoice());
  const voiceOnRef = useRef(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [current, setCurrent] = useState<ChatMessage | null>(null); // caption stays until the next line
  const [speaking, setSpeaking] = useState(false);
  const [tool, setTool] = useState<string | null>(null);
  const [backlog, setBacklog] = useState(0);

  // Who is busy: an agent whose latest message is a status line ("Looking at photo #2…").
  const thinking: Partial<Record<AgentId, string>> = {};
  for (const m of messages) {
    if (isAgent(m.agent)) thinking[m.agent] = m.kind === "status" ? m.text : undefined;
  }

  const pump = useCallback(async () => {
    if (playing.current) return;
    const next = queue.current.shift();
    setBacklog(queue.current.length);
    if (!next) return;
    playing.current = true;
    const hurry = queue.current.length > 3; // catching up on a burst: move faster
    if (next.kind === "tool") {
      setTool(next.text.replace(/^va_code_lookup\("([^"]+)"\).*$/, "Reading § $1"));
      await new Promise((r) => setTimeout(r, hurry ? TOOL_MS / 2 : TOOL_MS));
      setTool(null);
    } else {
      setCurrent(next);
      setSpeaking(true);
      const persona = isAgent(next.agent) ? PERSONAS[next.agent] : null;
      // Voice reads the crew's lines; your own actions and system notes are shown, not read.
      if (persona && voiceOnRef.current && !hurry) await voice.current.speak(next.text, persona);
      else await silentVoice().speak(hurry ? next.text.slice(0, 40) : next.text, PERSONAS.inspector);
      setSpeaking(false);
    }
    playing.current = false;
    pump();
  }, []);

  useEffect(() => {
    let added = false;
    for (const m of messages) {
      if (m.seq <= historyUpTo.current || m.kind === "status" || enqueued.current.has(m.seq)) continue;
      enqueued.current.add(m.seq);
      queue.current.push(m);
      added = true;
    }
    if (added) {
      setBacklog(queue.current.length);
      pump();
    }
  }, [messages, pump]);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(VOICE_KEY) === "on";
    } catch {}
    const v = stored ? browserVoice() : null;
    if (v) {
      voice.current = v;
      voiceOnRef.current = true;
      setVoiceOn(true);
    }
    return () => voice.current.cancel();
  }, []);

  function toggleVoice() {
    voice.current.cancel();
    const on = !voiceOnRef.current;
    const v = on ? browserVoice() : silentVoice();
    if (!v) return alert("This browser can't speak. Captions will keep working.");
    if (on) unlockBrowserVoice();
    voice.current = v;
    voiceOnRef.current = on;
    setVoiceOn(on);
    try {
      localStorage.setItem(VOICE_KEY, on ? "on" : "off");
    } catch {}
  }

  function skip() {
    queue.current = [];
    voice.current.cancel();
    setBacklog(0);
  }

  const speaker = current && isAgent(current.agent) ? PERSONAS[current.agent] : null;
  const label = speaker ? speaker.name : current?.agent === "you" ? "You" : "HomeCrew";
  const color = speaker ? speaker.accent : "#d4d4d4";

  return (
    <section aria-labelledby="crew-heading" className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <h2 id="crew-heading" className="text-sm font-semibold tracking-wide text-neutral-200">
          Your crew
        </h2>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${connected ? "animate-pulse bg-red-500" : "bg-neutral-600"}`} />
            {connected ? "LIVE" : caseId ? "reconnecting" : "ready"}
          </span>
          <button
            onClick={toggleVoice}
            aria-pressed={voiceOn}
            className="rounded-full border border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-200"
          >
            {voiceOn ? "Voice on" : "Voice off"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(PERSONAS) as AgentId[]).map((id) => (
          <Tile
            key={id}
            agent={id}
            speaking={speaking && current?.agent === id}
            thinking={thinking[id] ?? null}
            tool={id === "lawyer" ? tool : null}
          />
        ))}
      </div>

      <div
        aria-live="polite"
        className="mt-3 min-h-[5.5rem] rounded-xl bg-black/70 px-3 py-2.5"
      >
        {current ? (
          <p key={current.seq} className="text-[15px] leading-snug text-neutral-100">
            <span className="mr-2 text-xs font-bold uppercase tracking-wider" style={{ color }}>
              {label}
            </span>
            {namedMentions(current.text)}
          </p>
        ) : (
          <p className="text-sm text-neutral-500">
            {messages.length
              ? "The crew is listening. Take another photo or check the law below."
              : "Take a photo. Rosa will look first, then Theo checks the law and June writes your paperwork."}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between px-1">
        <details className="w-full text-xs text-neutral-400 [&_summary]:cursor-pointer">
          <summary className="select-none">Read the full conversation</summary>
          <div className="mt-2">
            <Transcript messages={messages} />
          </div>
        </details>
        {backlog > 1 && (
          <button onClick={skip} className="shrink-0 text-xs text-neutral-300 underline">
            Skip ahead ({backlog})
          </button>
        )}
      </div>
    </section>
  );
}
