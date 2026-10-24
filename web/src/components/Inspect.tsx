"use client";

import { useEffect, useRef, useState } from "react";
import { frameFromFile, frameFromVideo, type Frame as Photo } from "@/lib/frame";
import { addFrame, createCase, getCase, type Case, type Issue } from "@/lib/api";
import EvidenceLedger from "@/components/EvidenceLedger";
import LegalReview from "@/components/LegalReview";
import AdvocatePanel from "@/components/AdvocatePanel";
import CrewCall from "@/components/CrewCall";
import { PERSONAS } from "@/lib/crew";

type CameraState = "off" | "starting" | "live" | "unavailable";
type Shot = { photo: Photo; issues?: Issue[]; error?: string };

const CASE_KEY = "homecrew.caseId";
const STEPS = [
  { label: "Photograph", agent: "inspector" },
  { label: "Check the law", agent: "lawyer" },
  { label: "Paperwork", agent: "advocate" },
] as const;
const NO_CHAT: Case["chat"] = [];
const SEVERITY_COLOR = ["", "#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"];
const REGION_CELL: Record<string, [number, number]> = {
  "top-left": [0, 0], top: [1, 0], "top-right": [2, 0],
  left: [0, 1], center: [1, 1], right: [2, 1],
  "bottom-left": [0, 2], bottom: [1, 2], "bottom-right": [2, 2],
};

// Fall back to the 3x3 grid cell when Gemma gives no usable box.
function boxFor(issue: Issue): [number, number, number, number] {
  if (issue.bbox) return issue.bbox;
  const [cx, cy] = REGION_CELL[issue.region] ?? [1, 1];
  return [cx / 3, cy / 3, 1 / 3, 1 / 3];
}

// Remembering the case id lets a refresh pick up where you left off. Storage can be blocked
// (private mode), so every access is wrapped.
const savedCaseId = () => {
  try {
    return localStorage.getItem(CASE_KEY);
  } catch {
    return null;
  }
};
const saveCaseId = (id: string | null) => {
  try {
    if (id) localStorage.setItem(CASE_KEY, id);
    else localStorage.removeItem(CASE_KEY);
  } catch {}
};

