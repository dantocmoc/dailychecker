import { SignJWT, jwtVerify } from "jose";

const ISSUER = "dopamine-todo";
const AUDIENCE = "dopamine-todo";
const TOKEN_TTL_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET env var missing");
  }
  return new TextEncoder().encode(secret);
}

export async function issueToken(): Promise<string> {
  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_DAYS}d`)
    .sign(getSecret());
}

export async function verifyToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return true;
  } catch {
    return false;
  }
}

export function extractBearer(headerValue: string | string[] | undefined): string | null {
  if (!headerValue) return null;
  const v = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof v !== "string") return null;
  if (v.startsWith("Bearer ")) return v.slice(7);
  return null;
}

const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
type AttemptState = { count: number; firstAttempt: number; lockedUntil?: number };
const attempts: Map<string, AttemptState> = (globalThis as unknown as {
  __dopamineAttempts?: Map<string, AttemptState>;
}).__dopamineAttempts ??
  ((globalThis as unknown as { __dopamineAttempts?: Map<string, AttemptState> }).__dopamineAttempts =
    new Map());

export function checkLockout(ip: string): { locked: boolean; retryInMs?: number } {
  const s = attempts.get(ip);
  if (!s?.lockedUntil) return { locked: false };
  const remaining = s.lockedUntil - Date.now();
  if (remaining <= 0) {
    attempts.delete(ip);
    return { locked: false };
  }
  return { locked: true, retryInMs: remaining };
}

export function recordFailedAttempt(ip: string): { locked: boolean; remainingAttempts: number } {
  const now = Date.now();
  const s = attempts.get(ip) ?? { count: 0, firstAttempt: now };
  if (now - s.firstAttempt > LOCKOUT_MS) {
    s.count = 0;
    s.firstAttempt = now;
  }
  s.count += 1;
  if (s.count >= MAX_ATTEMPTS) {
    s.lockedUntil = now + LOCKOUT_MS;
  }
  attempts.set(ip, s);
  return {
    locked: !!s.lockedUntil,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - s.count),
  };
}

export function clearAttempts(ip: string) {
  attempts.delete(ip);
}

export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const xff = headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff[0]) return xff[0].split(",")[0].trim();
  const real = headers["x-real-ip"];
  if (typeof real === "string") return real;
  return "unknown";
}
