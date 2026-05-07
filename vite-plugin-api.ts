import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { generatePlan, type GenerateRequest } from "./src/server/generate";

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

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

export function apiPlugin(env: Record<string, string>): Plugin {
  return {
    name: "dopamine-api",
    configureServer(server) {
      server.middlewares.use(
        "/api/generate",
        async (req, res, next) => {
          if (req.method !== "POST") return next();
          try {
            const apiKey = env.ANTHROPIC_API_KEY;
            const model = env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
            if (!apiKey) {
              return send(res, 500, {
                error: "ANTHROPIC_API_KEY missing in .env.local",
              });
            }
            const body = await readJson<GenerateRequest>(req);
            if (!body?.image_base64 || !body?.blurb) {
              return send(res, 400, {
                error: "image_base64 and blurb are required",
              });
            }
            const plan = await generatePlan(body, apiKey, model);
            return send(res, 200, plan);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[api/generate]", msg);
            return send(res, 500, { error: msg });
          }
        },
      );
    },
  };
}
