import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { generatePlan, type GenerateRequest } from "./src/server/generate";
import {
  checkLockout,
  clearAttempts,
  extractBearer,
  getClientIp,
  issueToken,
  recordFailedAttempt,
  verifyToken,
} from "./api/_lib/auth";

function readJson<T = unknown>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw) as T);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function ipFromReq(req: IncomingMessage): string {
  return getClientIp(req.headers as Record<string, string | string[] | undefined>);
}

export function apiPlugin(env: Record<string, string>): Plugin {
  // Mirror env into process.env so jose / generate helpers see it.
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  if (env.ANTHROPIC_MODEL) process.env.ANTHROPIC_MODEL = env.ANTHROPIC_MODEL;
  if (env.APP_PIN) process.env.APP_PIN = env.APP_PIN;
  if (env.JWT_SECRET) process.env.JWT_SECRET = env.JWT_SECRET;

  return {
    name: "dopamine-api",
    configureServer(server) {
      server.middlewares.use("/api/auth", async (req, res, next) => {
        if (req.method !== "POST") return next();
        try {
          const appPin = process.env.APP_PIN;
          if (!appPin) return send(res, 500, { error: "APP_PIN not configured" });
          const ip = ipFromReq(req);
          const lockout = checkLockout(ip);
          if (lockout.locked) {
            const m = Math.ceil((lockout.retryInMs ?? 0) / 60_000);
            return send(res, 429, { error: `Too many attempts. Try again in ${m}m.` });
          }
          const body = await readJson<{ pin?: string }>(req);
          const pin = (body?.pin ?? "").toString();
          if (!/^\d{4}$/.test(pin)) {
            return send(res, 400, { error: "PIN must be 4 digits" });
          }
          if (pin !== appPin) {
            const r = recordFailedAttempt(ip);
            if (r.locked) {
              return send(res, 429, { error: "Locked out for 15 minutes." });
            }
            return send(res, 401, {
              error: `Wrong PIN. ${r.remainingAttempts} attempts left.`,
            });
          }
          clearAttempts(ip);
          const token = await issueToken();
          return send(res, 200, { token });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[api/auth]", msg);
          return send(res, 500, { error: msg });
        }
      });

      server.middlewares.use("/api/generate", async (req, res, next) => {
        if (req.method !== "POST") return next();
        try {
          const auth = req.headers["authorization"];
          const token = extractBearer(auth);
          const ok = await verifyToken(token);
          if (!ok) return send(res, 401, { error: "Unauthorized" });

          const apiKey = process.env.ANTHROPIC_API_KEY;
          const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
          if (!apiKey) return send(res, 500, { error: "ANTHROPIC_API_KEY missing" });

          const body = await readJson<GenerateRequest>(req);
          if (!body?.image_base64 || !body?.blurb) {
            return send(res, 400, { error: "image_base64 and blurb are required" });
          }
          const plan = await generatePlan(body, apiKey, model);
          return send(res, 200, plan);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[api/generate]", msg);
          return send(res, 500, { error: msg });
        }
      });
    },
  };
}
