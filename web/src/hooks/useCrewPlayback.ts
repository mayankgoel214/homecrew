"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/api";
import { PERSONAS, isAgent, silentVoice, type AgentId, type CrewVoice } from "@/lib/crew";

const TOOL_MS = 1300; // a statute lookup flashes on Theo's tile; it isn't read aloud

/** Plays crew messages one at a time, like people taking turns on a call.
 *  Lines said before `historyUpTo` are history: shown in the transcript, never replayed. */
export function useCrewPlayback(messages: ChatMessage[], historyUpTo: number, voice: CrewVoice) {
  const enqueued = useRef(new Set<number>());
  const queue = useRef<ChatMessage[]>([]);
  const playing = useRef(false);
  const voiceRef = useRef(voice);
  const [current, setCurrent] = useState<ChatMessage | null>(null); // caption stays until the next line
  const [speaking, setSpeaking] = useState(false);
  const [tool, setTool] = useState<string | null>(null);
  const [backlog, setBacklog] = useState(0);

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

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
    const hurry = queue.current.length > 4; // catching up on a burst: move faster
    if (next.kind === "tool") {
      setTool(next.text.replace(/^va_code_lookup\("([^"]+)"\).*$/, "Reading § $1"));
      await new Promise((r) => setTimeout(r, hurry ? TOOL_MS / 2 : TOOL_MS));
      setTool(null);
    } else {
      setCurrent(next);
      setSpeaking(true);
      const persona = isAgent(next.agent) ? PERSONAS[next.agent] : null;
      // The crew's lines are spoken; your own actions and system notes are only shown.
      if (persona && !hurry) await voiceRef.current.speak(next.text, persona);
      else await silentVoice().speak(hurry ? next.text.slice(0, 40) : next.text, PERSONAS.inspector);
      setSpeaking(false);
    }
    playing.current = false;
    pump();
  }, []);

  useEffect(() => {
    let added = false;
    for (const m of messages) {
      if (m.seq <= historyUpTo || m.kind === "status" || enqueued.current.has(m.seq)) continue;
      enqueued.current.add(m.seq);
      queue.current.push(m);
      if (m.kind === "message" && isAgent(m.agent)) voiceRef.current.prepare?.(m.text, PERSONAS[m.agent]);
      added = true;
    }
    if (added) {
      setBacklog(queue.current.length);
      pump();
    }
  }, [messages, historyUpTo, pump]);

  const skip = useCallback(() => {
    queue.current = [];
    voiceRef.current.cancel();
    setBacklog(0);
  }, []);

  return { current, speaking, tool, thinking, backlog, skip };
}
