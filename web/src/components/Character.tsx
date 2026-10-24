import { PERSONAS, type AgentId, type TradeId } from "@/lib/crew";

// The crew, drawn as SVG busts. Built the way good mascot art is built (big head, big eyes with a
// highlight, a few clean primitive shapes, one shared construction), so every character feels like
// part of the same set. Parts are parametric: the trade experts reuse them with different gear.
// The mouth opens while speaking and the eyes blink; both stop for reduced motion (globals.css).

type Hat = "hard" | "cap" | "beanie" | null;
type Hair = "bob" | "curls" | "swoop" | "crop" | "ponytail";
type Outfit = "vest" | "blazer" | "cardigan" | "overalls" | "jacket" | "coverall";

type Look = {
  skin: string;
  shade: string;
  hair: Hair;
  hairColor: string;
  hat: Hat;
  hatColor?: string;
  outfit: Outfit;
  main: string; // outfit main color
  trim: string; // outfit accent
  glasses?: boolean;
  earrings?: string;
};

const LOOKS: Record<AgentId, Look> = {
  inspector: { skin: "#E9B88E", shade: "#D49B70", hair: "bob", hairColor: "#3B2418", hat: "hard", hatColor: "#E7B85C", outfit: "vest", main: "#F0973A", trim: "#F6EAD3" },
  lawyer: { skin: "#8E5B3D", shade: "#76462C", hair: "swoop", hairColor: "#17120F", hat: null, outfit: "blazer", main: "#3F5C96", trim: "#8FB4FF", glasses: true },
  advocate: { skin: "#F3CDAB", shade: "#DFB08A", hair: "curls", hairColor: "#5A3420", hat: null, outfit: "cardigan", main: "#4C9F78", trim: "#E8F5EE", earrings: "#E0A83A" },
};

const EXPERT_LOOKS: Partial<Record<TradeId, Look>> = {
  plumber: { skin: "#B47A52", shade: "#9B6441", hair: "crop", hairColor: "#22170F", hat: "cap", hatColor: "#3D6FA8", outfit: "overalls", main: "#2F5A8C", trim: "#9CC3EA" },
  electrician: { skin: "#E3AE86", shade: "#CC9268", hair: "ponytail", hairColor: "#6A3A1E", hat: "hard", hatColor: "#E8C95A", outfit: "jacket", main: "#2B2A30", trim: "#E8C95A" },
  hvac: { skin: "#F0C4A0", shade: "#DAA681", hair: "crop", hairColor: "#8A5A30", hat: "beanie", hatColor: "#5E5A66", outfit: "jacket", main: "#B9473A", trim: "#F4D4CC" },
  pest: { skin: "#C48A5E", shade: "#AA7249", hair: "ponytail", hairColor: "#24180F", hat: "cap", hatColor: "#4E7F3D", outfit: "coverall", main: "#3F6E35", trim: "#CDE6BF" },
  locks: { skin: "#F2CFB4", shade: "#DDB394", hair: "swoop", hairColor: "#9C6B3A", hat: null, outfit: "jacket", main: "#5B4A6E", trim: "#C4A3E0" },
  mold: { ...LOOKS.inspector, hatColor: "#7CCBC0", main: "#3E9A8E", trim: "#E3F4F1" },
};

function BackHair({ l }: { l: Look }) {
  const c = l.hairColor;
  switch (l.hair) {
    case "bob":
      return <path d="M42 98C38 58 64 32 100 32s62 26 58 66v34c-5 12-17 13-22 4V102H64v34c-5 9-17 8-22-4z" fill={c} />;
    case "curls":
      return (
        <g fill={c}>
          {[[50, 100, 21], [56, 70, 23], [76, 46, 23], [100, 38, 25], [124, 46, 23], [144, 70, 23], [150, 100, 21], [50, 128, 17], [150, 128, 17], [62, 146, 12], [138, 146, 12]].map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
          ))}
        </g>
      );
    case "ponytail":
      return <path d="M146 92c18 6 26 30 18 52-4 10-14 12-16 2 8-16 4-34-8-42z" fill={c} />;
    default:
      return null;
  }
}

