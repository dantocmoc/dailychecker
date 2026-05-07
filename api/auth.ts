import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  checkLockout,
  clearAttempts,
  getClientIp,
  issueToken,
  recordFailedAttempt,
} from "./_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const appPin = process.env.APP_PIN;
  if (!appPin) {
    res.status(500).json({ error: "APP_PIN not configured" });
    return;
  }

  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const lockout = checkLockout(ip);
  if (lockout.locked) {
    const minutes = Math.ceil((lockout.retryInMs ?? 0) / 60_000);
    res.status(429).json({ error: `Too many attempts. Try again in ${minutes}m.` });
    return;
  }

  let body: { pin?: string } = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const pin = (body.pin ?? "").toString();
  if (!/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: "PIN must be 4 digits" });
    return;
  }

  if (pin !== appPin) {
    const result = recordFailedAttempt(ip);
    if (result.locked) {
      res.status(429).json({ error: "Locked out for 15 minutes." });
      return;
    }
    res.status(401).json({
      error: `Wrong PIN. ${result.remainingAttempts} attempts left.`,
    });
    return;
  }

  clearAttempts(ip);
  const token = await issueToken();
  res.status(200).json({ token });
}
