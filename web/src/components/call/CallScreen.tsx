"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { addFrame, askExpert, getCase, type Case, type ChatMessage, type Issue } from "@/lib/api";
import { PERSONAS, isAgent, namedMentions, type AgentId } from "@/lib/crew";
import { frameFromFile, frameFromVideo, type Frame as Photo } from "@/lib/frame";
import { createDemoStream } from "@/lib/demoFeed";
import { SceneWatch } from "@/lib/sceneWatch";
import { createListener, speechSupported } from "@/lib/listen";
import { TIER, emergencyIn, worstTier, type EmergencyKind } from "@/lib/safety";
import CrewBadge, { type BadgeState } from "@/components/CrewBadge";
import EmergencyCard from "@/components/call/EmergencyCard";

export type Source = "camera" | "demo";

// A finding drawn onto the live feed ("point and tag"), or a small card for a gallery photo.
type Mark = { id: number; issues: Issue[]; number: number; photo: Photo; onFeed: boolean };

const CHECK_EVERY_MS = 600;
const MARK_MS = 4200;
const SETTLE = [0.2, 0, 0, 1] as const;

function useClock(start: number) {
  const [now, setNow] = useState(start);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - start) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// If it's audible, the screen shouldn't repeat all of it: the first sentence or two.
function caption(text: string): string {
  const clean = namedMentions(text).replace(/\s*@\w+\s*$/, "").trim();
  const m = clean.match(/^(.+?[.!?])\s+(.+?[.!?])?/);
  const short = m ? (m[1].length < 60 && m[2] ? `${m[1]} ${m[2]}` : m[1]) : clean;
  return short.length > 140 ? short.slice(0, 137).trimEnd() + "…" : short;
}

/** Where a normalized box from a captured frame lands on an object-cover <video>. */
function onScreen(video: HTMLVideoElement, bbox: [number, number, number, number]) {
  const W = video.clientWidth, H = video.clientHeight;
  const vw = video.videoWidth || W, vh = video.videoHeight || H;
  const scale = Math.max(W / vw, H / vh);
  const dw = vw * scale, dh = vh * scale;
  const ox = (W - dw) / 2, oy = (H - dh) / 2;
  const [x, y, w, h] = bbox;
  return { left: ox + x * dw, top: oy + y * dh, width: w * dw, height: h * dh };
}

const ICONS = {
  speakerOn: <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor" />,
  speakerOff: <path d="M4 9v6h4l5 4V5L8 9H4zm11.6 3 2.2-2.2-1.4-1.4-2.2 2.2-2.2-2.2-1.4 1.4 2.2 2.2-2.2 2.2 1.4 1.4 2.2-2.2 2.2 2.2 1.4-1.4z" fill="currentColor" />,
  photos: <path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 11h14l-4.5-6-3.5 4.5-2.5-3L5 16zm3-6.5A1.5 1.5 0 1 0 8 6.5a1.5 1.5 0 0 0 0 3z" fill="currentColor" />,
  mic: <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1a7 7 0 0 0 6-6.9z" fill="currentColor" />,
  hangUp: <path d="M12 9c-2.9 0-5.7.7-8 2a2 2 0 0 0-1 2l.3 2.2a1 1 0 0 0 1.2.8l3.4-.7a1 1 0 0 0 .8-.9l.2-1.9c2-.6 4.2-.6 6.2 0l.2 1.9a1 1 0 0 0 .8.9l3.4.7a1 1 0 0 0 1.2-.8L21 13a2 2 0 0 0-1-2c-2.3-1.3-5.1-2-8-2z" fill="currentColor" />,
};

function Control({
  label, onClick, children, tone = "plain", size = 52, disabled, pressed,
}: {
  label: string; onClick: () => void; children: React.ReactNode; tone?: "plain" | "on" | "shutter" | "end"; size?: number; disabled?: boolean; pressed?: boolean;
}) {
  const look = {
    plain: "bg-surface-2/90 text-ink border border-hair-strong",
    on: "bg-brass text-brass-ink",
    shutter: "bg-ink text-canvas",
    end: "bg-critical text-[#1A0806]",
  }[tone];
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`tap flex shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${look}`}
      style={{ width: size, height: size }}
    >
      {children}
    </button>
  );
}