function FrontHair({ l }: { l: Look }) {
  const c = l.hairColor;
  switch (l.hair) {
    case "swoop":
      return <path d="M46 92C42 54 68 34 102 34c34 0 58 20 52 56-6-18-22-28-44-28-16 0-28 6-40 4-10 6-18 16-24 26z" fill={c} />;
    case "crop":
      return <path d="M48 90C46 56 70 38 100 38s54 18 52 52c-8-14-24-22-52-22S56 76 48 90z" fill={c} />;
    case "curls":
      return (
        <g fill={c} opacity="0.92">
          {[[78, 56, 16], [100, 50, 17], [122, 56, 16]].map(([x, y, r]) => <circle key={x} cx={x} cy={y} r={r} />)}
        </g>
      );
    case "ponytail":
      return <path d="M48 92C46 54 70 36 100 36s54 18 52 54c-12-12-30-20-52-20-20 0-40 8-52 22z" fill={c} />;
    default:
      return null; // bob is fully behind the hat
  }
}

function Hat({ l }: { l: Look }) {
  const c = l.hatColor ?? "#888";
  switch (l.hat) {
    case "hard":
      return (
        <g>
          <path d="M40 86C40 46 66 24 100 24s60 22 60 62z" fill={c} />
          <path d="M58 70c4-20 20-33 40-35" stroke="#fff" strokeOpacity="0.35" strokeWidth="7" strokeLinecap="round" fill="none" />
          <rect x="93" y="26" width="14" height="60" rx="7" fill="#000" fillOpacity="0.12" />
          <rect x="30" y="80" width="140" height="14" rx="7" fill={c} />
          <rect x="30" y="88" width="140" height="6" rx="3" fill="#000" fillOpacity="0.15" />
        </g>
      );
    case "cap":
      return (
        <g>
          <path d="M44 84C44 50 68 30 100 30s56 20 56 54z" fill={c} />
          <path d="M44 82h120c14 0 18 10 6 12H44z" fill={c} />
          <path d="M44 88h126" stroke="#000" strokeOpacity="0.15" strokeWidth="4" />
          <circle cx="100" cy="32" r="5" fill="#000" fillOpacity="0.15" />
        </g>
      );
    case "beanie":
      return (
        <g>
          <path d="M44 88C42 48 68 26 100 26s58 22 56 62z" fill={c} />
          <rect x="40" y="76" width="120" height="20" rx="10" fill={c} />
          <path d="M52 86h96" stroke="#000" strokeOpacity="0.15" strokeWidth="3" strokeDasharray="6 5" />
          <circle cx="100" cy="22" r="9" fill={c} />
        </g>
      );
    default:
      return null;
  }
}

function Body({ l }: { l: Look }) {
  const { main, trim } = l;
  const base = <path d="M24 220c2-42 32-62 76-62s74 20 76 62z" />;
  switch (l.outfit) {
    case "vest":
      return (
        <g>
          <g fill="#2E2B33">{base}</g>
          <path d="M24 220c2-38 24-56 52-60l12 60zM176 220c-2-38-24-56-52-60l-12 60z" fill={main} />
          <path d="M34 200l46-6M166 200l-46-6" stroke={trim} strokeWidth="7" strokeLinecap="round" />
          <path d="M84 160l16 22 16-22" fill="none" stroke="#000" strokeOpacity="0.2" strokeWidth="3" />
        </g>
      );
    case "blazer":
      return (
        <g>
          <g fill={main}>{base}</g>
          <path d="M80 160l20 40 20-40z" fill="#F5F2EC" />
          <path d="M95 168h10l4 40-9 10-9-10z" fill={trim} />
          <path d="M80 160l20 40-28 20H54zM120 160l-20 40 28 20h18z" fill="#000" fillOpacity="0.18" />
        </g>
      );
    case "cardigan":
      return (
        <g>
          <g fill={main}>{base}</g>
          <path d="M82 160l18 26 18-26z" fill={trim} />
          <path d="M84 162l12 58M116 162l-12 58" stroke="#000" strokeOpacity="0.15" strokeWidth="4" />
          <path d="M88 166l12 34 12-34" stroke="#E0A83A" strokeWidth="2.5" fill="none" />
          <rect x="90" y="198" width="20" height="16" rx="3" fill="#FBF8F2" />
          <rect x="94" y="203" width="12" height="3" rx="1.5" fill={main} />
        </g>
      );
    case "overalls":
      return (
        <g>
          <g fill={trim}>{base}</g>
          <path d="M62 220v-42h76v42z" fill={main} />
          <path d="M62 180l-8-18M138 180l8-18" stroke={main} strokeWidth="10" strokeLinecap="round" />
          <circle cx="68" cy="186" r="3.5" fill="#E0C27A" />
          <circle cx="132" cy="186" r="3.5" fill="#E0C27A" />
        </g>
      );
    case "coverall":
      return (
        <g>
          <g fill={main}>{base}</g>
          <path d="M84 160l16 20 16-20" fill={trim} />
          <path d="M100 180v40" stroke="#000" strokeOpacity="0.18" strokeWidth="3" />
          <rect x="116" y="190" width="24" height="14" rx="3" fill="#000" fillOpacity="0.15" />
        </g>
      );
    default: // jacket
      return (
        <g>
          <g fill={main}>{base}</g>
          <path d="M84 160l16 22 16-22" fill="#1E1C22" />
          <path d="M100 182v38" stroke={trim} strokeWidth="4" />
          <path d="M56 196h22M122 196h22" stroke={trim} strokeWidth="5" strokeLinecap="round" />
        </g>
      );
  }
}

