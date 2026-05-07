import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import {
  Battery,
  BatteryLow,
  Brain,
  CalendarPlus,
  Check,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { storage } from "@/lib/storage";
import { downloadIcs } from "@/lib/ics";
import {
  completeTask,
  progressForCurrentLevel,
  uncompleteTask,
} from "@/lib/actions";
import { addMinutes, formatTimeRange } from "@/lib/time";
import type { Energy, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const ENERGY_META: Record<
  Energy,
  { color: string; icon: typeof Brain; label: string }
> = {
  deep: { color: "var(--energy-deep)", icon: Brain, label: "Deep" },
  shallow: { color: "var(--energy-shallow)", icon: Battery, label: "Shallow" },
  admin: { color: "var(--energy-admin)", icon: BatteryLow, label: "Admin" },
};

const PRIORITY_DOT: Record<1 | 2 | 3, string> = {
  1: "bg-red-400",
  2: "bg-amber-400",
  3: "bg-zinc-500",
};

interface XpFloater {
  id: string;
  xp: number;
  x: number;
  y: number;
  combo: number;
  leveledUp: boolean;
  allDone: boolean;
}

interface ComboBadge {
  id: string;
  combo: number;
}

interface FlashEvent {
  id: string;
  kind: "level" | "jackpot";
}

export function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>(() => storage.getTasks());
  const [xp, setXp] = useState(() => storage.getXp());
  const [floaters, setFloaters] = useState<XpFloater[]>([]);
  const [combos, setCombos] = useState<ComboBadge[]>([]);
  const [flashes, setFlashes] = useState<FlashEvent[]>([]);
  const [flashCardId, setFlashCardId] = useState<string | null>(null);

  function refresh() {
    setTasks(storage.getTasks());
    setXp(storage.getXp());
  }

  useEffect(() => {
    function onXp() {
      refresh();
    }
    window.addEventListener("dopamine:xp", onXp);
    return () => window.removeEventListener("dopamine:xp", onXp);
  }, []);

  const sorted = useMemo(
    () =>
      [...tasks].sort(
        (a, b) =>
          new Date(a.suggested_start).getTime() -
          new Date(b.suggested_start).getTime(),
      ),
    [tasks],
  );

  const pending = sorted.filter((t) => !t.completed_at);
  const done = sorted.filter((t) => t.completed_at);
  const progress = progressForCurrentLevel(xp);

  function quickAdd(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const last = sorted[sorted.length - 1];
    const start = last
      ? last.suggested_end
      : nextRoundedQuarterHour();
    const newTask: Task = {
      id: uuidv4(),
      title: trimmed,
      description: "",
      duration_minutes: 30,
      priority: 2,
      energy: "shallow",
      suggested_start: start,
      suggested_end: addMinutes(start, 30),
      source: "manual",
    };
    storage.setTasks([...storage.getTasks(), newTask]);
    refresh();
  }

  function handleTick(task: Task, ev: React.MouseEvent<HTMLButtonElement>) {
    if (task.completed_at) {
      uncompleteTask(task.id);
      refresh();
      return;
    }
    const rect = ev.currentTarget.getBoundingClientRect();
    const origin = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    setFlashCardId(task.id);
    setTimeout(() => setFlashCardId(null), 450);

    const result = completeTask(task.id, origin);
    if (result) {
      const id = `${task.id}-${Date.now()}`;
      setFloaters((p) => [
        ...p,
        {
          id,
          xp: result.xpGained,
          x: origin.x,
          y: origin.y,
          combo: result.combo,
          leveledUp: result.leveledUp,
          allDone: result.allDone,
        },
      ]);
      setTimeout(() => setFloaters((p) => p.filter((f) => f.id !== id)), 1600);

      if (result.combo >= 2) {
        const cid = `${task.id}-combo-${Date.now()}`;
        setCombos((p) => [...p, { id: cid, combo: result.combo }]);
        setTimeout(() => setCombos((p) => p.filter((c) => c.id !== cid)), 1200);
      }

      if (result.allDone) {
        setFlashes((p) => [...p, { id: `j-${Date.now()}`, kind: "jackpot" }]);
      } else if (result.leveledUp) {
        setFlashes((p) => [...p, { id: `l-${Date.now()}`, kind: "level" }]);
      }
    }
    refresh();
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
            <p className="text-[var(--muted-foreground)] mt-1">
              No plan yet. Drop a calendar screenshot, write what you need to
              do, and the day arranges itself.
            </p>
          </div>
          <Link to="/generate">
            <Button size="lg">
              <Plus className="size-4" />
              New plan
            </Button>
          </Link>
        </div>
        <Card className="p-12 text-center">
          <Sparkles className="size-10 mx-auto text-[var(--primary)] mb-3" />
          <div className="text-lg font-medium mb-1">Start your day</div>
          <div className="text-sm text-[var(--muted-foreground)] mb-6">
            Plans show up here, ticked off for XP.
          </div>
          <Link to="/generate">
            <Button>
              <Plus className="size-4" />
              Generate a plan
            </Button>
          </Link>
        </Card>
        <QuickAdd onAdd={quickAdd} placeholder="Or just add a quick task..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 relative">
      <FlashOverlay flashes={flashes} setFlashes={setFlashes} />
      <FloaterLayer floaters={floaters} />
      <ComboLayer combos={combos} />

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            {pending.length} pending, {done.length} done
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/review">
            <Button variant="outline">
              <Pencil className="size-4" />
              Edit
            </Button>
          </Link>
          <Button variant="outline" onClick={() => downloadIcs(tasks)}>
            <CalendarPlus className="size-4" />
            ICS
          </Button>
          <Link to="/generate">
            <Button>
              <Plus className="size-4" />
              New plan
            </Button>
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium">Level {progress.level}</span>
          <span className="text-[var(--muted-foreground)]">
            {progress.intoLevel} / {progress.forNext} XP
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--secondary)] overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[var(--primary)] via-amber-400 to-yellow-300"
            initial={false}
            animate={{ width: `${progress.pct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {pending.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onTick={(e) => handleTick(t, e)}
              flashing={flashCardId === t.id}
            />
          ))}
        </AnimatePresence>
        {pending.length === 0 && (
          <Card className="p-8 text-center text-[var(--muted-foreground)]">
            <Sparkles className="size-8 mx-auto text-[var(--primary)] mb-2" />
            Day cleared. Look at you.
          </Card>
        )}
        <QuickAdd onAdd={quickAdd} placeholder="Add a quick task and hit Enter..." />
      </div>

      {done.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)] px-1">
            Done ({done.length})
          </div>
          {done.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onTick={(e) => handleTick(t, e)}
              flashing={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function nextRoundedQuarterHour(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const minutes = d.getMinutes();
  const next = Math.ceil((minutes + 1) / 15) * 15;
  d.setMinutes(next);
  return d.toISOString();
}

function QuickAdd({
  onAdd,
  placeholder,
}: {
  onAdd: (title: string) => void;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  const [bump, setBump] = useState(0);
  function submit() {
    const t = value.trim();
    if (!t) return;
    onAdd(t);
    setValue("");
    setBump((n) => n + 1);
  }
  return (
    <motion.div
      key={bump}
      animate={bump ? { scale: [1, 1.02, 1] } : undefined}
      transition={{ duration: 0.25 }}
    >
      <Card className="p-2 flex items-center gap-2 border-dashed">
        <button
          onClick={submit}
          aria-label="Add task"
          className="size-7 rounded-md border-2 border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--accent)] flex items-center justify-center shrink-0 transition-colors"
        >
          <Plus className="size-4 text-[var(--muted-foreground)]" />
        </button>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
        />
      </Card>
    </motion.div>
  );
}

function FloaterLayer({ floaters }: { floaters: XpFloater[] }) {
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <AnimatePresence>
        {floaters.map((f) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, scale: 0.4, x: f.x - 100, y: f.y - 30 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.4, 1.6, 1.3],
              y: [f.y - 30, f.y - 130, f.y - 200],
              x: f.x - 100,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="absolute"
            style={{ width: 200 }}
          >
            <div
              className="text-center font-black tracking-tight"
              style={{
                fontSize: f.allDone ? "5rem" : f.leveledUp ? "4rem" : "3.25rem",
                lineHeight: 1,
                background:
                  "linear-gradient(180deg, #fef9c3 0%, #fde047 30%, #f59e0b 70%, #b45309 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                textShadow: "0 0 24px rgba(251,191,36,0.5)",
                filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
              }}
            >
              +{f.xp}
            </div>
            <div className="text-center font-bold text-yellow-300 text-sm tracking-[0.3em] uppercase mt-1">
              XP
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ComboLayer({ combos }: { combos: ComboBadge[] }) {
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <AnimatePresence>
        {combos.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, scale: 0.3, rotate: -15 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.3, 1.3, 1, 1],
              rotate: [-15, 5, -2, 0],
            }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 1.1, ease: [0.34, 1.56, 0.64, 1] }}
            className="absolute top-[28%] left-1/2 -translate-x-1/2"
          >
            <div
              className="px-6 py-3 rounded-2xl font-black text-3xl uppercase tracking-tight border-4 border-yellow-300"
              style={{
                background:
                  "linear-gradient(135deg, #f59e0b 0%, #f43f5e 50%, #a855f7 100%)",
                color: "white",
                textShadow: "0 2px 8px rgba(0,0,0,0.4)",
                boxShadow:
                  "0 0 40px rgba(251,191,36,0.5), 0 8px 32px rgba(0,0,0,0.3)",
              }}
            >
              x{c.combo} combo
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function FlashOverlay({
  flashes,
  setFlashes,
}: {
  flashes: FlashEvent[];
  setFlashes: React.Dispatch<React.SetStateAction<FlashEvent[]>>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (flashes.length === 0) return;
    const id = flashes[flashes.length - 1].id;
    const t = setTimeout(
      () => setFlashes((p) => p.filter((f) => f.id !== id)),
      900,
    );
    return () => clearTimeout(t);
  }, [flashes, setFlashes]);

  return (
    <div ref={ref} className="fixed inset-0 z-40 pointer-events-none">
      <AnimatePresence>
        {flashes.map((f) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: f.kind === "jackpot" ? 0.9 : 0.6 }}
            className="absolute inset-0"
            style={{
              background:
                f.kind === "jackpot"
                  ? "radial-gradient(circle at center, rgba(251,191,36,0.8) 0%, rgba(168,85,247,0.5) 40%, transparent 70%)"
                  : "radial-gradient(circle at center, rgba(251,191,36,0.6) 0%, transparent 60%)",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function TaskCard({
  task,
  onTick,
  flashing,
}: {
  task: Task;
  onTick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  flashing: boolean;
}) {
  const meta = ENERGY_META[task.energy];
  const Icon = meta.icon;
  const completed = !!task.completed_at;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={
        flashing
          ? {
              opacity: 1,
              y: 0,
              scale: [1, 1.04, 1],
              boxShadow: [
                "0 0 0 0 rgba(251,191,36,0)",
                "0 0 30px 6px rgba(251,191,36,0.6)",
                "0 0 0 0 rgba(251,191,36,0)",
              ],
            }
          : { opacity: 1, y: 0 }
      }
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: flashing ? 0.45 : 0.18 }}
    >
      <Card
        className={cn(
          "p-3 flex items-center gap-3 border-l-4 transition-all relative overflow-hidden",
          completed && "opacity-50",
        )}
        style={{ borderLeftColor: meta.color }}
      >
        <button
          onClick={onTick}
          className={cn(
            "size-7 rounded-md border-2 flex items-center justify-center transition-all shrink-0 relative z-10 active:scale-90",
            completed
              ? "bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-foreground)]"
              : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--accent)]",
          )}
          aria-label={completed ? "Mark incomplete" : "Mark complete"}
        >
          {completed && <Check className="size-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "font-medium truncate",
              completed && "line-through",
            )}
          >
            {task.title}
          </div>
          <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  PRIORITY_DOT[task.priority],
                )}
              />
              P{task.priority}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon className="size-3" style={{ color: meta.color }} />
              {meta.label}
            </span>
            <span>
              {formatTimeRange(task.suggested_start, task.suggested_end)}
            </span>
            <span>· {task.duration_minutes}m</span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
