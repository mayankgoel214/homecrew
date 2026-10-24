export type Issue = {
  type: string;
  label: string;
  bbox: [number, number, number, number] | null; // normalized x, y, w, h
  region: string;
  severity: number;
  confidence: number;
  evidence_note: string;
  needs_human_check: boolean;
};

export type InspectResult = {
  room_guess: string;
  issues: Issue[];
  model: string;
  sha256: string;
  hash_match: boolean | null;
};

export async function inspectFrame(blob: Blob, sha256: string): Promise<InspectResult> {
  const form = new FormData();
  form.append("frame", blob, "frame.jpg");
  form.append("client_sha256", sha256);
  const res = await fetch("/api/inspect", { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Inspector failed (${res.status})`);
  }
  return res.json();
}

export type LegalFinding = {
  issue_index: number;
  issue_type: string;
  issue_label: string;
  statute_section: string;
  statute_title: string;
  statute_url: string;
  plain_english: string;
  statute_quote: string;
  quote_verified: boolean;
  is_eviction_defense: boolean;
  defense_reason: string;
  deadline_days: number;
  deadline_basis: string;
};

export type LawyerResult = {
  findings: LegalFinding[];
  lookups: string[];
  model: string;
  disclaimer: string;
};

export type Statute = { section: string; title: string; text: string; url: string; upcoming_change: string | null };

async function postJson<T>(path: string, body: unknown, what: string): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `${what} failed (${res.status})`);
  }
  return res.json();
}

export function lawyerReview(issues: Issue[]): Promise<LawyerResult> {
  return postJson("/api/lawyer", { issues }, "Lawyer");
}

export async function getStatute(section: string): Promise<Statute> {
  const res = await fetch(`/api/statutes/${encodeURIComponent(section)}`);
  if (!res.ok) throw new Error(`Couldn't load § ${section}`);
  return res.json();
}
