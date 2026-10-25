// Shared pieces of the "Site visit" design (docs/design.md): tonal surfaces with hairlines, no
// shadows at rest, a 4/8/12 radius scale, Fraunces for display, Plex for UI, mono for evidence.

import CrewBadge from "@/components/CrewBadge";
import { PERSONAS, type AgentId } from "@/lib/crew";
import type { Tier } from "@/lib/api";
import { TIER } from "@/lib/safety";

export function Panel({ labelledBy, children, className = "" }: { labelledBy: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={`rounded-lg border border-hair bg-surface-1 p-4 ${className}`}>
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
    <header className="mb-4 flex items-start gap-3">
      <CrewBadge agent={agent} size={40} />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] text-ink-3">
          <span style={{ color: p.accent }}>{p.name}</span> · {p.role.toLowerCase()}
        </p>
        <h2 id={id} className="font-display text-[22px] font-medium leading-tight tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-[13px] leading-snug text-ink-2">{subtitle}</p>}
      </div>
      {aside}
    </header>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  accent?: string;
};

export function Button({ variant = "primary", accent, className = "", style, ...rest }: ButtonProps) {
  const look = {
    primary: "bg-brass text-brass-ink px-4 py-3 font-semibold",
    secondary: "border border-hair-strong bg-surface-2 px-4 py-2.5 font-medium text-ink hover:bg-surface-3",
    ghost: "px-2 py-1 text-ink-2 underline-offset-4 hover:text-ink hover:underline",
  }[variant];
  return (
    <button
      className={`tap inline-flex items-center justify-center gap-2 rounded-md text-sm disabled:cursor-not-allowed disabled:opacity-40 ${look} ${className}`}
      style={variant === "primary" && accent ? { background: accent, ...style } : style}
      {...rest}
    />
  );
}

const TINY: Record<Tier, string> = { emergency: "Emergency", pro: "Pro", landlord: "Landlord", diy: "DIY" };

/** Safety tier tag: color + glyph + word, never color alone. */
export function TierTag({ tier, size = "md" }: { tier: Tier; size?: "sm" | "md" }) {
  const t = TIER[tier];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm font-mono font-medium ${size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"}`}
      style={{ background: t.color, color: t.ink }}
      title={t.label}
    >
      <span aria-hidden>{t.glyph}</span>
      {size === "sm" ? TINY[tier] : t.short}
      {size === "sm" && <span className="sr-only">: {t.label}</span>}
    </span>
  );
}

export function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[11px]" style={{ borderColor: `${color}66`, color }}>
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
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}
