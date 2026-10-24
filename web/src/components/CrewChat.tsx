"use client";

import { useEffect, useRef, useState } from "react";

export type ChatMessage = {
  seq: number;
  agent: "inspector" | "lawyer" | "advocate" | "you" | "system";
  kind: "message" | "tool" | "status" | "error";
  text: string;
  refs: Record<string, string>;
  ts: string;
};

const AGENTS: Record<string, { name: string; initial: string; color: string }> = {
  inspector: { name: "Inspector", initial: "I", color: "bg-amber-400 text-black" },
  lawyer: { name: "Lawyer", initial: "L", color: "bg-sky-400 text-black" },
  advocate: { name: "Advocate", initial: "A", color: "bg-emerald-400 text-black" },
  you: { name: "You", initial: "Y", color: "bg-neutral-200 text-black" },
  system: { name: "HomeCrew", initial: "H", color: "bg-neutral-600 text-white" },
};

// Highlight @mentions so the hand-offs between agents are visible.
function withMentions(text: string) {
  return text.split(/(@(?:Inspector|Lawyer|Advocate|You)\b)/).map((part, i) =>
    part.startsWith("@") ? (
      <strong key={i} className="font-semibold text-white">{part}</strong>
    ) : (
      part
    ),
  );
}

export default function CrewChat({ caseId, saved }: { caseId: string; saved: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    // EventSource reconnects on its own and sends Last-Event-ID, so the server only replays what we missed.
    const source = new EventSource(`/api/cases/${caseId}/stream`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener("chat", (e) => {
      const msg: ChatMessage = JSON.parse((e as MessageEvent).data);
      setMessages((prev) =>
        prev.some((m) => m.seq === msg.seq) ? prev : [...prev, msg].sort((a, b) => a.seq - b.seq),
      );
    });
    return () => source.close();
  }, [caseId]);

  // Fallback: every API response carries the case's full chat, so messages show up after each step
  // even on connections that hold the stream back (some tunnels and proxies do).
  useEffect(() => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.seq));
      const missing = saved.filter((m) => !seen.has(m.seq));
      return missing.length ? [...prev, ...missing].sort((a, b) => a.seq - b.seq) : prev;
    });
  }, [saved]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // A status line ("Looking at photo #2…") is only shown while it's the agent's latest message.
  const visible = messages.filter(
    (m, i) => m.kind !== "status" || !messages.slice(i + 1).some((later) => later.agent === m.agent),
  );

  return (
    <section aria-labelledby="crew-heading" className="rounded-md border border-neutral-700">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <h2 id="crew-heading" className="font-semibold">Your crew</h2>
        <span className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span aria-hidden className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-neutral-600"}`} />
          {connected ? "live" : "reconnecting"}
        </span>
      </div>
      <div ref={scrollRef} role="log" aria-live="polite" aria-label="Crew messages" className="flex max-h-80 flex-col gap-3 overflow-y-auto p-4">
        {visible.length === 0 && (
          <p className="text-sm text-neutral-500">Take a photo and the Inspector, Lawyer and Advocate will talk it through here.</p>
        )}
        {visible.map((m) => {
          const who = AGENTS[m.agent] ?? AGENTS.system;
          const mine = m.agent === "you";
          return (
            <div key={m.seq} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${who.color}`}>
                {who.initial}
              </span>
              <div className={`min-w-0 max-w-[85%] ${mine ? "text-right" : ""}`}>
                <p className="text-xs text-neutral-500">{who.name}</p>
                {m.kind === "tool" ? (
                  <p className="mt-0.5 break-words rounded bg-black/50 px-2 py-1 font-mono text-[11px] text-sky-200">{m.text}</p>
                ) : m.kind === "status" ? (
                  <p className="mt-0.5 animate-pulse text-sm italic text-neutral-400">{m.text}</p>
                ) : (
                  <p
                    className={`mt-0.5 inline-block rounded-lg px-3 py-2 text-left text-sm ${
                      m.kind === "error" ? "bg-red-950 text-red-200" : mine ? "bg-neutral-700 text-white" : "bg-neutral-800 text-neutral-100"
                    }`}
                  >
                    {withMentions(m.text)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
