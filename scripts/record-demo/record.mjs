// Records the HomeCrew demo end to end on pre-shot footage:
//   front page -> video call (footage plays as the camera, analyzed live) -> hang up -> report.
// Output: out/screen.mp4 (full-resolution phone screen, 780x1688) + out/speech.json (when each crew line
// started). Then mux.mjs lays the real crew voices onto the video at those moments.
//
//   node record.mjs --feed /walkthrough/room1.webm [--url http://localhost:3000] [--out takes/x]
//                   [--owner] [--problem "my sink won't drain"]

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg("url", "http://localhost:3000");
const FEED = arg("feed", "/walkthrough/room1.webm");
const OUT = new URL(`./${arg("out", "out")}/`, import.meta.url).pathname;
const PROBLEM = arg("problem", "");
const OWNER = process.argv.includes("--owner");
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await context.addInitScript(() => {
  window.__hcSpeechLog = [];
  try { localStorage.clear(); } catch {}
});
const page = await context.newPage();
// Playwright's recordVideo captures at CSS-pixel size (a 390x844 box in the corner of the frame), so
// grab the screen with Chrome's own screencast instead: every changed frame, at 2x, wall-clock stamped.
const FRAMES = `${OUT}/frames`;
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES);
const frames = []; // [file, wall-clock ms]
const cdp = await context.newCDPSession(page);
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const file = `${FRAMES}/${String(frames.length).padStart(6, "0")}.jpg`;
  writeFileSync(file, Buffer.from(data, "base64"));
  frames.push([file, metadata.timestamp * 1000]);
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 780, maxHeight: 1688 });
page.on("console", (m) => m.type() === "error" && log("console error:", m.text().slice(0, 160)));

await page.goto(`${BASE}/?feed=${encodeURIComponent(FEED)}`, { waitUntil: "networkidle" });
log("front page");
await sleep(5000); // the crew pops up and idles

if (OWNER) {
  await page.getByRole("button", { name: /You rent/ }).click(); // I RENT -> I OWN
  await sleep(1800);
}
if (PROBLEM) {
  await page.getByRole("button", { name: "Describe a problem instead" }).click();
  await sleep(900);
  await page.locator("form input").first().pressSequentially(PROBLEM, { delay: 75 });
  await sleep(700);
  await page.getByRole("button", { name: "Call the right expert" }).click();
} else {
  await page.getByRole("button", { name: "Start a video call" }).click();
}
log("call started");

// Wait for the footage to finish, then for the crew to finish talking.
await page.waitForFunction(() => document.querySelector('video[aria-label="Your camera"]')?.ended === true, null, { timeout: 180000 });
log("footage ended");
let quietSince = Date.now();
while (Date.now() - quietSince < 2500) {
  const speaking = await page.evaluate(() => window.__hcSpeaking === true);
  if (speaking) quietSince = Date.now();
  await sleep(250);
}
log("crew finished");
await sleep(800);

await page.getByRole("button", { name: "End call" }).click();
log("hung up");
await page.getByLabel("Verdict").waitFor({ timeout: 30000 }).catch(() => log("no findings: report is empty"));

// Let Theo's full review land (rows switch from "checking the law" to a section number).
await page.waitForFunction(() => !document.body.innerText.includes("CHECKING THE LAW"), null, { timeout: 60000 }).catch(() => {});
log("report ready");
await sleep(3500); // hold on the verdict

const firstRow = page.locator('[aria-label="Problems"] li button').first();
if (await firstRow.count()) { // open the first finding to show "what to do"
  await firstRow.click();
  await sleep(3500);
  await firstRow.click();
  await sleep(1200);
}

if (await page.getByLabel("Deadlines").count()) { // only when something is the landlord's job
  await page.getByLabel("Deadlines").scrollIntoViewIfNeeded();
  await sleep(3000);
}

const write = page.getByRole("button", { name: "Write my letter" });
if (await write.count()) {
  await write.scrollIntoViewIfNeeded();
  await sleep(800);
  await write.click();
  log("drafting letter");
  await page.getByLabel("Your repair letter").waitFor({ timeout: 60000 });
  await sleep(2500);
  await page.getByRole("button", { name: /Approve$/ }).click();
  log("approved");
  await sleep(1500);
  await page.getByRole("link", { name: "Letter" }).scrollIntoViewIfNeeded();
  await sleep(3500);
}

const speech = await page.evaluate(() => window.__hcSpeechLog);
await cdp.send("Page.stopScreencast");
await context.close();
await browser.close();

// Frames only arrive when the screen changes: hold each one until the next, then render 30 fps.
const t0 = frames[0][1];
frames.push([frames.at(-1)[0], Date.now()]);
const list = frames.slice(0, -1).map(([f, at], i) => `file '${f}'\nduration ${((frames[i + 1][1] - at) / 1000).toFixed(3)}`);
writeFileSync(`${FRAMES}/list.txt`, `ffconcat version 1.0\n${list.join("\n")}\nfile '${frames.at(-1)[0]}'\n`);
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", `${FRAMES}/list.txt`,
  "-vf", "fps=30,scale=780:1688:force_original_aspect_ratio=decrease,pad=780:1688:(ow-iw)/2:(oh-ih)/2",
  "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", `${OUT}/screen.mp4`]);
writeFileSync(`${OUT}/speech.json`, JSON.stringify({ t0, speech }, null, 2));
log(`done: ${speech.length} crew lines, ${frames.length} frames, out/screen.mp4`);
