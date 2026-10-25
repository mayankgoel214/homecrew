// Lays the crew's real voices onto out/screen.mp4 at the moments they played during recording.
// Each line is re-synthesized from the same text and voice via the API's /tts (Cartesia), sped up
// 1.12x like the app plays it, and placed with its recorded offset. Output: out/demo.mp4
//
//   node mux.mjs [--api http://localhost:8000]

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const API = process.argv.includes("--api") ? process.argv[process.argv.indexOf("--api") + 1] : "http://localhost:8000";
const OUT = new URL(`./${process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "out"}/`, import.meta.url).pathname;
const { t0, speech } = JSON.parse(readFileSync(`${OUT}/speech.json`, "utf8"));

const inputs = ["-i", `${OUT}/screen.mp4`];
const filters = [];
for (const [n, line] of speech.entries()) {
  const res = await fetch(`${API}/tts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent: line.agent, text: line.text, trade: line.trade }),
  });
  if (!res.ok) throw new Error(`tts failed for line ${n}: ${res.status}`);
  const file = `${OUT}/line${n}.mp3`;
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  inputs.push("-i", file);
  const delay = Math.max(0, line.at - t0);
  filters.push(`[${n + 1}:a]aresample=48000,atempo=1.12,adelay=${delay}|${delay}[a${n}]`);
  console.log(`${(delay / 1000).toFixed(1).padStart(6)}s  ${line.agent.padEnd(9)} ${line.text}`);
}
const mix = speech.map((_, n) => `[a${n}]`).join("");
filters.push(`${mix}amix=inputs=${speech.length}:normalize=0:dropout_transition=0,apad,aresample=async=1:first_pts=0[aout]`);
filters.push(`[0:v]fps=30[vout]`); // screen recordings are variable-rate; the muxer wants steady timestamps

execFileSync("ffmpeg", [
  "-v", "error", "-y", ...inputs,
  "-filter_complex", filters.join(";"),
  "-map", "[vout]", "-map", "[aout]", "-shortest",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
  `${OUT}/demo.mp4`,
], { stdio: "inherit" });
console.log(`\nout/demo.mp4 with ${speech.length} crew lines`);
