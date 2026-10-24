"use client";

import { useEffect, useRef, useState } from "react";
import { addFrame, askExpert, getCase, type Case, type ChatMessage, type Issue } from "@/lib/api";
import { PERSONAS, isAgent, namedMentions, type AgentId } from "@/lib/crew";
import { frameFromFile, frameFromVideo, type Frame as Photo } from "@/lib/frame";
import { createDemoStream } from "@/lib/demoFeed";
import { SceneWatch } from "@/lib/sceneWatch";
import Character from "@/components/Character";
import EmergencyCard from "@/components/call/EmergencyCard";
import { createListener, speechSupported } from "@/lib/listen";
import { TIER, emergencyIn, worstTier, type EmergencyKind } from "@/lib/safety";

export type Source = "camera" | "demo";
type Snapshot = { photo: Photo; issues: Issue[]; id: number };

const SEVERITY = ["", "#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"];
const CHECK_EVERY_MS = 600;
const SNAPSHOT_MS = 6500;

function useClock(start: number) {
  const [now, setNow] = useState(start);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - start) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function CrewTile({ agent, speaking, busy, tool }: { agent: AgentId; speaking: boolean; busy?: string; tool?: string | null }) {
  const p = PERSONAS[agent];
  return (
    <div
      aria-label={`${p.name}, ${p.role}${speaking ? ", speaking" : busy ? ", working" : ""}`}
      className={`relative h-[104px] w-[80px] overflow-hidden rounded-2xl backdrop-blur-md transition-all duration-300 ${
        speaking ? "scale-110" : ""
      }`}
      style={{
        background: `radial-gradient(120% 90% at 50% 10%, ${p.accent}55, rgba(10,10,10,0.55) 70%)`,
        boxShadow: speaking ? `0 0 0 2.5px ${p.accent}, 0 8px 30px ${p.accent}88` : "0 0 0 1px rgba(255,255,255,0.14)",
      }}
    >
      <div className="absolute inset-x-0 bottom-3 top-1">
        <Character agent={agent} speaking={speaking} />
      </div>
      {(busy || tool) && !speaking && (
        <span className="absolute inset-x-1 top-1 flex justify-center gap-0.5 rounded-full bg-black/60 py-0.5" aria-hidden>
          {[0, 1, 2].map((i) => <span key={i} className="crew-dot h-1 w-1 rounded-full bg-white" />)}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] font-semibold tracking-wide">
        {p.name}
      </span>
    </div>
  );
}

function RoundButton({
  label,
  onClick,
  children,
  tone = "glass",
  size = 54,
  disabled,
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "glass" | "white" | "red";
  size?: number;
  disabled?: boolean;
  pressed?: boolean;
}) {
  const look = {
    glass: "bg-white/15 text-white backdrop-blur-md hover:bg-white/25",
    white: "bg-white text-black ring-4 ring-white/30",
    red: "bg-[#ff3b30] text-white hover:bg-[#ff5147]",
  }[tone];
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${look}`}
      style={{ width: size, height: size }}
    >
      {children}
    </button>
  );
}

const ICONS = {
  speakerOn: <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor" />,
  speakerOff: <path d="M4 9v6h4l5 4V5L8 9H4zm11.6 3 2.2-2.2-1.4-1.4-2.2 2.2-2.2-2.2-1.4 1.4 2.2 2.2-2.2 2.2 1.4 1.4 2.2-2.2 2.2 2.2 1.4-1.4z" fill="currentColor" />,
  photos: <path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 11h14l-4.5-6-3.5 4.5-2.5-3L5 16zm3-6.5A1.5 1.5 0 1 0 8 6.5a1.5 1.5 0 0 0 0 3z" fill="currentColor" />,
  mic: <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1a7 7 0 0 0 6-6.9z" fill="currentColor" />,
  hangUp: <path d="M12 9c-2.9 0-5.7.7-8 2a2 2 0 0 0-1 2l.3 2.2a1 1 0 0 0 1.2.8l3.4-.7a1 1 0 0 0 .8-.9l.2-1.9c2-.6 4.2-.6 6.2 0l.2 1.9a1 1 0 0 0 .8.9l3.4.7a1 1 0 0 0 1.2-.8L21 13a2 2 0 0 0-1-2c-2.3-1.3-5.1-2-8-2z" fill="currentColor" />,
};

export default function CallScreen({
  kase,
  messages,
  source,
  startedAt,
  current,
  speaking,
  tool,
  thinking,
  voiceOn,
  onToggleVoice,
  onCaseChange,
  onEnd,
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
  const [looking, setLooking] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [problem, setProblem] = useState("");
  const [emergency, setEmergency] = useState<EmergencyKind | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [heard, setHeard] = useState("");
  const listener = useRef<ReturnType<typeof createListener> | null>(null);
  const seenEmergency = useRef(messages.reduce((m, x) => Math.max(m, x.seq), -1));
  const clock = useClock(startedAt);

  // The crew flagged active danger (from what it saw, or from a question): show the card.
  useEffect(() => {
    for (const m of messages) {
      if (m.kind === "emergency" && m.seq > seenEmergency.current) {
        seenEmergency.current = m.seq;
        setEmergency((m.refs.emergency as EmergencyKind) ?? "fire");
      }
    }
  }, [messages]);

  async function ask(text: string) {
    setHeard(text);
    const kind = emergencyIn(text);
    if (kind) setEmergency(kind); // instant: no waiting on the server or the model
    try {
      await askExpert(kase.id, text);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Couldn't send your question.");
    }
    setTimeout(() => setHeard(""), 4000);
  }

  function toggleMic() {
    if (!speechSupported()) {
      const typed = window.prompt(`Ask ${PERSONAS.inspector.name} a question:`);
      if (typed?.trim()) ask(typed.trim());
      return;
    }
    if (!listener.current) listener.current = createListener(ask, (msg) => { setProblem(msg); setMicOn(false); });
    if (micOn) listener.current.pause();
    else listener.current.resume();
    setMicOn(!micOn);
  }

  // Don't transcribe the crew's own voices: pause listening while anyone on the crew is talking.
  useEffect(() => {
    if (!micOn || !listener.current) return;
    if (speaking) listener.current.pause();
    else listener.current.resume();
  }, [speaking, micOn]);

  useEffect(() => () => listener.current?.pause(), []);

  const findings = kase.frames.filter((f) => !f.removed).reduce((n, f) => n + f.issues.length - f.dismissed.length, 0);

  // Start the camera (or the demo feed) for as long as the call screen is up.
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
          denied
            ? "Camera permission was denied. Allow it in your browser settings, or send photos with the gallery button."
            : !window.isSecureContext
              ? "The camera needs a secure (https) link."
              : "Couldn't start the camera. You can still send photos with the gallery button.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [source]);

  async function send(photo: Photo, live: boolean) {
    sending.current = true;
    setLooking(true);
    try {
      const result = await addFrame(kase.id, photo.blob, photo.sha256, live);
      if (result.issues.length) setSnapshot({ photo, issues: result.issues, id: Date.now() });
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

  // Watch the picture and capture on its own when you hold steady on something new.
  useEffect(() => {
    const t = setInterval(async () => {
      const video = videoRef.current;
      if (!video || !watch.current || sending.current) return;
      if (watch.current.check(video)) {
        watch.current.markSent(video);
        send(await frameFromVideo(video), true);
      }
    }, CHECK_EVERY_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kase.id]);

  useEffect(() => {
    if (!snapshot) return;
    const t = setTimeout(() => setSnapshot(null), SNAPSHOT_MS);
    return () => clearTimeout(t);
  }, [snapshot]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && !sending.current) send(await frameFromFile(file), false);
  }

  const speaker = current && isAgent(current.agent) ? PERSONAS[current.agent] : null;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-black text-white" style={{ height: "100dvh" }}>
      <video ref={videoRef} playsInline muted aria-label="Your camera" className="absolute inset-0 h-full w-full object-cover" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/85 via-black/50 to-transparent" />

      {/* viewfinder corners: amber while Rosa is looking */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[42%] h-56 w-56 -translate-x-1/2 -translate-y-1/2">
        {["left-0 top-0 border-l-2 border-t-2 rounded-tl-2xl", "right-0 top-0 border-r-2 border-t-2 rounded-tr-2xl",
          "left-0 bottom-0 border-l-2 border-b-2 rounded-bl-2xl", "right-0 bottom-0 border-r-2 border-b-2 rounded-br-2xl"].map((c) => (
          <span key={c} className={`absolute h-8 w-8 transition-colors ${c} ${looking ? "animate-pulse border-[#f5b301]" : "border-white/50"}`} />
        ))}
      </div>

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4" style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff3b30]" aria-hidden />
          <span>HomeCrew</span>
          <span className="tabular-nums text-white/70">{clock}</span>
        </div>
        <div className="flex items-center gap-2">
          {source === "demo" && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-black">Demo feed</span>
          )}
          <span
            className="rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md"
            style={{ background: findings ? "#f5b301" : "rgba(0,0,0,0.4)", color: findings ? "#000" : "#fff" }}
          >
            {findings} issue{findings === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* crew */}
      <div className="absolute right-3 flex flex-col gap-2.5" style={{ top: "calc(max(14px, env(safe-area-inset-top)) + 48px)" }}>
        {(Object.keys(PERSONAS) as AgentId[]).map((id) => (
          <CrewTile
            key={id}
            agent={id}
            speaking={speaking && current?.agent === id}
            busy={id === "inspector" && looking ? "looking" : thinking[id]}
            tool={id === "lawyer" ? tool : null}
          />
        ))}
      </div>

      {looking && (
        <div role="status" className="absolute left-1/2 top-[42%] mt-36 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-medium backdrop-blur-md">
          Rosa is looking…
        </div>
      )}

      {/* what Rosa just marked */}
      {snapshot && (
        <div key={snapshot.id} className="absolute left-3 w-32 overflow-hidden rounded-2xl bg-black/50 shadow-2xl ring-1 ring-white/20 backdrop-blur-md animate-[snapin_400ms_ease-out]" style={{ top: "calc(max(14px, env(safe-area-inset-top)) + 48px)" }}>
          <div className="relative" style={{ aspectRatio: `${snapshot.photo.width} / ${snapshot.photo.height}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={snapshot.photo.url} alt={`Marked: ${snapshot.issues.map((i) => i.label).join(", ")}`} className="h-full w-full object-cover" />
            {snapshot.issues.map((i, n) =>
              i.bbox ? (
                <span
                  key={n}
                  className="absolute rounded border-2"
                  style={{ left: `${i.bbox[0] * 100}%`, top: `${i.bbox[1] * 100}%`, width: `${i.bbox[2] * 100}%`, height: `${i.bbox[3] * 100}%`, borderColor: SEVERITY[i.severity] }}
                />
              ) : null,
            )}
          </div>
          <p className="truncate px-2 pt-1.5 text-[11px] font-semibold first-letter:uppercase">{snapshot.issues.map((i) => i.label).join(" · ")}</p>
          {(() => {
            const tier = worstTier(snapshot.issues.map((i) => i.safety?.tier));
            return tier ? (
              <p className="mx-2 mb-2 mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: TIER[tier].color, color: TIER[tier].ink }}>
                {TIER[tier].short}
              </p>
            ) : <div className="h-1.5" />;
          })()}
        </div>
      )}

      {heard && (
        <div className="absolute right-3 max-w-[70%] rounded-2xl rounded-br-sm bg-white px-3 py-2 text-sm font-medium text-black shadow-lg" style={{ bottom: "calc(max(18px, env(safe-area-inset-bottom)) + 200px)" }}>
          {heard}
        </div>
      )}

      {/* captions */}
      <div aria-live="polite" className="absolute inset-x-3" style={{ bottom: "calc(max(18px, env(safe-area-inset-bottom)) + 92px)" }}>
        {problem ? (
          <p role="alert" className="rounded-2xl bg-[#ff3b30]/85 px-4 py-3 text-sm font-medium backdrop-blur-md">{problem}</p>
        ) : current ? (
          <div key={current.seq} className="rounded-2xl bg-black/45 px-4 py-3 backdrop-blur-md">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: speaker?.accent ?? "#d4d4d4" }}>
              {speaker ? speaker.name : current.agent === "you" ? "You" : "HomeCrew"}
            </p>
            <p className="mt-0.5 line-clamp-4 text-[17px] font-medium leading-snug">{namedMentions(current.text).replace(/\s*@\w+\s*$/, "")}</p>
          </div>
        ) : (
          <p className="rounded-2xl bg-black/45 px-4 py-3 text-sm text-white/80 backdrop-blur-md">
            Point at anything that worries you and hold still for a second.
          </p>
        )}
      </div>

      {/* controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3.5" style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}>
        <RoundButton label={voiceOn ? "Mute the crew" : "Unmute the crew"} onClick={onToggleVoice} pressed={voiceOn}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>{voiceOn ? ICONS.speakerOn : ICONS.speakerOff}</svg>
        </RoundButton>
        <RoundButton label={micOn ? "Stop listening" : `Ask ${PERSONAS.inspector.name} out loud`} onClick={toggleMic} pressed={micOn}>
          <span className={`flex h-full w-full items-center justify-center rounded-full ${micOn ? "bg-white text-black" : ""}`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>{ICONS.mic}</svg>
          </span>
        </RoundButton>
        <RoundButton
          label="Snap this now"
          tone="white"
          size={70}
          disabled={looking}
          onClick={async () => {
            const video = videoRef.current;
            if (!video?.videoWidth || sending.current) return;
            watch.current?.markSent(video);
            send(await frameFromVideo(video), false);
          }}
        >
          <span className="h-[54px] w-[54px] rounded-full border-2 border-black/80" aria-hidden />
        </RoundButton>
        <RoundButton label="Send a photo from your gallery" onClick={() => fileRef.current?.click()}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>{ICONS.photos}</svg>
        </RoundButton>
        <RoundButton label="End call" tone="red" onClick={onEnd}>
          <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>{ICONS.hangUp}</svg>
        </RoundButton>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" aria-label="Choose a photo" />
      </div>

      {micOn && (
        <p className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black" style={{ bottom: "calc(max(18px, env(safe-area-inset-bottom)) + 78px)" }}>
          {speaking ? "Waiting for the crew…" : "Listening. Ask anything"}
        </p>
      )}

      {emergency && <EmergencyCard kind={emergency} onDismiss={() => setEmergency(null)} />}
    </div>
  );
}
