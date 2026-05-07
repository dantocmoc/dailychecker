import type { Task } from "./types";
import { authHeader, logout } from "./auth";

export interface PlanRequest {
  image_base64: string;
  mime_type: string;
  blurb: string;
  working_hours_start: string;
  working_hours_end: string;
  target_date: string;
  timezone: string;
}

export interface PlanResponse {
  existing_events: { title: string; start: string; end: string }[];
  tasks: Task[];
}

export async function generatePlan(req: PlanRequest): Promise<PlanResponse> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeader() },
    body: JSON.stringify(req),
  });
  if (res.status === 401) {
    logout();
    window.dispatchEvent(new CustomEvent("dopamine:auth-required"));
    throw new Error("Session expired, enter your PIN again.");
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) msg = data.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as PlanResponse;
  return {
    existing_events: data.existing_events ?? [],
    tasks: (data.tasks ?? []).map((t) => ({ ...t, source: "ai" as const })),
  };
}

export async function fileToBase64(
  file: File | Blob,
): Promise<{ data: string; mime_type: string }> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  const data = btoa(bin);
  const mime_type = file.type || "image/png";
  return { data, mime_type };
}
