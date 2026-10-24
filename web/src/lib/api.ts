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
