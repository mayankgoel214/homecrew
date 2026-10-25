// Records the HomeCrew demo end to end on pre-shot footage:
//   front page -> video call (footage plays as the camera, analyzed live) -> hang up -> report.
// Output: out/screen.webm (phone-sized screen recording) + out/speech.json (when each crew line
// started). Then mux.mjs lays the real crew voices onto the video at those moments.
//
//   node record.mjs --feed /walkthrough/room1.webm [--url http://localhost:3000] [--renter]

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readdirSync, renameSync } from "node:fs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg("url", "http://localhost:3000");
const FEED = arg("feed", "/walkthrough/room1.webm");
const OUT = new URL("./out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  recordVideo: { dir: OUT, size: { width: 780, height: 1688 } },
});
await context.addInitScript(() => {
  window.__hcSpeechLog = [];
  try { localStorage.clear(); } catch {}
});
const page = await context.newPage();
const t0 = Date.now(); // the screen recording starts with the page
page.on("console", (m) => m.type() === "error" && log("console error:", m.text().slice(0, 160)));

await page.goto(`${BASE}/?feed=${encodeURIComponent(FEED)}`, { waitUntil: "networkidle" });
log("front page");
await sleep(5000); // the crew pops up and idles

await page.getByRole("button", { name: "Start a video call" }).click();
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
await page.getByLabel("Verdict").waitFor({ timeout: 30000 });

// Let Theo's full review land (rows switch from "checking the law" to a section number).
await page.waitForFunction(() => !document.body.innerText.includes("CHECKING THE LAW"), null, { timeout: 60000 }).catch(() => {});
log("report ready");
await sleep(3500); // hold on the verdict

const firstRow = page.locator('[aria-label="Problems"] li button').first();
await firstRow.click();
await sleep(3500);
await firstRow.click();
await sleep(1200);

await page.getByLabel("Deadlines").scrollIntoViewIfNeeded();
await sleep(3000);

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
writeFileSync(`${OUT}/speech.json`, JSON.stringify({ t0, speech }, null, 2));
await context.close(); // finalizes the video file
await browser.close();

const webm = readdirSync(OUT).filter((f) => f.endsWith(".webm") && f !== "screen.webm").pop();
renameSync(`${OUT}/${webm}`, `${OUT}/screen.webm`);
log(`done: ${speech.length} crew lines, out/screen.webm`);
