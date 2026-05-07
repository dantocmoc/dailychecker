import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { ArrowLeft, Battery, BatteryLow, Brain, CalendarPlus, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { storage } from "@/lib/storage";
import { downloadIcs } from "@/lib/ics";
import { addMinutes, formatTimeRange, toLocalInput, fromLocalInput } from "@/lib/time";
import type { Energy, Priority, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY_LABEL: Record<Priority, string> = {
  1: "Must do",
  2: "Should do",
  3: "Nice to have",
};

const ENERGY_META: Record<
  Energy,
  { label: string; color: string; icon: typeof Brain }
> = {
  deep: {
    label: "Deep",
    color: "var(--energy-deep)",
    icon: Brain,
  },
  shallow: {
    label: "Shallow",
    color: "var(--energy-shallow)",
    icon: Battery,
  },
  admin: {
    label: "Admin",
    color: "var(--energy-admin)",
    icon: BatteryLow,
  },
};

export function Review() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>(() => storage.getTasks());

  useEffect(() => {
    storage.setTasks(tasks);
  }, [tasks]);

  const sorted = useMemo(
    () =>
      [...tasks].sort(
        (a, b) =>
          new Date(a.suggested_start).getTime() -
          new Date(b.suggested_start).getTime(),
      ),
    [tasks],
  );

  const conflicts = useMemo(() => detectConflicts(sorted), [sorted]);

  function update(id: string, patch: Partial<Task>) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  }

  function updateStartAndPushEnd(id: string, newStartIso: string) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          suggested_start: newStartIso,
          suggested_end: addMinutes(newStartIso, t.duration_minutes),
        };
      }),
    );
  }

  function updateDuration(id: string, mins: number) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const m = Math.max(5, Math.min(8 * 60, mins));
        return {
          ...t,
          duration_minutes: m,
          suggested_end: addMinutes(t.suggested_start, m),
        };
      }),
    );
  }

  function remove(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function addBlank() {
    const last = sorted[sorted.length - 1];
    const start = last
      ? last.suggested_end
      : new Date(new Date().setHours(9, 0, 0, 0)).toISOString();
    const newTask: Task = {
      id: uuidv4(),
      title: "New task",
      description: "",
      duration_minutes: 30,
      priority: 2,
      energy: "shallow",
      suggested_start: start,
      suggested_end: addMinutes(start, 30),
      source: "manual",
    };
    setTasks((prev) => [...prev, newTask]);
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">Review</h1>
        <Card className="p-8 text-center text-[var(--muted-foreground)]">
          No tasks yet.{" "}
          <Link to="/generate" className="text-[var(--primary)] underline">
            Generate a plan first.
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link
            to="/generate"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="size-3.5" />
            Back to generate
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Review</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            {tasks.length} task{tasks.length === 1 ? "" : "s"}, edit anything
            before you commit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={addBlank}>
            <Plus className="size-4" />
            Add task
          </Button>
          <Button variant="outline" onClick={() => downloadIcs(tasks)}>
            <CalendarPlus className="size-4" />
            Download ICS
          </Button>
          <Button onClick={() => navigate("/")}>
            <Check className="size-4" />
            Looks good
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {sorted.map((t) => {
          const conflict = conflicts.has(t.id);
          const Energy = ENERGY_META[t.energy];
          return (
            <Card
              key={t.id}
              className={cn(
                "p-4 flex flex-col gap-3 border-l-4 transition-colors",
                conflict && "border-[var(--destructive)]",
              )}
              style={
                !conflict
                  ? { borderLeftColor: ENERGY_META[t.energy].color }
                  : undefined
              }
            >
              <div className="flex items-start gap-3">
                <Input
                  value={t.title}
                  onChange={(e) => update(t.id, { title: e.target.value })}
                  className="text-base font-medium border-transparent shadow-none px-0 focus-visible:border-[var(--ring)] focus-visible:px-3"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(t.id)}
                  className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                    Start
                  </label>
                  <Input
                    type="datetime-local"
                    value={toLocalInput(t.suggested_start)}
                    onChange={(e) =>
                      updateStartAndPushEnd(
                        t.id,
                        fromLocalInput(e.target.value),
                      )
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                    Minutes
                  </label>
                  <Input
                    type="number"
                    min={5}
                    step={5}
                    value={t.duration_minutes}
                    onChange={(e) =>
                      updateDuration(t.id, Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                    Priority
                  </label>
                  <select
                    value={t.priority}
                    onChange={(e) =>
                      update(t.id, {
                        priority: Number(e.target.value) as Priority,
                      })
                    }
                    className="flex h-10 w-full rounded-lg border border-[var(--input)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <option value={1}>1 — {PRIORITY_LABEL[1]}</option>
                    <option value={2}>2 — {PRIORITY_LABEL[2]}</option>
                    <option value={3}>3 — {PRIORITY_LABEL[3]}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {(["deep", "shallow", "admin"] as Energy[]).map((e) => {
                    const Meta = ENERGY_META[e];
                    const Icon = Meta.icon;
                    const active = t.energy === e;
                    return (
                      <button
                        key={e}
                        onClick={() => update(t.id, { energy: e })}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs transition-colors border",
                          active
                            ? "border-transparent text-[var(--background)]"
                            : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                        )}
                        style={
                          active
                            ? { backgroundColor: Meta.color }
                            : undefined
                        }
                      >
                        <Icon className="size-3.5" />
                        {Meta.label}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-2">
                  <Energy.icon
                    className="size-3.5"
                    style={{ color: ENERGY_META[t.energy].color }}
                  />
                  {formatTimeRange(t.suggested_start, t.suggested_end)}
                  {conflict && (
                    <span className="text-[var(--destructive)] font-medium ml-2">
                      overlap
                    </span>
                  )}
                </div>
              </div>

              <Textarea
                placeholder="Notes (optional)"
                value={t.description ?? ""}
                onChange={(e) => update(t.id, { description: e.target.value })}
                className="min-h-16 text-sm"
              />
            </Card>
          );
        })}
      </div>

      {conflicts.size > 0 && (
        <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
          {conflicts.size} task{conflicts.size === 1 ? "" : "s"} overlap. Tweak
          the times if you want clean blocks in your calendar.
        </div>
      )}
    </div>
  );
}

function detectConflicts(sorted: Task[]): Set<string> {
  const conflicts = new Set<string>();
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (new Date(a.suggested_end) > new Date(b.suggested_start)) {
      conflicts.add(a.id);
      conflicts.add(b.id);
    }
  }
  return conflicts;
}
