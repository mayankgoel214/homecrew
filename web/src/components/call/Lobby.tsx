import Character from "@/components/Character";
import { PERSONAS, type AgentId } from "@/lib/crew";

export default function Lobby({
  onStart,
  openCase,
  starting,
}: {
  onStart: (source: "camera" | "demo") => void;
  openCase: { issues: number; onOpen: () => void } | null;
  starting: boolean;
}) {
  return (
    <main
      className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#07080a] px-6 text-white"
      style={{ paddingTop: "max(28px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
    >
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#f5b301]/10 blur-3xl" />

      <div className="relative flex items-center gap-2">
        <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
          <rect width="32" height="32" rx="9" fill="#f5b301" />
          <path d="M8 16.5 16 9l8 7.5V24a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" fill="#07080a" />
          <path d="m12.5 18.5 2.5 2.5 4.5-5" stroke="#f5b301" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-bold tracking-tight">HomeCrew</span>
      </div>

      <div className="relative mt-12 flex-1">
        <h1 className="text-[40px] font-extrabold leading-[1.02] tracking-tight">
          Show us your
          <br />
          apartment.
        </h1>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/70">
          Video-call your crew. They spot what needs fixing, tell you what Virginia law says, and write your
          repair letter. Free.
        </p>

        <ul className="mt-10 grid grid-cols-3 gap-3">
          {(Object.keys(PERSONAS) as AgentId[]).map((id) => {
            const p = PERSONAS[id];
            return (
              <li key={id} className="flex flex-col items-center text-center">
                <div
                  className="h-24 w-24 overflow-hidden rounded-full"
                  style={{ background: `radial-gradient(circle at 50% 30%, ${p.accent}66, #07080a 72%)`, boxShadow: `0 0 0 2px ${p.accent}88` }}
                >
                  <div className="h-full w-full translate-y-2 scale-[1.3]">
                    <Character agent={id} speaking={false} />
                  </div>
                </div>
                <p className="mt-2 text-sm font-semibold">{p.name}</p>
                <p className="text-[11px] font-medium" style={{ color: p.accent }}>{p.role}</p>
                <p className="mt-1 text-[11px] leading-snug text-white/55">{p.tagline}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="relative mt-10 flex flex-col items-center gap-3">
        <button
          onClick={() => onStart("camera")}
          disabled={starting}
          className="flex w-full max-w-sm items-center justify-center gap-2.5 rounded-full bg-[#34c759] py-4 text-[17px] font-bold text-black shadow-[0_10px_40px_rgba(52,199,89,0.35)] transition-transform active:scale-[0.98] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path d="M15 8.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1.5l5 3.5V5z" fill="currentColor" />
          </svg>
          {starting ? "Calling…" : "Start a video call"}
        </button>
        <button onClick={() => onStart("demo")} disabled={starting} className="text-sm text-white/70 underline-offset-4 hover:underline">
          No camera handy? Try the demo feed
        </button>
        {openCase && (
          <button onClick={openCase.onOpen} className="text-sm font-medium text-[#f5b301] underline-offset-4 hover:underline">
            Open your case file ({openCase.issues} issue{openCase.issues === 1 ? "" : "s"})
          </button>
        )}
        <p className="mt-2 text-center text-[11px] text-white/45">
          Informational, not legal advice · Photos auto-delete after 30 days
        </p>
      </div>
    </main>
  );
}
