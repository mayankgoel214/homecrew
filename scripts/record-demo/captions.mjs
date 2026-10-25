// Renders voiceover captions as transparent 1920x170 PNGs (ffmpeg here has no text filter).
//   node captions.mjs <jobs.json>   jobs: [{ "file": "/abs/out.png", "text": "..." }]

import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const jobs = JSON.parse(readFileSync(process.argv[2], "utf8"));
const html = (text) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@500&display=block" rel="stylesheet">
<style>
  * { margin: 0; } body { width: 1920px; height: 170px; background: transparent; display: flex; align-items: flex-end; justify-content: center; }
  p { max-width: 1500px; margin-bottom: 18px; padding: 14px 30px; border-radius: 14px; background: rgba(12,11,9,.86);
      color: #f2ede4; font: 500 40px/1.3 "IBM Plex Sans"; text-align: center; box-shadow: 0 6px 30px rgba(0,0,0,.5); }
</style></head><body><p>${text}</p></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 170 } });
for (const { file, text } of jobs) {
  await page.setContent(html(text), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: true });
}
await browser.close();
