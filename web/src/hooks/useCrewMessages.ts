"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/api";

/** The crew chat for a case: streamed live over SSE, plus whatever the latest API response
 *  carried (a fallback for connections that hold the stream back). Ordered and de-duplicated. */
export function useCrewMessages(caseId: string | null, saved: ChatMessage[]) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const merge = (incoming: ChatMessage[]) =>
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.seq));
      const fresh = incoming.filter((m) => !seen.has(m.seq));
      return fresh.length ? [...prev, ...fresh].sort((a, b) => a.seq - b.seq) : prev;
    });

  useEffect(() => {
    setMessages([]);
    if (!caseId) return; // no case until the first photo
    // EventSource reconnects on its own and sends Last-Event-ID, so the server only replays what we missed.
    const source = new EventSource(`/api/cases/${caseId}/stream`);
    source.addEventListener("chat", (e) => merge([JSON.parse((e as MessageEvent).data)]));
    return () => source.close();
  }, [caseId]);

  useEffect(() => merge(saved), [saved]);

  return { messages };
}