export default function Character({ agent, speaking, trade }: { agent: AgentId; speaking: boolean; trade?: TradeId }) {
  const expert = agent === "inspector" ? EXPERT_LOOKS[trade ?? PERSONAS.inspector.trade ?? "general"] : undefined;
  const l = expert ?? LOOKS[agent];

  return (
    <svg viewBox="0 0 200 220" className="h-full w-full" aria-hidden>
      <BackHair l={l} />
      <Body l={l} />
      <rect x="86" y="132" width="28" height="36" rx="13" fill={l.shade} />
      <ellipse cx="46" cy="104" rx="9" ry="12" fill={l.shade} />
      <ellipse cx="154" cy="104" rx="9" ry="12" fill={l.shade} />
      <ellipse cx="100" cy="96" rx="54" ry="57" fill={l.skin} />
      {/* soft shading on one side of the face */}
      <path d="M150 100c0 32-22 52-50 53 22-8 38-28 40-56z" fill={l.shade} opacity="0.55" />
      <FrontHair l={l} />
      <Hat l={l} />
      {l.earrings && (
        <g fill={l.earrings}>
          <circle cx="46" cy="120" r="4" />
          <circle cx="154" cy="120" r="4" />
        </g>
      )}
      {/* brows */}
      <path d="M68 84q11-7 22-1M110 83q11-6 22 1" stroke={l.hairColor} strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* eyes: big, dark, with a highlight. That's most of the charm. */}
      <g className="crew-eyes">
        <ellipse cx="80" cy="102" rx="8" ry="10" fill="#1B1411" />
        <ellipse cx="120" cy="102" rx="8" ry="10" fill="#1B1411" />
        <circle cx="83" cy="98" r="3" fill="#fff" />
        <circle cx="123" cy="98" r="3" fill="#fff" />
        <circle cx="78" cy="106" r="1.3" fill="#fff" opacity="0.7" />
        <circle cx="118" cy="106" r="1.3" fill="#fff" opacity="0.7" />
      </g>
      {l.glasses && (
        <g stroke="#1B1B21" strokeWidth="4" fill="#fff" fillOpacity="0.06">
          <circle cx="80" cy="102" r="16" />
          <circle cx="120" cy="102" r="16" />
          <path d="M96 100q4-3 8 0" fill="none" />
        </g>
      )}
      <path d="M98 110q3 9 8 6" stroke={l.shade} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <ellipse cx="66" cy="122" rx="10" ry="6" fill="#FF7E7E" opacity="0.22" />
      <ellipse cx="134" cy="122" rx="10" ry="6" fill="#FF7E7E" opacity="0.22" />
      {speaking ? (
        <g className="crew-mouth crew-mouth-talking">
          <ellipse cx="100" cy="131" rx="11" ry="8" fill="#4A1E19" />
          <ellipse cx="100" cy="135" rx="6" ry="3.5" fill="#E86B6B" />
        </g>
      ) : (
        <path d="M87 127q13 11 26 0" stroke="#4A1E19" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}
