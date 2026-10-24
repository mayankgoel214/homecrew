// The crew's characters and how they speak. Voice is pluggable: anything implementing CrewVoice
// (browser speech today; a hosted text-to-speech service later) can read lines in character.

export type AgentId = "inspector" | "lawyer" | "advocate";

export type Persona = {
  id: AgentId;
  trade?: TradeId; // the inspector slot is played by whichever expert was called
  name: string;
  role: string;
  tagline: string;
  accent: string; // hex, used for the speaking glow and caption name
  voice: { pitch: number; rate: number; preferred: string[] };
};

export const PERSONAS: Record<AgentId, Persona> = {
  inspector: {
    id: "inspector",
    name: "Rosa",
    role: "Inspector",
    tagline: "Spots repair problems in your photos",
    accent: "#f5b301",
    voice: { pitch: 1.1, rate: 1.03, preferred: ["Samantha", "Google US English", "Karen", "Zira"] },
  },
  lawyer: {
    id: "lawyer",
    name: "Theo",
    role: "Lawyer",
    tagline: "Matches each problem to Virginia law",
    accent: "#38bdf8",
    voice: { pitch: 0.85, rate: 0.98, preferred: ["Daniel", "Google UK English Male", "Aaron", "Alex", "David"] },
  },
  advocate: {
    id: "advocate",
    name: "June",
    role: "Advocate",
    tagline: "Writes your letter and complaint",
    accent: "#34d399",
    voice: { pitch: 1.0, rate: 1.05, preferred: ["Moira", "Tessa", "Google UK English Female", "Fiona", "Susan"] },
  },
};

export const isAgent = (agent: string): agent is AgentId => agent in PERSONAS;

// ---- trades: who you can call -----------------------------------------------------------------

export type TradeId = "general" | "plumber" | "electrician" | "hvac" | "pest" | "locks" | "mold";

export const TRADES: { id: TradeId; name: string; role: string; accent: string; checks: string }[] = [
  { id: "general", name: "Rosa", role: "Home inspector", accent: "#f5b301", checks: "Not sure? A full walk-through" },
  { id: "plumber", name: "Marco", role: "Plumber", accent: "#3b82f6", checks: "Leaks, drips, toilets, water heater" },
  { id: "electrician", name: "Dana", role: "Electrician", accent: "#facc15", checks: "Outlets, wiring, smoke alarms" },
  { id: "hvac", name: "Sam", role: "Heating & AC", accent: "#f87171", checks: "No heat, thermostat, filters" },
  { id: "pest", name: "Lena", role: "Pest specialist", accent: "#4ade80", checks: "Mice, roaches, bedbugs" },
  { id: "locks", name: "Archie", role: "Locks & doors", accent: "#c084fc", checks: "Locks, door frames, windows" },
  { id: "mold", name: "Rosa", role: "Mold & water", accent: "#2dd4bf", checks: "Mold, damp walls, stains" },
];

/** Put the chosen expert in the inspector's seat. Everything that reads PERSONAS.inspector
 *  (tiles, captions, transcript, voice) picks it up on the next render. */
export function applyTrade(id: TradeId) {
  const t = TRADES.find((x) => x.id === id) ?? TRADES[0];
  Object.assign(PERSONAS.inspector, { name: t.name, role: t.role, accent: t.accent, trade: t.id, tagline: t.checks });
}

const MENTION = /@(Inspector|Lawyer|Advocate)\b/g;
const byRole = (role: string) => Object.values(PERSONAS).find((p) => p.role === role)!;

/** "@Lawyer this is ready" -> "@Theo this is ready" for the screen. */
export const namedMentions = (text: string) => text.replace(MENTION, (_, role) => `@${byRole(role).name}`);

/** What a voice should actually say: names instead of roles, readable legal citations. */
export function speakable(text: string): string {
  return text
    .replace(MENTION, (_, role) => byRole(role).name)
    .replace(/@You\b/g, "")
    .replace(/§§/g, "sections")
    .replace(/§\s*/g, "section ")
    .replace(/→/g, ":")
    .replace(/\s+/g, " ")
    .trim();
}

// ---- voices -----------------------------------------------------------------------------------

export interface CrewVoice {
  /** Resolve when the line has finished (or been cancelled). */
  speak(text: string, persona: Persona): Promise<void>;
  cancel(): void;
  /** Optional: start fetching audio for a line that will be spoken soon. */
  prepare?(text: string, persona: Persona): void;
}

/** How long a line stays up with no audio: roughly reading speed, clamped. */
export const readingMs = (text: string) => Math.min(7000, Math.max(1800, text.length * 45));