export default function Inspect() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<CameraState>("off");
  const [cameraError, setCameraError] = useState("");
  const [shot, setShot] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);
  const [kase, setKase] = useState<Case | null>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  useEffect(() => {
    const id = savedCaseId();
    if (id) getCase(id).then(setKase).catch(() => saveCaseId(null));
  }, []);

  async function ensureCase(): Promise<Case> {
    if (kase) return kase;
    const created = await createCase();
    saveCaseId(created.id);
    setKase(created);
    return created;
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("unavailable");
      setCameraError(
        window.isSecureContext
          ? "This browser can't open the camera. Use the photo button instead."
          : "The camera only works over HTTPS. Open the https:// tunnel link, or use the photo button.",
      );
      return;
    }
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCamera("live");
    } catch (e) {
      setCamera("unavailable");
      const name = e instanceof DOMException ? e.name : "";
      setCameraError(
        name === "NotAllowedError"
          ? "Camera permission was denied. Allow it in your browser settings, or use the photo button."
          : "Couldn't start the camera. Use the photo button instead.",
      );
    }
  }

  async function analyze(photo: Photo) {
    setShot({ photo });
    setBusy(true);
    try {
      const c = await ensureCase();
      const { frame } = await addFrame(c.id, photo.blob, photo.sha256);
      setShot({ photo, issues: frame.issues });
      setKase(await getCase(c.id));
    } catch (e) {
      setShot({ photo, error: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  }

  async function capture() {
    if (videoRef.current && camera === "live") await analyze(await frameFromVideo(videoRef.current));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await analyze(await frameFromFile(file));
  }

  function newCase() {
    if (kase?.frames.length && !confirm("Start a new case? This one stays saved on the server, but this page will forget it.")) return;
    saveCaseId(null);
    setKase(null);
    setShot(null);
  }

  const issues = shot?.issues ?? [];
  const activeFrames = kase?.frames.filter((f) => !f.removed) ?? [];
  const findingCount = activeFrames.reduce((n, f) => n + f.issues.length - f.dismissed.length, 0);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
              <rect width="32" height="32" rx="9" fill="#f5b301" />
              <path d="M8 16.5 16 9l8 7.5V24a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" fill="#0a0a0a" />
              <path d="m12.5 18.5 2.5 2.5 4.5-5" stroke="#f5b301" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <h1 className="text-xl font-bold leading-none tracking-tight">HomeCrew</h1>
              <p className="mt-1 text-xs text-neutral-400">A free inspector, lawyer and paralegal for Virginia renters</p>
            </div>
          </div>
          {kase && (
            <button onClick={newCase} className="shrink-0 rounded-lg px-2 py-1 text-xs text-neutral-400 underline-offset-4 hover:underline">
              New case
            </button>
          )}
        </div>
        <ol aria-label="Progress" className="grid grid-cols-3 gap-1.5">
          {STEPS.map((step, i) => {
            const done = [Boolean(kase?.frames.length), Boolean(kase?.legal), Boolean(kase?.draft?.approved)][i];
            const accent = PERSONAS[step.agent].accent;
            return (
              <li key={step.label} className="flex flex-col gap-1">
                <span className="h-1 rounded-full" style={{ background: done ? accent : "#262626" }} />
                <span className={`text-[11px] font-medium ${done ? "text-neutral-100" : "text-neutral-400"}`}>
                  {i + 1}. {step.label}
                  <span className="sr-only">{done ? " (done)" : ""}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </header>

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label="Live camera preview"
          className={`absolute inset-0 h-full w-full object-cover ${shot || camera !== "live" ? "invisible" : ""}`}
        />
        {shot && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Sized to the photo's own aspect ratio so box percentages line up with the image. */}
            <div
              className="relative"
              style={{
                aspectRatio: `${shot.photo.width} / ${shot.photo.height}`,
                ...(shot.photo.width / shot.photo.height < 4 / 3 ? { height: "100%" } : { width: "100%" }),
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.photo.url}
                alt={issues.length ? `Captured photo with ${issues.length} marked issue(s)` : "Captured photo"}
                className="h-full w-full"
              />
              {issues.map((issue, i) => {
                const [x, y, w, h] = boxFor(issue);
                return (
                  <div
                    key={i}
                    className={`pointer-events-none absolute rounded border-4 ${issue.bbox ? "" : "border-dashed"}`}
                    style={{
                      left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`,
                      borderColor: SEVERITY_COLOR[issue.severity],
                    }}
                  >
                    <span
                      className="absolute left-0 top-0 whitespace-nowrap rounded-br px-1 text-xs font-medium text-black"
                      style={{ background: SEVERITY_COLOR[issue.severity] }}
                    >
                      {issue.label} · {Math.round(issue.confidence * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!shot && camera !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <button
              onClick={startCamera}
              disabled={camera === "starting"}
              className="rounded-md bg-white px-5 py-3 font-medium text-black disabled:opacity-50"
            >
              {camera === "starting" ? "Starting camera…" : "Start camera"}
            </button>
            {cameraError && <p role="alert" className="text-sm text-amber-300">{cameraError}</p>}
          </div>
        )}
        {busy && (
          <div role="status" className="absolute inset-x-0 bottom-0 bg-black/70 p-3 text-center text-sm">
            Inspector is looking…
          </div>
        )}
        {shot && !busy && (
          <div role="status" className="absolute inset-x-0 bottom-0 bg-black/70 p-3 text-center text-sm">
            {shot.error
              ? "Couldn't analyze this photo."
              : issues.length
                ? `Found ${issues.length} issue${issues.length > 1 ? "s" : ""}. Added to your evidence.`
                : "No visible problems. Saved to your evidence."}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {shot ? (
          <button onClick={() => setShot(null)} disabled={busy} className="flex-1 rounded-xl bg-white py-3 font-semibold text-black transition-transform active:scale-[0.98] disabled:opacity-50">
            {camera === "live" ? "Next photo" : "Done"}
          </button>
        ) : (
          <button onClick={capture} disabled={camera !== "live" || busy} className="flex-1 rounded-xl bg-white py-3 font-semibold text-black transition-transform active:scale-[0.98] disabled:opacity-40">
            Capture
          </button>
        )}
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-semibold disabled:opacity-50">
          Use a photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" aria-label="Upload a photo" />
      </div>

      {shot?.error && <p role="alert" className="rounded-md bg-red-950 p-3 text-sm text-red-200">{shot.error}</p>}

      <CrewCall key={kase?.id ?? "new"} caseId={kase?.id ?? null} saved={kase?.chat ?? NO_CHAT} />

      {kase && kase.frames.length > 0 && (
        <>
          <EvidenceLedger kase={kase} onChange={setKase} />
          <LegalReview kase={kase} findingCount={findingCount} uploading={busy} onChange={setKase} />
          {kase.legal && kase.legal.findings.length > 0 && (
            <AdvocatePanel key={kase.legal.findings.length + kase.ledger.length} kase={kase} onChange={setKase} />
          )}
        </>
      )}
    </div>
  );
}
