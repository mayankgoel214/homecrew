"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/api";
import { PERSONAS, isAgent, silentVoice, type AgentId, type CrewVoice } from "@/lib/crew";

const TOOL_MS = 1300; // a statute lookup flashes on Theo's badge; it isn't read aloud

/** Plays crew messages one at a time, like people taking turns on a call.
 *  Lines said before `historyUpTo` are history: shown in the transcript, never replayed. */
export function useCrewPlayback(caseId: string | null, messages: ChatMessage[], historyUpTo: number, voice: CrewVoice, active = true) {
  const enqueued = useRef(new Set<number>());
  const queue = useRef<ChatMessage[]>([]);
  const playing = useRef(false);
  const voiceRef = useRef(voice);
  const [current, setCurrent] = useState<ChatMessage | null>(null); // caption stays until the next line
  const [speaking, setSpeaking] = useState(false);
  const [tool, setTool] = useState<string | null>(null);

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

  // A new case numbers its lines from 0 again: forget what the last case played.
  useEffect(() => {
    enqueued.current.clear();
    queue.current = [];
  }, [caseId]);

  useEffect(() => {
    let added = false;
    for (const m of messages) {
      if (m.seq <= historyUpTo || m.kind === "status" || enqueued.current.has(m.seq)) continue;
      enqueued.current.add(m.seq);
      if (!active) continue; // off the call: lines go to the transcript only, nobody speaks
      queue.current.push(m);
      if (m.kind === "message" && isAgent(m.agent)) voiceRef.current.prepare?.(m.text, PERSONAS[m.agent]);
      added = true;
    }
    if (added) pump();
  }, [messages, historyUpTo, pump, active]);

  // Leaving the call cuts everyone off at once.
  useEffect(() => {
    if (active) return;
    queue.current = [];
    voiceRef.current.cancel();
    setSpeaking(false);
    setCurrent(null);
  }, [active]);

  const skip = useCallback(() => {
    queue.current = [];
    voiceRef.current.cancel();
  }, []);

  return { current, speaking, tool, thinking, skip };
}