/** Default: no audio, each caption stays up for about as long as it takes to read. */
export function silentVoice(): CrewVoice {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let done: (() => void) | undefined;
  return {
    speak(text) {
      return new Promise((resolve) => {
        done = resolve;
        timer = setTimeout(resolve, readingMs(text));
      });
    },
    cancel() {
      clearTimeout(timer);
      done?.();
    },
  };
}

/** Free, built into every browser. Quality varies by device; swap in a hosted voice later. */
export function browserVoice(): CrewVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const synth = window.speechSynthesis;

  const pick = (persona: Persona) => {
    const voices = synth.getVoices().filter((v) => v.lang.startsWith("en"));
    for (const name of persona.voice.preferred) {
      const match = voices.find((v) => v.name.includes(name));
      if (match) return match;
    }
    // No preferred voice on this device: at least give each character a different one.
    const index = Object.keys(PERSONAS).indexOf(persona.id);
    return voices.length ? voices[index % voices.length] : undefined;
  };

  // Chrome fills the voice list a moment after load; some browsers have none at all.
  const voicesReady = (): Promise<boolean> =>
    synth.getVoices().length
      ? Promise.resolve(true)
      : new Promise((resolve) => {
          const done = () => resolve(synth.getVoices().length > 0);
          synth.addEventListener("voiceschanged", done, { once: true });
          setTimeout(done, 1000);
        });
  const silent = silentVoice();

  return {
    async speak(text, persona) {
      if (!(await voicesReady())) return silent.speak(text, persona); // no voices: captions only
      return new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(speakable(text));
        const voice = pick(persona);
        if (voice) u.voice = voice;
        u.pitch = persona.voice.pitch;
        u.rate = persona.voice.rate;
        // Some browsers never fire "end"; don't let the call get stuck on one line.
        const safety = setTimeout(resolve, readingMs(text) * 2 + 4000);
        u.onend = u.onerror = () => {
          clearTimeout(safety);
          resolve();
        };
        synth.speak(u);
      });
    },
    cancel() {
      synth.cancel();
      silent.cancel();
    },
  };
}

/** iOS only allows speech after a tap; call this from the click that turns voice on. */
export function unlockBrowserVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

// ---- human voices (Cartesia, via our server) -------------------------------------------------

// One shared <audio> element: iOS only lets a page play sound from an element it has already
// played from inside a tap, so unlockAudio() is called from the "Start call" tap.
let sharedAudio: HTMLAudioElement | null = null;
// 0.1 s of silence as a WAV, built here so it's always a valid file.
function silentWav(): string {
  const samples = 800; // 8 kHz, 8-bit mono
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, str: string) => [...str].forEach((c, i) => (bytes[offset + i] = c.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + samples, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, "data"); view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit silence is the midpoint
  return "data:audio/wav;base64," + btoa(String.fromCharCode(...bytes));
}

export function unlockAudio() {
  if (typeof window === "undefined") return;
  sharedAudio ??= new Audio();
  sharedAudio.src = silentWav();
  sharedAudio.play().catch(() => {});
  unlockBrowserVoice();
}

/** Real human voices. Falls back to the next voice (browser speech, then captions) on any error. */
export function cartesiaVoice(fallback: CrewVoice): CrewVoice {
  const pending = new Map<string, Promise<string | null>>(); // line -> object URL
  let stopCurrent: (() => void) | null = null;
  const key = (text: string, p: Persona) => `${p.id}|${p.trade ?? ""}|${text}`;

  const fetchLine = (text: string, persona: Persona) => {
    const k = key(text, persona);
    if (!pending.has(k)) {
      pending.set(
        k,
        fetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agent: persona.id, text: speakable(text), trade: persona.trade }),
        })
          .then((r) => (r.ok ? r.blob() : null))
          .then((b) => (b ? URL.createObjectURL(b) : null))
          .catch(() => null),
      );
      if (pending.size > 60) pending.delete(pending.keys().next().value!);
    }
    return pending.get(k)!;
  };

  return {
    prepare: fetchLine,
    async speak(text, persona) {
      const url = await fetchLine(text, persona);
      if (!url) return fallback.speak(text, persona);
      const audio = (sharedAudio ??= new Audio());
      return new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(safety);
          audio.onended = audio.onerror = null;
          stopCurrent = null;
          resolve();
        };
        const safety = setTimeout(done, readingMs(text) * 2 + 6000);
        stopCurrent = () => {
          audio.pause();
          done();
        };
        audio.onended = audio.onerror = done;
        audio.src = url;
        audio.play().catch(() => {
          done();
        });
      });
    },
    cancel() {
      stopCurrent?.();
      fallback.cancel();
    },
  };
}
