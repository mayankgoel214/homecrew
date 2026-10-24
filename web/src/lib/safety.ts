// Mirrors api/app/safety.py so the emergency card can appear the instant someone says
// "I smell gas", before any request reaches the server or the model.

import type { Tier } from "@/lib/api";

export type EmergencyKind = "gas" | "co" | "fire" | "flood";

const SPOKEN: [EmergencyKind, RegExp][] = [
  ["gas", /\b(smell(s|ing)? (of )?gas|gas (leak|smell)|rotten eggs?)\b/i],
  ["co", /\b(carbon monoxide|co (alarm|detector) (is )?(going off|beeping|sounding))\b/i],
  ["fire", /\b(fire|flames?|sparks?|sparking|smoke coming|burning smell|smells? like burning)\b/i],
  ["flood", /\b(flood(ing|ed)?|water (is )?(pouring|gushing|everywhere)|burst pipe)\b/i],
];

export function emergencyIn(text: string): EmergencyKind | null {
  for (const [kind, re] of SPOKEN) if (re.test(text)) return kind;
  return null;
}

export const EMERGENCY: Record<EmergencyKind, { title: string; steps: string[] }> = {
  gas: {
    title: "Possible gas leak. Leave now.",
    steps: [
      "Get everyone out of the home right away.",
      "Don't flip light switches, unplug anything, or light a flame.",
      "Once you're outside and away from the building, call 911 or your gas company.",
      "Don't go back in until they say it's safe.",
    ],
  },
  co: {
    title: "Carbon monoxide danger. Get to fresh air.",
    steps: ["Get everyone, including pets, outside into fresh air now.", "Call 911 from outside.", "Don't go back in until responders say it's safe."],
  },
  fire: {
    title: "Fire or sparks. Get out.",
    steps: ["Get everyone out and close doors behind you.", "Call 911 from outside.", "Don't use water on electrical sparks or fire."],
  },
  flood: {
    title: "Active flooding. Stay safe.",
    steps: [
      "Stay out of standing water near outlets, cords or appliances.",
      "If you can reach it without touching water, close the main water shutoff.",
      "Call your landlord's emergency line, or 911 if anyone is in danger.",
      "Take photos once you're safe.",
    ],
  },
};

// Never color alone: every tier also has a glyph and a word (WCAG 1.4.1).
export const TIER: Record<Tier, { label: string; short: string; color: string; ink: string; glyph: string }> = {
  emergency: { label: "Emergency", short: "Emergency", color: "#FF6B5B", ink: "#1A0806", glyph: "!" },
  pro: { label: "Stop: call a licensed pro", short: "Call a pro", color: "#FFB454", ink: "#1A1206", glyph: "✋" },
  landlord: { label: "Landlord must fix", short: "Landlord fixes", color: "#7FB7FF", ink: "#06101A", glyph: "§" },
  diy: { label: "Safe to fix yourself", short: "Safe DIY", color: "#6FD39A", ink: "#061A0F", glyph: "✓" },
};

export const worstTier = (tiers: (Tier | undefined)[]): Tier | null => {
  const order: Tier[] = ["emergency", "pro", "landlord", "diy"];
  return order.find((t) => tiers.includes(t)) ?? null;
};
