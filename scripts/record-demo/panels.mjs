// Renders the 1920x1080 frames the demo video is built on: a side-panel background per section
// (the phone screen recording is overlaid in the middle), speed badges, and the two full slides.
// ffmpeg here has no text filter, so all type is set in the browser with the app's own fonts.
//
//   node panels.mjs   ->  edit/panels/*.png

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./edit/panels/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// The phone sits here in every section (edit.py uses the same numbers).
export const PHONE = { x: 729, y: 40, w: 462, h: 1000 };

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=block" rel="stylesheet">`;
const BASE = `
  * { margin: 0; box-sizing: border-box; }
  body { width: 1920px; height: 1080px; overflow: hidden; color: #f2ede4; font-family: "IBM Plex Sans";
         background: radial-gradient(900px 600px at 50% 0%, #2a2112 0%, #0c0b09 70%); }
  .mono { font-family: "IBM Plex Mono"; letter-spacing: .06em; }
  .display { font-family: "Fraunces"; letter-spacing: -.02em; }
`;

const callout = (who, color, text) =>
  `<div class="co"><span class="mono" style="color:${color}">${who}</span><p>${text}</p></div>`;

const SECTIONS = {
  intro: {
    step: "", title: "HomeCrew", sub: "Your home's crew, <i style='color:#e0a83a'>on call.</i>",
    right: [callout("THE PROBLEM", "#e0a83a", "Virginia renters rarely have a lawyer, so repair problems go undocumented."),
            callout("THE FIX", "#7ed4a6", "A video call with an AI crew that inspects, cites the law, and writes the letter.")],
  },
  renter: {
    step: "01 · RENTER CALL", title: "Show them<br>what's wrong.", sub: "The crew talks it through on the call.",
    right: [callout("ROSA · INSPECTOR", "#e7b85c", "Gemma 4 spots the problem and marks it on the camera feed."),
            callout("THEO · LAWYER", "#8fb4ff", "Cites the real Virginia Code section."),
            callout("JUNE · ADVOCATE", "#7ed4a6", "Adds it to your repair letter.")],
  },
  report: {
    step: "02 · CASE FILE", title: "Who fixes what.", sub: "The law, the 21-day clock, and a letter ready to send.",
    right: [callout("THE LAW", "#8fb4ff", "Va. Code § 55.1-1220, pulled from Virginia's legal API."),
            callout("YOU APPROVE", "#7ed4a6", "Letter, code complaint and calendar file. Nothing is sent for you.")],
  },
  owner: {
    step: "03 · HOMEOWNER", title: "Own your place?", sub: "Same crew. No landlord, just what's safe to do.",
    right: [callout("SAFETY RULES", "#e0a83a", "Every finding is rated: landlord, call a pro, or fix it yourself."),
            callout("HOW-TO", "#7ed4a6", "Safe fixes come with spoken steps.")],
  },
  plumber: {
    step: "04 · ANY PROBLEM", title: "Describe it.", sub: "The right expert picks up.",
    right: [callout("6 EXPERTS", "#e7b85c", "Plumber, electrician, heating, pests, locks, mold."),
            callout("NEVER-DIY", "#ff8a7a", "Gas, wiring and panels always go to a pro.")],
  },
};

const sectionHtml = (s) => `<!doctype html><html><head>${FONTS}<style>${BASE}
  .left { position: absolute; left: 90px; top: 0; bottom: 0; width: 560px; display: flex; flex-direction: column; justify-content: center; }
  .right { position: absolute; right: 90px; top: 0; bottom: 0; width: 520px; display: flex; flex-direction: column; justify-content: center; gap: 34px; }
  .step { font-size: 22px; color: #e0a83a; margin-bottom: 22px; }
  h1 { font-size: 84px; font-weight: 400; line-height: 1.02; }
  .sub { margin-top: 26px; font-size: 30px; line-height: 1.35; color: #b8b0a2; }
  .co span { font-size: 18px; }
  .co p { margin-top: 8px; font-size: 27px; line-height: 1.35; color: #f2ede4; }
  .bezel { position: absolute; left: ${PHONE.x - 10}px; top: ${PHONE.y - 10}px; width: ${PHONE.w + 20}px; height: ${PHONE.h + 20}px;
           border-radius: 44px; background: #000; box-shadow: 0 0 0 2px #2d2820, 0 30px 80px rgba(0,0,0,.6); }
</style></head><body>
  <div class="bezel"></div>
  <div class="left">${s.step ? `<p class="mono step">${s.step}</p>` : ""}<h1 class="display">${s.title}</h1><p class="sub">${s.sub}</p></div>
  <div class="right">${s.right.join("")}</div>
</body></html>`;

