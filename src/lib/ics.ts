import { createEvents, type EventAttributes } from "ics";
import type { Task } from "./types";
import { storage } from "./storage";

const PRIORITY_EMOJI: Record<1 | 2 | 3, string> = {
  1: "🔥",
  2: "•",
  3: "·",
};

function toDateArray(iso: string): [number, number, number, number, number] {
  const d = new Date(iso);
  return [
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  ];
}

export function tasksToIcs(tasks: Task[]): string {
  const settings = storage.getSettings();
  const events: EventAttributes[] = tasks.map((t) => ({
    title: `${PRIORITY_EMOJI[t.priority]} ${t.title}`,
    description: [t.description, `Energy: ${t.energy}`]
      .filter(Boolean)
      .join("\n"),
    start: toDateArray(t.suggested_start),
    end: toDateArray(t.suggested_end),
    startInputType: "local",
    startOutputType: "local",
    endInputType: "local",
    endOutputType: "local",
    alarms: [
      {
        action: "display",
        description: "Reminder",
        trigger: { minutes: settings.reminderMinutesBefore, before: true },
      },
    ],
  }));

  const { error, value } = createEvents(events);
  if (error || !value) {
    throw error ?? new Error("Failed to create ICS");
  }
  return value;
}

export function downloadIcs(tasks: Task[], filename?: string) {
  const ics = tasksToIcs(tasks);
  const stamp = new Date().toISOString().slice(0, 10);
  const name = filename ?? `dopamine-todo-${stamp}.ics`;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
