"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/api";
import { PERSONAS, isAgent, namedMentions } from "@/lib/crew";

const OTHERS: Record<string, { name: string; color: string }> = {
  you: { name: "You", color: "#F2EDE4" },
  system: { name: "HomeCrew", color: "#8A8275" },
};

function withMentions(text: string) {
  return namedMentions(text)
    .split(/(@\w+)/)
    .map((part, i) => (part.startsWith("@") ? <strong key={i} className="font-semibold text-ink">{part}</strong> : part));
}

/** Every crew message in order: the readable record behind the call (and for screen readers). */
export default function Transcript({ messages }: { messages: ChatMessage[] }) {
  const scrollRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [messages.length]);

  const shown = messages.filter((m) => m.kind !== "status");
  if (!shown.length) return <p className="px-1 text-sm text-ink-3">Nothing said yet.</p>;

  return (
    <ol ref={scrollRef} className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
      {shown.map((m) => {
        const who = isAgent(m.agent)
          ? { name: `${PERSONAS[m.agent].name} · ${PERSONAS[m.agent].role}`, color: PERSONAS[m.agent].accent }
          : OTHERS[m.agent] ?? OTHERS.system;
        return (
          <li key={m.seq} className="text-sm leading-snug">
            <span className="mr-1.5 text-xs font-semibold" style={{ color: who.color }}>
              {who.name}
            </span>
            {m.kind === "tool" ? (
              <code className="break-words font-mono text-[11px] text-theo">{m.text}</code>
            ) : (
              <span className={m.kind === "error" ? "text-critical" : "text-ink"}>{withMentions(m.text)}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
