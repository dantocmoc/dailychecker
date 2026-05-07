function getCreds(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export function kvAvailable(): boolean {
  return !!getCreds();
}

export async function kvGet(key: string): Promise<string | null> {
  const creds = getCreds();
  if (!creds) return null;
  const res = await fetch(`${creds.url}/get/${encodeURIComponent(key)}`, {
    headers: { authorization: `Bearer ${creds.token}` },
  });
  if (!res.ok) {
    throw new Error(`Upstash GET ${key} failed: ${res.status}`);
  }
  const data = (await res.json()) as { result: string | null };
  return data.result;
}

export async function kvSet(key: string, value: string): Promise<void> {
  const creds = getCreds();
  if (!creds) throw new Error("KV creds missing");
  const res = await fetch(`${creds.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${creds.token}`,
      "content-type": "text/plain",
    },
    body: value,
  });
  if (!res.ok) {
    throw new Error(`Upstash SET ${key} failed: ${res.status}`);
  }
}
