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

export type TenantInfo = {
  tenant_name: string;
  unit_address: string;
  landlord_name: string;
  notice_date: string; // YYYY-MM-DD
  mode: "repair" | "repair_or_terminate";
  notes: string;
};

export type Deadline = { day: string; title: string; detail: string };

export type Draft = {
  id: string;
  mode: string;
  letter_text: string;
  complaint: {
    to: { office: string; phone: string; building_inspection_phone: string; note: string };
    description: string;
    conditions: { issue: string; severity: number; description: string }[];
  };
  deadlines: Deadline[];
  legal_help: { name: string; phone: string; url: string }[];
  model: string;
  approved: boolean;
};

export type Frame = {
  id: string;
  seq: number;
  room_guess: string;
  issues: Issue[];
  dismissed: number[];
  removed: boolean;
  model: string;
};

export type LedgerEntry = {
  seq: number;
  frame_id: string;
  sha256: string;
  client_sha256: string;
  received_at: string;
  captured_at: string | null;
  prev_hash: string;
  entry_hash: string;
};

export type Case = {
  id: string;
  created_at: string;
  frames: Frame[];
  ledger: LedgerEntry[];
  legal: LawyerResult | null;
  legal_refs: { frame_id: string; issue_index: number }[];
  draft: Draft | null;
};

export type Verification = {
  all_ok: boolean;
  verified_at: string;
  entries: { seq: number; frame_id: string; image_matches: boolean; matches_phone_hash: boolean; chain_ok: boolean }[];
};

async function call<T>(path: string, init: RequestInit | undefined, what: string): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `${what} failed (${res.status})`);
  }
  return res.json();
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const createCase = () => call<Case>("/api/cases", { method: "POST" }, "Starting a case");
export const getCase = (id: string) => call<Case>(`/api/cases/${id}`, undefined, "Loading the case");

export function addFrame(caseId: string, blob: Blob, sha256: string): Promise<{ frame: Frame; ledger_entry: LedgerEntry }> {
  const form = new FormData();
  form.append("frame", blob, "frame.jpg");
  form.append("client_sha256", sha256);
  form.append("captured_at", new Date().toISOString());
  return call(`/api/cases/${caseId}/frames`, { method: "POST", body: form }, "Inspector");
}

export const updateFrame = (caseId: string, frameId: string, patch: { removed?: boolean; dismissed?: number[] }) =>
  call<Case>(`/api/cases/${caseId}/frames/${frameId}`, json("PATCH", patch), "Updating the photo");

export const verifyCase = (caseId: string) => call<Verification>(`/api/cases/${caseId}/verify`, undefined, "Verify");
export const runLawyer = (caseId: string) => call<Case>(`/api/cases/${caseId}/lawyer`, { method: "POST" }, "Lawyer");
export const runAdvocate = (caseId: string, tenant: TenantInfo) =>
  call<Case>(`/api/cases/${caseId}/advocate`, json("POST", tenant), "Advocate");
export const approveDraft = (caseId: string, letterText: string) =>
  call<Case>(`/api/cases/${caseId}/approve`, json("POST", { letter_text: letterText }), "Approve");

export const frameImageUrl = (caseId: string, frameId: string) => `/api/cases/${caseId}/frames/${frameId}/image`;
export const exportUrl = (
  caseId: string,
  kind: "letter.pdf" | "complaint.pdf" | "deadlines.ics" | "evidence.json",
) => `/api/cases/${caseId}/export/${kind}`;

export async function getStatute(section: string): Promise<Statute> {
  return call(`/api/statutes/${encodeURIComponent(section)}`, undefined, `Loading § ${section}`);
}