const badgeHtml = (label) => `<!doctype html><html><head>${FONTS}<style>
  * { margin: 0; } body { background: transparent; width: 120px; height: 56px; }
  div { box-sizing: border-box; width: 120px; height: 56px; border-radius: 28px; background: rgba(12,11,9,.85); border: 2px solid #e0a83a;
        color: #e0a83a; font: 500 28px "IBM Plex Mono"; display: flex; align-items: center; justify-content: center; }
</style></head><body><div>${label}</div></body></html>`;

const box = (color, who, what, how) => `
  <div class="box" style="border-color:${color}"><span class="mono" style="color:${color}">${who}</span>
  <b>${what}</b><p>${how}</p></div>`;
const builtHtml = `<!doctype html><html><head>${FONTS}<style>${BASE}
  h1 { position: absolute; left: 110px; top: 90px; font-size: 76px; font-weight: 400; }
  .row { position: absolute; left: 110px; right: 110px; top: 300px; display: flex; gap: 26px; align-items: stretch; }
  .box { flex: 1; border: 2px solid; border-radius: 22px; padding: 30px 28px; background: rgba(21,19,15,.9); }
  .box span { font-size: 17px; } .box b { display: block; margin-top: 14px; font: 600 33px "IBM Plex Sans"; line-height: 1.2; }
  .box p { margin-top: 14px; font-size: 23px; line-height: 1.4; color: #b8b0a2; }
  .arrow { align-self: center; font-size: 46px; color: #8a8275; }
  .stack { position: absolute; left: 110px; right: 110px; bottom: 100px; font-size: 22px; color: #8a8275; }
</style></head><body>
  <h1 class="display">How we built it</h1>
  <div class="row">
    ${box("#e7b85c", "SEE", "Gemma 4 31B", "Looks at each camera frame and marks every problem it can see.")}
    <span class="arrow">→</span>
    ${box("#e0a83a", "DECIDE", "Safety rules", "Fixed code, not AI: landlord, call a pro, or safe to DIY.")}
    <span class="arrow">→</span>
    ${box("#8fb4ff", "CITE", "Virginia law API", "Real statutes from law.lis.virginia.gov. Quotes are checked word for word.")}
    <span class="arrow">→</span>
    ${box("#7ed4a6", "ACT", "Letter + approve", "Repair notice, code complaint, calendar file. Sent only after you approve.")}
  </div>
  <p class="mono stack">GEMMA 4 VIA GEMINI API · LAW.LIS.VIRGINIA.GOV · CARTESIA VOICES · CLOUD RUN · FIRESTORE · NEXT.JS ON VERCEL</p>
</body></html>`;

const endHtml = `<!doctype html><html><head>${FONTS}<style>${BASE}
  .c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  h1 { font-size: 150px; font-weight: 400; } h2 { margin-top: 10px; font-size: 54px; font-weight: 400; color: #e0a83a; font-style: italic; }
  p { margin-top: 70px; font-size: 30px; color: #b8b0a2; line-height: 1.7; }
  .tag { margin-top: 44px; font-size: 22px; color: #e0a83a; border: 2px solid #e0a83a; border-radius: 30px; padding: 12px 30px; }
</style></head><body><div class="c">
  <h1 class="display">HomeCrew</h1><h2 class="display">A crew in every renter's pocket.</h2>
  <p class="mono">homecrew-vt.vercel.app<br>github.com/mayankgoel214/homecrew</p>
  <span class="mono tag">BUILT WITH GEMMA 4</span>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const shoot = async (html, file, opts = {}) => {
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${file}`, ...opts });
};
for (const [id, s] of Object.entries(SECTIONS)) await shoot(sectionHtml(s), `${id}.png`);
await shoot(builtHtml, "built.png");
await shoot(endHtml, "end.png");
// Rounded-corner mask for the phone recording (white = keep), so it sits inside the bezel.
await page.setViewportSize({ width: PHONE.w, height: PHONE.h });
await shoot(`<body style="margin:0;background:#000"><div style="width:${PHONE.w}px;height:${PHONE.h}px;border-radius:34px;background:#fff"></div></body>`, "mask.png");
await page.setViewportSize({ width: 120, height: 56 });
for (const x of ["1.5x", "2x", "3x", "4x", "6x"]) await shoot(badgeHtml(x), `badge-${x}.png`, { omitBackground: true });
await browser.close();
console.log("panels in edit/panels/");
