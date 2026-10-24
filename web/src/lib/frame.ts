// Turn a camera frame or uploaded photo into what we send to the Inspector:
// a JPEG at most 1024px on the long side. Re-encoding through a canvas also drops
// EXIF metadata (including GPS location) and converts iPhone HEIC photos.

const MAX_SIDE = 1024;

export type Frame = { blob: Blob; url: string; sha256: string; width: number; height: number };

function drawToJpeg(source: CanvasImageSource, srcW: number, srcH: number): Promise<Blob> {
  const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(srcW * scale);
  canvas.height = Math.round(srcH * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode JPEG"))), "image/jpeg", 0.85),
  );
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function finish(blob: Blob): Promise<Frame> {
  const bitmap = await createImageBitmap(blob);
  const frame = {
    blob,
    url: URL.createObjectURL(blob),
    sha256: await sha256Hex(blob),
    width: bitmap.width,
    height: bitmap.height,
  };
  bitmap.close();
  return frame;
}

export async function frameFromVideo(video: HTMLVideoElement): Promise<Frame> {
  return finish(await drawToJpeg(video, video.videoWidth, video.videoHeight));
}

export async function frameFromFile(file: File): Promise<Frame> {
  // createImageBitmap applies EXIF orientation, so rotated phone photos come out upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const blob = await drawToJpeg(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  return finish(blob);
}
