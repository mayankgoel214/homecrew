// The crew's characters and how they speak. Voice is pluggable: anything implementing CrewVoice
// (browser speech today; a hosted text-to-speech service later) can read lines in character.

export type AgentId = "inspector" | "lawyer" | "advocate";

export type Persona = {
  id: AgentId;
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
