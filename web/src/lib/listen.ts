// Hands-free questions: the browser's speech recognition (Chrome, Android, recent iOS Safari).
// Gemma 4 31B on the API doesn't take audio, so speech becomes text on the phone first.

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function speechSupported(): boolean {
  return typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

/** Listens until stopped. pause()/resume() let the app stop listening while the crew talks,
 *  so the crew's own voices don't get transcribed as your questions. */
export function createListener(
  onText: (text: string) => void,
  onError: (msg: string) => void,
  onVoice: (talking: boolean) => void = () => {},
) {
  const Ctor = (window as unknown as Record<string, new () => Recognition>).SpeechRecognition ??
    (window as unknown as Record<string, new () => Recognition>).webkitSpeechRecognition;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = "en-US";
  let wanted = false;
  let running = false;

  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal && r[0].transcript.trim()) onText(r[0].transcript.trim());
    }
  };
  rec.onspeechstart = () => onVoice(true);
  rec.onspeechend = () => onVoice(false);
  rec.onend = () => {
    running = false;
    onVoice(false);
    if (wanted) setTimeout(() => wanted && !running && start(), 250); // browsers stop after silence
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      wanted = false;
      onError("Microphone permission was denied.");
    }
  };
  const start = () => {
    try {
      rec.start();
      running = true;
    } catch {}
  };
  return {
    resume() {
      wanted = true;
      if (!running) start();
    },
    pause() {
      wanted = false;
      if (running) rec.abort();
    },
  };
}