export default function CallScreen({
  kase, messages, source, startedAt, current, speaking, tool, thinking, voiceOn, onToggleVoice, onCaseChange, onEnd,
}: {
  kase: Case;
  messages: ChatMessage[];
  source: Source;
  startedAt: number;
  current: ChatMessage | null;
  speaking: boolean;
  tool: string | null;
  thinking: Partial<Record<AgentId, string>>;
  voiceOn: boolean;
  onToggleVoice: () => void;
  onCaseChange: (c: Case) => void;
  onEnd: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const watch = useRef<SceneWatch | null>(null);
  const sending = useRef(false);
  const listener = useRef<ReturnType<typeof createListener> | null>(null);
  const seenEmergency = useRef(messages.reduce((m, x) => Math.max(m, x.seq), -1));
  const reduce = useReducedMotion();
  const [looking, setLooking] = useState(false);
  const [mark, setMark] = useState<Mark | null>(null);
  const [problem, setProblem] = useState("");
  const [emergency, setEmergency] = useState<EmergencyKind | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [talking, setTalking] = useState(false);
  const [heard, setHeard] = useState("");
  const clock = useClock(startedAt);

  const kept = kase.frames.filter((f) => !f.removed);
  const findings = kept.flatMap((f) => f.issues.filter((_, n) => !f.dismissed.includes(n)));
  const caseNo = kase.id.slice(0, 4).toUpperCase();

  // Camera (or demo feed) for as long as the call is up.
  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    (async () => {
      try {
        let stream: MediaStream;
        if (source === "demo") {
          const demo = await createDemoStream();
          stream = demo.stream;
          stop = demo.stop;
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          });
          stop = () => stream.getTracks().forEach((t) => t.stop());
        }
        if (cancelled) return stop();
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        watch.current = new SceneWatch();
      } catch (e) {
        const denied = e instanceof DOMException && e.name === "NotAllowedError";
        setProblem(
          denied ? "Camera permission was denied. Allow it in settings, or send a photo from your gallery."
            : !window.isSecureContext ? "The camera needs a secure (https) link."
              : "Couldn't start the camera. You can still send photos from your gallery.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [source]);

  // Active danger flagged by the crew (from what it saw or a question): the card goes up.
  useEffect(() => {
    for (const m of messages) {
      if (m.kind === "emergency" && m.seq > seenEmergency.current) {
        seenEmergency.current = m.seq;
        setEmergency((m.refs.emergency as EmergencyKind) ?? "fire");
      }
    }
  }, [messages]);

  /** live: sent automatically by the scene watcher. onFeed: the picture came from the camera, so
   *  the finding can be drawn where it is on screen (not true for gallery photos). */
  async function send(photo: Photo, live: boolean, onFeed: boolean) {
    sending.current = true;
    setLooking(true);
    try {
      const result = await addFrame(kase.id, photo.blob, photo.sha256, live);
      if (result.issues.length) setMark({ id: Date.now(), issues: result.issues, number: findings.length + 1, photo, onFeed });
      if (result.kept) onCaseChange(await getCase(kase.id));
      setProblem("");
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (!live || message.startsWith("Slow down")) setProblem(message || "Couldn't send that photo.");
    } finally {
      sending.current = false;
      setLooking(false);
    }
  }

  // Capture on its own when you hold steady on something new.
  useEffect(() => {
    const t = setInterval(async () => {
      const video = videoRef.current;
      if (!video || !watch.current || sending.current) return;
      if (watch.current.check(video)) {
        watch.current.markSent(video);
        send(await frameFromVideo(video), true, true);
      }
    }, CHECK_EVERY_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kase.id]);

  useEffect(() => {
    if (!mark) return;
    const t = setTimeout(() => setMark(null), MARK_MS);
    return () => clearTimeout(t);
  }, [mark]);

  async function ask(text: string) {
    setHeard(text);
    const kind = emergencyIn(text);
    if (kind) setEmergency(kind); // instant: no waiting on the server or the model
    try {
      await askExpert(kase.id, text);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Couldn't send your question.");
    }
    setTimeout(() => setHeard(""), 3500);
  }

  function toggleMic() {
    if (!speechSupported()) {
      const typed = window.prompt(`Ask ${PERSONAS.inspector.name} a question:`);
      if (typed?.trim()) ask(typed.trim());
      return;
    }
    listener.current ??= createListener(ask, (msg) => { setProblem(msg); setMicOn(false); }, setTalking);
    if (micOn) listener.current.pause();
    else listener.current.resume();
    setMicOn(!micOn);
  }

  // Don't transcribe the crew's own voices: stop listening while anyone on the crew is talking.
  useEffect(() => {
    if (!micOn || !listener.current) return;
    if (speaking) listener.current.pause();
    else listener.current.resume();
  }, [speaking, micOn]);

  useEffect(() => () => listener.current?.pause(), []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && !sending.current) send(await frameFromFile(file), false, false);
  }

  const speaker = current && isAgent(current.agent) ? PERSONAS[current.agent] : null;
  const stateOf = (id: AgentId): BadgeState =>
    speaking && current?.agent === id ? "speaking"
      : (id === "inspector" && looking) || thinking[id] || (id === "lawyer" && tool) ? "thinking" : "idle";
  const crew: AgentId[] = kase.renter ? ["inspector", "lawyer", "advocate"] : ["inspector", "advocate"];
  const bottom = (px: number) => `calc(max(16px, env(safe-area-inset-bottom)) + ${px}px)`;
  const worstOfMark = mark ? worstTier(mark.issues.map((i) => i.safety?.tier)) : null;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-canvas text-ink" style={{ height: "100dvh" }}>
      <video ref={videoRef} playsInline muted aria-label="Your camera" className="absolute inset-0 h-full w-full object-cover" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#0C0B09]/80 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[300px] bg-gradient-to-t from-[#0C0B09] via-[#0C0B09]/75 to-transparent" />

      {/* point-and-tag: the finding drawn where it is on the live feed */}
      <AnimatePresence>
        {mark?.onFeed && videoRef.current && mark.issues.filter((i) => i.bbox).slice(0, 2).map((issue, n) => {
          const v = videoRef.current!;
          const raw = onScreen(v, issue.bbox!);
          // Keep the box (and its tag) on screen even when the finding spans past the edges.
          const left = Math.max(8, raw.left), top = Math.max(64, raw.top);
          const r = {
            left, top,
            width: Math.max(40, Math.min(raw.left + raw.width, v.clientWidth - 8) - left),
            height: Math.max(40, Math.min(raw.top + raw.height, v.clientHeight - 260) - top),
          };
          const t = TIER[issue.safety?.tier ?? "diy"];
          return (
            <motion.div
              key={`${mark.id}-${n}`}
              className="pointer-events-none absolute"
              style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.28 } }}
            >
              <svg className="reticle absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                <rect x="0" y="0" width="100%" height="100%" rx="6" fill="none" stroke={t.color} strokeWidth="2" pathLength="1" />
              </svg>
              <span
                className="stamp absolute -top-7 left-0 max-w-[calc(100vw-24px)] truncate whitespace-nowrap rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-medium"
                style={{ background: t.color, color: t.ink, transformOrigin: "left bottom" }}
              >
                #{String(mark.number + n).padStart(2, "0")} · {issue.label.toUpperCase()} · {t.short.toUpperCase()}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* top bar: evidence-style header */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4" style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}>
        <div className="font-mono text-[11px] leading-tight">
          <p className="flex items-center gap-1.5 text-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-critical" aria-hidden />
            CASE {caseNo} · {clock}
          </p>
          <p className="mt-0.5 text-ink-2">{source === "demo" ? "DEMO FEED" : PERSONAS.inspector.role.toUpperCase()}</p>
        </div>
        <div className="flex flex-col items-end gap-1 font-mono text-[11px]">
          <span className="text-ink">{findings.length} FOUND</span>
          <span className="flex gap-1" aria-hidden>
            {findings.slice(-8).map((f, i) => (
              <span key={i} className="h-1.5 w-3 rounded-[1px]" style={{ background: TIER[f.safety?.tier ?? "diy"].color }} />
            ))}
          </span>
        </div>
      </div>

      {/* gallery photo: small evidence card, since there's nothing on the feed to draw on */}
      <AnimatePresence>
        {mark && !mark.onFeed && (
          <motion.figure
            key={mark.id}
            className="absolute right-4 w-28 overflow-hidden rounded-md border border-hair-strong bg-surface-1"
            style={{ top: "calc(max(14px, env(safe-area-inset-top)) + 44px)" }}
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: SETTLE } }}
            exit={{ opacity: 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mark.photo.url} alt={mark.issues.map((i) => i.label).join(", ")} className="aspect-[4/3] w-full object-cover" />
            <figcaption className="px-2 py-1 font-mono text-[10px] text-ink-2">
              {worstOfMark ? TIER[worstOfMark].short.toUpperCase() : "NOTED"}
            </figcaption>
          </motion.figure>
        )}
      </AnimatePresence>

      {looking && (
        <div role="status" className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2">
          <svg viewBox="0 0 120 120" className="h-28 w-28" aria-hidden>
            {["M10 34V10h24", "M86 10h24v24", "M110 86v24H86", "M34 110H10V86"].map((d) => (
              <path key={d} d={d} fill="none" stroke="#E0A83A" strokeWidth="2" strokeLinecap="round" className="arc-draw" />
            ))}
          </svg>
          <span className="sr-only">{PERSONAS.inspector.name} is looking</span>
        </div>
      )}

      {/* what you said */}
      <AnimatePresence>
        {heard && (
          <motion.p
            className="absolute right-4 max-w-[72%] rounded-lg rounded-br-sm bg-ink px-3 py-2 text-[15px] text-canvas"
            style={{ bottom: bottom(250) }}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: SETTLE } }}
            exit={{ opacity: 0 }}
          >
            {heard}
          </motion.p>
        )}
      </AnimatePresence>

      {/* the crew, then what's being said: one column so they never collide */}
      <div className="absolute inset-x-4 flex flex-col gap-2.5" style={{ bottom: bottom(80) }}>
        <div className="flex items-end gap-2">
          {crew.map((id) => <CrewBadge key={id} agent={id} size={50} state={stateOf(id)} label />)}
        </div>
        {/* Theo's citation, on screen while he says the short version */}
        <AnimatePresence>
          {current?.agent === "lawyer" && current.refs.section && (
            <motion.div
              key={`law-${current.seq}`}
              className="rounded-md border border-theo/40 bg-[#0C0B09]/90 px-3 py-2"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: SETTLE } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              <p className="font-mono text-[11px] font-medium text-theo">VA. CODE § {current.refs.section}{current.refs.title ? ` · ${current.refs.title.toUpperCase()}` : ""}</p>
              {current.refs.rule && <p className="mt-0.5 text-[13px] leading-snug text-ink">{current.refs.rule}</p>}
            </motion.div>
          )}
        </AnimatePresence>
        <div aria-live="polite" className="min-h-[52px]">
          <AnimatePresence mode="wait" initial={false}>
            {problem ? (
              <motion.p key="problem" role="alert" className="rounded-md bg-critical px-3.5 py-2.5 text-[15px] font-medium text-[#1A0806]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {problem}
              </motion.p>
            ) : current ? (
              <motion.div
                key={current.seq}
                className="rounded-md bg-surface-1/90 px-3.5 py-2.5"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: SETTLE } }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              >
                <p className="line-clamp-2 text-[17px] leading-snug text-ink">
                  <span className="mr-2 inline-block rounded-sm px-1.5 py-0.5 align-[2px] font-mono text-[10px] font-medium"
                    style={{ background: speaker?.accent ?? "#B8B0A2", color: "#0C0B09" }}>
                    {speaker ? speaker.name.toUpperCase() : current.agent === "you" ? "YOU" : "HOMECREW"}
                  </span>
                  {caption(current.text)}
                </p>
              </motion.div>
            ) : (
              <motion.p key="hint" className="rounded-md bg-surface-1/80 px-3.5 py-2.5 text-[15px] text-ink-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                Point at anything that worries you and hold still.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* controls, in thumb reach */}
      <div className="absolute inset-x-0 flex items-center justify-center gap-3" style={{ bottom: bottom(0) }}>
        <Control label={voiceOn ? "Mute the crew" : "Unmute the crew"} onClick={onToggleVoice} pressed={voiceOn}>
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden>{voiceOn ? ICONS.speakerOn : ICONS.speakerOff}</svg>
        </Control>
        <Control label={micOn ? "Stop listening" : `Ask ${PERSONAS.inspector.name} out loud`} onClick={toggleMic} pressed={micOn} tone={micOn ? "on" : "plain"}>
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden>{ICONS.mic}</svg>
        </Control>
        <Control
          label="Capture this now"
          tone="shutter"
          size={66}
          disabled={looking}
          onClick={async () => {
            const video = videoRef.current;
            if (!video?.videoWidth || sending.current) return;
            watch.current?.markSent(video);
            send(await frameFromVideo(video), false, true);
          }}
        >
          <span className="h-[52px] w-[52px] rounded-full border-2 border-canvas/70" aria-hidden />
        </Control>
        <Control label="Send a photo from your gallery" onClick={() => fileRef.current?.click()}>
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden>{ICONS.photos}</svg>
        </Control>
        <Control label="End call" tone="end" onClick={onEnd}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>{ICONS.hangUp}</svg>
        </Control>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" aria-label="Choose a photo" />
      </div>

      {/* you're talking: the screen edge glows (Siri pattern), leaving the feed clear */}
      {micOn && (
        <div aria-hidden className="edge-glow" style={{ ["--level" as string]: talking && !speaking ? 0.85 : 0.15, opacity: speaking ? 0 : 1 }} />
      )}
      {micOn && !speaking && (
        <p className="absolute left-1/2 -translate-x-1/2 font-mono text-[10px] text-ink-2" style={{ bottom: bottom(72) }}>
          {talking ? "LISTENING…" : "ASK ANYTHING"}
        </p>
      )}

      {emergency && <EmergencyCard kind={emergency} onDismiss={() => setEmergency(null)} />}
    </div>
  );
}
