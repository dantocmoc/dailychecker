import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractBearer, verifyToken } from "./_lib/auth.js";
import { kvAvailable, kvGet, kvSet } from "./_lib/kv.js";

const STATE_KEY = "dopamine:state";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization;
  const token = extractBearer(auth);
  const ok = await verifyToken(token);
  if (!ok) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!kvAvailable()) {
    res.status(503).json({ error: "Sync not configured" });
    return;
  }

  if (req.method === "GET") {
    try {
      const raw = await kvGet(STATE_KEY);
      if (!raw) {
        res.status(200).json({ state: null });
        return;
      }
      try {
        const state = JSON.parse(raw);
        res.status(200).json({ state });
      } catch {
        res.status(200).json({ state: null });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[api/state GET]", msg);
      res.status(500).json({ error: msg });
    }
    return;
  }

  if (req.method === "PUT") {
    let body: { version?: number; data?: Record<string, unknown> };
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    if (!body || typeof body !== "object" || typeof body.version !== "number") {
      res.status(400).json({ error: "Body must include {version, data}" });
      return;
    }
    try {
      await kvSet(STATE_KEY, JSON.stringify(body));
      res.status(200).json({ ok: true, version: body.version });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[api/state PUT]", msg);
      res.status(500).json({ error: msg });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
