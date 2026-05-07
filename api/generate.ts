import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractBearer, verifyToken } from "./_lib/auth";
import { generatePlan, type GenerateRequest } from "../src/server/generate";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const auth = req.headers.authorization;
  const token = extractBearer(auth);
  const ok = await verifyToken(token);
  if (!ok) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY missing" });
    return;
  }

  let body: GenerateRequest;
  try {
    body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : (req.body as GenerateRequest);
  } catch {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  if (!body?.image_base64 || !body?.blurb) {
    res.status(400).json({ error: "image_base64 and blurb are required" });
    return;
  }

  try {
    const plan = await generatePlan(body, apiKey, model);
    res.status(200).json(plan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/generate]", msg);
    res.status(500).json({ error: msg });
  }
}
