// Shared look for every section, matching the crew call: dark rounded panels, each section owned
// by one crew member (their face, name and accent color), and one consistent button style.

import Character from "@/components/Character";
import { PERSONAS, type AgentId } from "@/lib/crew";

export function Panel({
  agent,
  labelledBy,
  children,
}: {
  agent?: AgentId;
  labelledBy: string;
  children: React.ReactNode;
}) {
  const accent = agent ? PERSONAS[agent].accent : "#525252";
  return (
    <section
      aria-labelledby={labelledBy}
      className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      {children}
    </section>
  );
}

export function SectionHeader({
  agent,
  id,
  title,
  subtitle,
  aside,
}: {
  agent: AgentId;
  id: string;
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
}) {
  const p = PERSONAS[agent];
  return (
    <header className="mb-3 flex items-start gap-3">
      <div
        aria-hidden
        className="h-11 w-11 shrink-0 overflow-hidden rounded-full"
        style={{ background: `radial-gradient(circle at 50% 30%, ${p.accent}55, #0a0a0a 75%)`, boxShadow: `0 0 0 2px ${p.accent}66` }}
      >
        <div className="h-full w-full translate-y-1 scale-[1.35]">
          <Character agent={agent} speaking={false} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: p.accent }}>
          {p.name} · {p.role}
        </p>
        <h2 id={id} className="text-lg font-semibold leading-tight text-white">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-neutral-400">{subtitle}</p>}
      </div>
      {aside}
    </header>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  accent?: string;
};

export function Button({ variant = "primary", accent = "#ffffff", className = "", style, ...rest }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-[transform,opacity] " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white " +
    "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
  const look = {
    primary: "px-4 py-3 text-black",
    secondary: "border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-neutral-100 hover:border-neutral-500",
    ghost: "px-2 py-1 text-neutral-300 underline-offset-4 hover:underline",
  }[variant];
  return (
    <button
      className={`${base} ${look} ${className}`}
      style={variant === "primary" ? { background: accent, ...style } : style}
      {...rest}
    />
  );
}

export function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: `${color}22`, color, boxShadow: `inset 0 0 0 1px ${color}55` }}
    >
      {children}
    </span>
  );
}

export function Icon({ name, className = "h-4 w-4" }: { name: "check" | "x" | "calendar" | "file" | "shield" | "download" | "phone" | "book"; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    check: <path d="M5 12l4 4L19 6" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
    file: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></>,
    shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
    download: <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" />,
    phone: <path d="M6 3h3l2 5-2.5 1.5a11 11 0 005 5L15 12l5 2v3a2 2 0 01-2 2A15 15 0 014 5a2 2 0 012-2z" />,
    book: <path d="M5 4h9a3 3 0 013 3v13H8a3 3 0 01-3-3zM17 20H8" />,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}
