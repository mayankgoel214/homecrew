import { PERSONAS, type AgentId, type TradeId } from "@/lib/crew";

// Hand-drawn SVG portraits. The mouth animates while the character is speaking and the eyes
// blink on their own (both switched off for people who prefer reduced motion, see globals.css).

type Look = {
  skin: string;
  skinShade: string;
  hairBack?: React.ReactNode;
  hairFront?: React.ReactNode;
  hat?: React.ReactNode;
  outfit: React.ReactNode;
  glasses?: boolean;
};

const LOOKS: Record<AgentId, Look> = {
  inspector: {
    skin: "#c98b5e",
    skinShade: "#b57a4f",
    hairBack: <path d="M60 120 C56 150 66 168 78 172 L76 120 Z M140 120 C146 150 136 168 124 172 L124 120 Z" fill="#3b2416" />,
    hat: (
      <g>
        <path d="M54 100 C54 62 76 44 100 44 C124 44 146 62 146 100 Z" fill="#f5b301" />
        <rect x="95" y="46" width="10" height="54" rx="4" fill="#dd9c00" />
        <rect x="42" y="94" width="116" height="12" rx="6" fill="#dd9c00" />
      </g>
    ),
    outfit: (
      <g>
        <path d="M18 240 C18 200 54 180 100 180 C146 180 182 200 182 240 Z" fill="#3a3f47" />
        <path d="M18 240 C18 204 44 186 74 182 L86 240 Z M182 240 C182 204 156 186 126 182 L114 240 Z" fill="#f97316" />
        <rect x="30" y="214" width="50" height="7" rx="2" fill="#e5e7eb" opacity="0.9" transform="rotate(-8 55 217)" />
        <rect x="120" y="214" width="50" height="7" rx="2" fill="#e5e7eb" opacity="0.9" transform="rotate(8 145 217)" />
      </g>
    ),
  },
  lawyer: {
    skin: "#8d5a3b",
    skinShade: "#7a4c31",
    hairFront: (
      <path d="M57 108 C52 66 78 56 100 56 C126 56 150 66 143 108 C139 88 126 78 100 78 C78 78 62 88 57 108 Z" fill="#161616" />
    ),
    glasses: true,
    outfit: (
      <g>
        <path d="M18 240 C18 200 54 180 100 180 C146 180 182 200 182 240 Z" fill="#1e3a5f" />
        <path d="M80 182 L100 222 L120 182 Z" fill="#f8fafc" />
        <path d="M95 190 L105 190 L108 226 L100 236 L92 226 Z" fill="#0ea5e9" />
        <path d="M80 182 L100 222 L70 240 L56 240 Z M120 182 L100 222 L130 240 L144 240 Z" fill="#17304f" />
      </g>
    ),
  },
  advocate: {
    skin: "#f1c9a5",
    skinShade: "#e0b48e",
    hairBack: (
      <g fill="#6b3f1d">
        {[
          [58, 92, 20], [72, 70, 20], [94, 60, 21], [118, 62, 20], [138, 76, 20], [146, 100, 18],
          [54, 116, 16], [148, 124, 16], [60, 140, 14], [142, 146, 14],
        ].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    ),
    hairFront: (
      <g fill="#7a4a24">
        <circle cx="80" cy="76" r="13" />
        <circle cx="100" cy="70" r="13" />
        <circle cx="120" cy="76" r="13" />
      </g>
    ),
    outfit: (
      <g>
        <path d="M18 240 C18 200 54 180 100 180 C146 180 182 200 182 240 Z" fill="#047857" />
        <path d="M84 182 L100 204 L116 182 Z" fill="#d1fae5" />
        <path d="M84 184 L96 240 M116 184 L104 240" stroke="#065f46" strokeWidth="4" />
        <path d="M90 186 L100 214 L110 186" stroke="#fbbf24" strokeWidth="2.5" fill="none" />
        <rect x="91" y="212" width="18" height="22" rx="3" fill="#f8fafc" />
        <rect x="95" y="217" width="10" height="3" rx="1" fill="#047857" />
      </g>
    ),
  },
};

// The expert in the inspector's seat changes outfit with the trade.
const HAIR_SHORT = (
  <path d="M57 108 C52 68 76 58 100 58 C124 58 148 68 143 108 C138 90 126 80 100 80 C76 80 62 90 57 108 Z" fill="#2b1d14" />
);
const cap = (color: string) => (
  <g>
    <path d="M56 96 C56 64 78 52 100 52 C122 52 144 64 144 96 Z" fill={color} />
    <path d="M58 94 L150 94 C162 95 166 101 160 104 L58 102 Z" fill={color} opacity="0.85" />
  </g>
);
const beanie = (color: string) => (
  <g>
    <path d="M56 100 C54 60 78 48 100 48 C122 48 146 60 144 100 Z" fill={color} />
    <rect x="52" y="90" width="96" height="14" rx="7" fill={color} opacity="0.8" />
  </g>
);
const outfit = (color: string, trim: string) => (
  <g>
    <path d="M18 240 C18 200 54 180 100 180 C146 180 182 200 182 240 Z" fill={color} />
    <path d="M84 182 L100 206 L116 182 Z" fill={trim} />
    <rect x="70" y="200" width="10" height="40" fill={trim} opacity="0.5" />
    <rect x="120" y="200" width="10" height="40" fill={trim} opacity="0.5" />
  </g>
);
const EXPERT_LOOKS: Partial<Record<TradeId, Look>> = {
  plumber: { skin: "#a8724d", skinShade: "#946344", hairFront: HAIR_SHORT, hat: cap("#2563eb"), outfit: outfit("#1e40af", "#93c5fd") },
  electrician: { ...LOOKS.inspector, outfit: outfit("#1f2937", "#facc15") },
  hvac: { skin: "#e8b48f", skinShade: "#d49f7a", hairFront: HAIR_SHORT, hat: beanie("#4b5563"), outfit: outfit("#b91c1c", "#fecaca") },
  pest: { ...LOOKS.inspector, skin: "#c08457", skinShade: "#ab744b", hat: cap("#15803d"), outfit: outfit("#166534", "#bbf7d0") },
  locks: { skin: "#f0c8a8", skinShade: "#dcb090", hairFront: HAIR_SHORT, outfit: outfit("#78350f", "#fde68a") },
  mold: { ...LOOKS.inspector, outfit: outfit("#0f766e", "#99f6e4") },
};

export default function Character({ agent, speaking, trade }: { agent: AgentId; speaking: boolean; trade?: TradeId }) {
  const expert = agent === "inspector" ? EXPERT_LOOKS[trade ?? PERSONAS.inspector.trade ?? "general"] : undefined;
  const look = expert ?? LOOKS[agent];
  return (
    <svg viewBox="0 0 200 240" className="h-full w-full" aria-hidden>
      {look.hairBack}
      {look.outfit}
      <rect x="86" y="148" width="28" height="40" rx="12" fill={look.skinShade} />
      <circle cx="56" cy="120" r="9" fill={look.skinShade} />
      <circle cx="144" cy="120" r="9" fill={look.skinShade} />
      <ellipse cx="100" cy="116" rx="44" ry="50" fill={look.skin} />
      {look.hairFront}
      {look.hat}
      <g className="crew-eyes">
        <ellipse cx="83" cy="116" rx="4.5" ry="5.5" fill="#1c1917" />
        <ellipse cx="117" cy="116" rx="4.5" ry="5.5" fill="#1c1917" />
      </g>
      <path d="M75 104 Q83 100 91 104 M109 104 Q117 100 125 104" stroke="#2a1d14" strokeWidth="3" strokeLinecap="round" fill="none" />
      {look.glasses && (
        <g stroke="#0f0f0f" strokeWidth="3" fill="none">
          <circle cx="83" cy="116" r="12" />
          <circle cx="117" cy="116" r="12" />
          <path d="M95 115 L105 115" />
        </g>
      )}
      <circle cx="74" cy="134" r="7" fill="#f472b6" opacity="0.18" />
      <circle cx="126" cy="134" r="7" fill="#f472b6" opacity="0.18" />
      <ellipse className={speaking ? "crew-mouth crew-mouth-talking" : "crew-mouth"} cx="100" cy="143" rx="10" ry="6" fill="#5b2323" />
    </svg>
  );
}
