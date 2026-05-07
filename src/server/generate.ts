import { v4 as uuidv4 } from "uuid";

export interface GenerateRequest {
  image_base64: string;
  mime_type: string;
  blurb: string;
  working_hours_start: string;
  working_hours_end: string;
  target_date: string;
  timezone: string;
}

export interface ExistingEvent {
  title: string;
  start: string;
  end: string;
}

export interface GeneratedTask {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  priority: 1 | 2 | 3;
  energy: "deep" | "shallow" | "admin";
  suggested_start: string;
  suggested_end: string;
}

export interface GenerateResponse {
  existing_events: ExistingEvent[];
  tasks: GeneratedTask[];
}

const SYSTEM = `You are a personal scheduling assistant. You help one user time-block their day around their existing calendar.

Your responses are JSON only. No preamble, no markdown fences, no commentary. Output a single JSON object.`;

function buildUserPrompt(req: GenerateRequest) {
  return `I need a time-blocked plan for ${req.target_date} in timezone ${req.timezone}.

Working hours: ${req.working_hours_start} to ${req.working_hours_end}.

Step 1: Look at the calendar screenshot and extract every existing scheduled event with its start and end time. Treat these as immovable.

Step 2: Read this blurb of stuff I want to get done today:
"""
${req.blurb}
"""

Extract one task per discrete action. Estimate duration sensibly:
- email or messaging tasks: 15 minutes
- quick calls or check-ins: 30 minutes
- deep work, writing, strategy, problem solving: 60 to 90 minutes
- gym or exercise: 60 minutes
- admin or errands: 15 to 30 minutes

Assign priority (1 highest, 3 lowest):
- 1 if I used words like "must", "urgent", "deadline", "critical"
- 3 if I used words like "if I get time", "maybe", "nice to have"
- 2 otherwise

Assign energy:
- "deep" for focused cognitive work, writing, strategy
- "shallow" for calls, meetings, lighter coordination
- "admin" for errands, life admin, quick replies

Step 3: Schedule each task into a free slot during my working hours that does not overlap any existing event. Front-load deep work in the morning where possible. Leave at least a 5 minute gap between back-to-back blocks where you can.

All datetimes must be ISO 8601 with the correct timezone offset for ${req.timezone} on ${req.target_date}.

Return EXACTLY this JSON shape, nothing else:

{
  "existing_events": [
    { "title": "string", "start": "ISO datetime", "end": "ISO datetime" }
  ],
  "tasks": [
    {
      "title": "string",
      "description": "string short, optional, one sentence at most",
      "duration_minutes": number,
      "priority": 1,
      "energy": "deep",
      "suggested_start": "ISO datetime",
      "suggested_end": "ISO datetime"
    }
  ]
}`;
}

export async function generatePlan(
  req: GenerateRequest,
  apiKey: string,
  model: string,
): Promise<GenerateResponse> {
  const body = {
    model,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: req.mime_type,
              data: req.image_base64,
            },
          },
          { type: "text", text: buildUserPrompt(req) },
        ],
      },
    ],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content.find((c) => c.type === "text");
  if (!textBlock?.text) {
    throw new Error("No text response from model");
  }

  const raw = textBlock.text.trim();
  const jsonStr = stripFences(raw);
  let parsed: { existing_events?: ExistingEvent[]; tasks?: Omit<GeneratedTask, "id">[] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Model returned invalid JSON: ${(err as Error).message}\n\n${raw.slice(0, 500)}`);
  }

  const tasks: GeneratedTask[] = (parsed.tasks ?? []).map((t) => ({
    id: uuidv4(),
    title: t.title ?? "Untitled task",
    description: t.description ?? "",
    duration_minutes: Number(t.duration_minutes) || 30,
    priority: clampPriority(t.priority),
    energy: clampEnergy(t.energy),
    suggested_start: t.suggested_start,
    suggested_end: t.suggested_end,
  }));

  return {
    existing_events: parsed.existing_events ?? [],
    tasks,
  };
}

function stripFences(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  return s;
}

function clampPriority(p: unknown): 1 | 2 | 3 {
  const n = Number(p);
  if (n === 1 || n === 3) return n;
  return 2;
}

function clampEnergy(e: unknown): "deep" | "shallow" | "admin" {
  if (e === "deep" || e === "admin") return e;
  return "shallow";
}
