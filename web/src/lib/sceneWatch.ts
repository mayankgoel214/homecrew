// Decides when a live camera frame is worth sending to Rosa: the picture has to be steady (not
// mid-swing) and noticeably different from the last frame we sent. Works on a 32x24 grayscale
// thumbnail, so it's cheap enough to run several times a second on a phone.

const W = 32;
const H = 24;
const STEADY_BELOW = 7; // mean pixel change between consecutive checks (0-255)
const NEW_SCENE_ABOVE = 16; // mean pixel change vs. the last frame sent
const STEADY_CHECKS = 2; // consecutive steady checks needed
const MIN_GAP_MS = 4500; // never send more often than this

export class SceneWatch {
  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private previous: Uint8Array | null = null;
  private lastSent: Uint8Array | null = null;
  private lastSentAt = 0;
  private steady = 0;

  constructor() {
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
  }

  private signature(video: HTMLVideoElement): Uint8Array {
    this.ctx.drawImage(video, 0, 0, W, H);
    const rgba = this.ctx.getImageData(0, 0, W, H).data;
    const gray = new Uint8Array(W * H);
    for (let i = 0; i < gray.length; i++) gray[i] = (rgba[i * 4] * 3 + rgba[i * 4 + 1] * 6 + rgba[i * 4 + 2]) / 10;
    return gray;
  }

  private static diff(a: Uint8Array, b: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    return sum / a.length;
  }

  /** Call a few times a second. Returns true when this is a good moment to capture. */
  check(video: HTMLVideoElement, now = performance.now()): boolean {
    if (!video.videoWidth) return false;
    const sig = this.signature(video);
    const motion = this.previous ? SceneWatch.diff(sig, this.previous) : 255;
    this.previous = sig;
    this.steady = motion < STEADY_BELOW ? this.steady + 1 : 0;
    if (this.steady < STEADY_CHECKS || now - this.lastSentAt < MIN_GAP_MS) return false;
    const novelty = this.lastSent ? SceneWatch.diff(sig, this.lastSent) : 255;
    return novelty > NEW_SCENE_ABOVE;
  }

  /** Record that we just sent the current picture (automatically or by the shutter button). */
  markSent(video: HTMLVideoElement, now = performance.now()) {
    if (video.videoWidth) this.lastSent = this.signature(video);
    this.lastSentAt = now;
  }
}
