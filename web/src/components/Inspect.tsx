"use client";

import { useEffect, useRef, useState } from "react";
import { frameFromFile, frameFromVideo, type Frame } from "@/lib/frame";
import { inspectFrame, lawyerReview, type InspectResult, type Issue, type LawyerResult } from "@/lib/api";
import StatuteCard from "@/components/StatuteCard";
import AdvocatePanel from "@/components/AdvocatePanel";

type CameraState = "off" | "starting" | "live" | "unavailable";
type Shot = {
  frame: Frame;
  result?: InspectResult;
  error?: string;
  legal?: LawyerResult;
  legalError?: string;
  legalBusy?: boolean;
};

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

export default function Inspect() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<CameraState>("off");
  const [cameraError, setCameraError] = useState("");
  const [shot, setShot] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

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

  async function analyze(frame: Frame) {
    setShot({ frame });
    setBusy(true);
    let result: InspectResult;
    try {
      result = await inspectFrame(frame.blob, frame.sha256);
    } catch (e) {
      setShot({ frame, error: e instanceof Error ? e.message : "Something went wrong" });
      setBusy(false);
      return;
    }
    setBusy(false);
    if (!result.issues.length) {
      setShot({ frame, result });
      return;
    }
    // Only apply the Lawyer's answer if the user is still looking at this frame.
    const update = (patch: Partial<Shot>) => setShot((s) => (s?.frame === frame ? { ...s, ...patch } : s));
    setShot({ frame, result, legalBusy: true });
    try {
      update({ legal: await lawyerReview(result.issues), legalBusy: false });
    } catch (e) {
      update({ legalError: e instanceof Error ? e.message : "Lawyer failed", legalBusy: false });
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

  const issues = shot?.result?.issues ?? [];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">HomeCrew Inspector</h1>
        <p className="text-sm text-neutral-400">Point at a repair problem and tap Capture.</p>
      </header>

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-neutral-900">
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
                aspectRatio: `${shot.frame.width} / ${shot.frame.height}`,
                ...(shot.frame.width / shot.frame.height < 3 / 4 ? { height: "100%" } : { width: "100%" }),
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.frame.url}
                alt={issues.length ? `Captured frame with ${issues.length} marked issue(s)` : "Captured frame"}
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
      </div>

      <div className="flex gap-3">
        {shot ? (
          <button onClick={() => setShot(null)} disabled={busy} className="flex-1 rounded-md bg-white py-3 font-medium text-black disabled:opacity-50">
            {camera === "live" ? "Back to camera" : "Clear"}
          </button>
        ) : (
          <button onClick={capture} disabled={camera !== "live" || busy} className="flex-1 rounded-md bg-white py-3 font-medium text-black disabled:opacity-40">
            Capture
          </button>
        )}
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-md border border-neutral-600 px-4 py-3 disabled:opacity-50">
          Use a photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" aria-label="Upload a photo" />
      </div>

      {shot?.error && <p role="alert" className="rounded-md bg-red-950 p-3 text-sm text-red-200">{shot.error}</p>}

      {shot?.result && (
        <section aria-label="Inspector findings" className="flex flex-col gap-2">
          {issues.length === 0 && <p className="text-sm text-neutral-300">No visible defects in this frame.</p>}
          {issues.map((issue, i) => (
            <article key={i} className="rounded-md border border-neutral-700 p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">{issue.label}</h2>
                <span className="text-xs text-neutral-400">
                  severity {issue.severity}/5 · {Math.round(issue.confidence * 100)}% sure
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-300">{issue.evidence_note}</p>
              {issue.needs_human_check && <p className="mt-1 text-xs text-amber-300">Needs a human check: low confidence</p>}
              {!issue.bbox && <p className="mt-1 text-xs text-neutral-500">Approximate area (no exact box)</p>}
              {shot.legal?.findings
                .filter((f) => f.issue_index === i)
                .map((f) => <StatuteCard key={f.statute_section} finding={f} />)}
            </article>
          ))}
          {shot.legalBusy && (
            <p role="status" className="text-sm text-sky-300">Lawyer is checking Virginia law…</p>
          )}
          {shot.legalError && (
            <p role="alert" className="rounded-md bg-red-950 p-3 text-sm text-red-200">{shot.legalError}</p>
          )}
          {shot.legal && (
            <p className="text-xs text-neutral-400">
              Looked up {shot.legal.lookups.map((s) => `§ ${s}`).join(", ")}. {shot.legal.disclaimer}
            </p>
          )}
          {shot.legal && shot.legal.findings.length > 0 && (
            <AdvocatePanel key={shot.frame.sha256} issues={issues} findings={shot.legal.findings} />
          )}
          <p className="break-all text-xs text-neutral-500">
            {shot.result.model} · SHA-256 {shot.result.sha256.slice(0, 16)}… ·{" "}
            {shot.result.hash_match ? "hash verified on server" : "hash mismatch"}
          </p>
        </section>
      )}
    </div>
  );
}
