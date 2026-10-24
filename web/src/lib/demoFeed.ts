// A stand-in camera for demos and testing: plays sample photos as a video stream (each held for a
// few seconds, then a short crossfade), once through, then stays on the last one. Always labeled "Demo feed" in the UI so it's never
// mistaken for a live camera.

const SCENES = ["/demo/clean_loft.jpg", "/demo/mold_1.jpg", "/demo/wiring_1.jpg", "/demo/lock_1.jpg"];
const HOLD_MS = 7000;
const FADE_MS = 900;

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, zoom: number, alpha: number) {
  const { width: W, height: H } = ctx.canvas;
  const scale = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  ctx.globalAlpha = 1;
}

export async function createDemoStream(): Promise<{ stream: MediaStream; stop: () => void }> {
  const images = await Promise.all(SCENES.map(load));
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 1280; // portrait, like a phone camera
  const ctx = canvas.getContext("2d")!;
  const start = performance.now();
  let raf = 0;

  const frame = (now: number) => {
    const t = now - start;
    const i = Math.min(Math.floor(t / HOLD_MS), images.length - 1);
    const last = i === images.length - 1;
    const into = last ? Math.min(t - i * HOLD_MS, HOLD_MS) : t % HOLD_MS;
    const zoom = 1 + (into / HOLD_MS) * 0.015; // barely-there drift so it reads as video
    drawCover(ctx, images[i], zoom, 1);
    if (!last && into > HOLD_MS - FADE_MS) {
      drawCover(ctx, images[i + 1], 1, (into - (HOLD_MS - FADE_MS)) / FADE_MS);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const stream = canvas.captureStream(24);
  return {
    stream,
    stop: () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
