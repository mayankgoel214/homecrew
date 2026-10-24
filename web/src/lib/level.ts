// How loud the crew is right now (0..1), for the speaking ring and mouth. Reads the real output of
// the shared <audio> element through a Web Audio analyser. iOS Safari sometimes reports silence
// from analysers, so when the crew is speaking but the analyser says zero, a layered sine stands in.

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let buf: Uint8Array<ArrayBuffer> | null = null;
let speaking = false;

export function attachAnalyser(el: HTMLAudioElement) {
  if (analyser || typeof window === "undefined") return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    const src = ctx.createMediaElementSource(el);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    buf = new Uint8Array(new ArrayBuffer(analyser.fftSize));
  } catch {
    analyser = null;
  }
}

export function resumeAudio() {
  ctx?.resume().catch(() => {});
}

export function setSpeaking(on: boolean) {
  speaking = on;
}

export function outputLevel(now = performance.now()): number {
  if (!speaking) return 0;
  if (analyser && buf) {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += ((v - 128) / 128) ** 2;
    const rms = Math.sqrt(sum / buf.length);
    if (rms > 0.01) return Math.min(1, rms * 3.2);
  }
  const t = now / 1000; // fallback: reads as speech, nobody can tell
  return 0.35 + 0.25 * Math.sin(t * 2 * Math.PI * 0.9) * Math.sin(t * 2 * Math.PI * 2.3) + 0.15 * Math.sin(t * 13);
}
