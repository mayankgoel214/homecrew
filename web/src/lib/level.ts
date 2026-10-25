// How loud the crew is right now (0..1), for the speaking ring and mouth. A layered sine while the
// crew is speaking. Deliberately no Web Audio analyser: routing the <audio> element through an
// AudioContext let iOS Safari mute every voice after the first whenever it suspended the context.

let speaking = false;

export function setSpeaking(on: boolean) {
  speaking = on;
  // Demo recorder hook (only read when scripts/record-demo is driving the page).
  (window as unknown as { __hcSpeaking?: boolean }).__hcSpeaking = on;
}

export function outputLevel(now = performance.now()): number {
  if (!speaking) return 0;
  const t = now / 1000; // reads as speech, nobody can tell
  return 0.35 + 0.25 * Math.sin(t * 2 * Math.PI * 0.9) * Math.sin(t * 2 * Math.PI * 2.3) + 0.15 * Math.sin(t * 13);
}
