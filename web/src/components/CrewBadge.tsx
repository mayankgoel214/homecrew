"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import Character from "@/components/Character";
import { PERSONAS, type AgentId, type TradeId } from "@/lib/crew";
import { outputLevel } from "@/lib/level";

export type BadgeState = "idle" | "thinking" | "speaking";

/** A crew member as a round badge in their own hue.
 *  idle: breathes. thinking: an arc draws around the rim. speaking: grows (spring) and the rim
 *  becomes a level meter driven by the real voice output. Only one badge speaks at a time. */
export default function CrewBadge({
  agent,
  size = 56,
  state = "idle",
  trade,
  label = false,
}: {
  agent: AgentId;
  size?: number;
  state?: BadgeState;
  trade?: TradeId;
  label?: boolean;
}) {
  const p = PERSONAS[agent];
  const rim = useRef<SVGCircleElement>(null);
  const reduce = useReducedMotion();
  const speaking = state === "speaking";

  // Drive the rim from the voice level without re-rendering React 60 times a second.
  useEffect(() => {
    if (!speaking || !rim.current) return;
    let raf = 0;
    let smooth = 0;
    const tick = () => {
      smooth = smooth * 0.7 + outputLevel() * 0.3; // smoothed so it never twitches
      rim.current?.style.setProperty("stroke-width", String(2 + smooth * 5));
      rim.current?.style.setProperty("opacity", String(0.55 + smooth * 0.45));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  const scale = speaking ? 72 / 56 : 1;

  return (
    <motion.div
      className="relative flex shrink-0 flex-col items-center"
      animate={{ scale, opacity: state === "idle" && !label ? 0.92 : 1 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 26 }}
      style={{ width: size, transformOrigin: "bottom center" }}
      aria-label={`${p.name}, ${p.role}${speaking ? ", speaking" : state === "thinking" ? ", working" : ""}`}
    >
      <div className={`relative ${state === "idle" ? "breathe" : ""}`} style={{ width: size, height: size }}>
        <div
          className="absolute inset-[3px] overflow-hidden rounded-full"
          style={{ background: `radial-gradient(circle at 50% 28%, ${p.accent}55, #15130f 72%)` }}
        >
          <div className="h-full w-full translate-y-[6%] scale-[1.28]">
            <Character agent={agent} speaking={speaking} trade={trade} />
          </div>
        </div>
        <svg viewBox="0 0 60 60" className="pointer-events-none absolute inset-0 h-full w-full -rotate-90" aria-hidden>
          <circle cx="30" cy="30" r="28" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
          {state === "thinking" && (
            <circle cx="30" cy="30" r="28" fill="none" stroke={p.accent} strokeWidth="2" strokeLinecap="round" className="arc-draw" />
          )}
          {speaking && <circle ref={rim} cx="30" cy="30" r="27" fill="none" stroke={p.accent} strokeWidth="3" />}
        </svg>
      </div>
      {label && (
        <span className="mt-1 font-mono text-[10px] leading-none" style={{ color: speaking ? p.accent : "#b8b0a2" }}>
          {p.name}
        </span>
      )}
    </motion.div>
  );
}
