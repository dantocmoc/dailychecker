import { storage } from "./storage";

export async function loginWithPin(pin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    let error = `Login failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) error = j.error;
    } catch {
      // ignore
    }
    return { ok: false, error };
  }
  const data = (await res.json()) as { token: string };
  storage.setAuthToken(data.token);
  return { ok: true };
}

export function logout() {
  storage.setAuthToken(null);
}

export function getToken(): string | null {
  return storage.getAuthToken();
}

export function authHeader(): Record<string, string> {
  const t = storage.getAuthToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}

export async function isAuthenticated(): Promise<boolean> {
  const t = storage.getAuthToken();
  if (!t) return false;
  // Try a no-op authenticated request to validate token still works.
  // We don't have a dedicated /api/me — instead trust the token until /api/generate rejects it.
  return true;
}
