import confetti from "canvas-confetti";
import { storage } from "./storage";
import {
  levelFromTotalXp,
  xpForTaskInCombo,
  xpRequiredForLevel,
} from "./gamification";
import { playSound, unlockAudio } from "./sounds";
import type { Task } from "./types";

export interface CompleteResult {
  xpGained: number;
  prevTotalXp: number;
  newTotalXp: number;
  leveledUp: boolean;
  prevLevel: number;
  newLevel: number;
  combo: number;
  allDone: boolean;
  streakBumped: boolean;
}

const COMBO_WINDOW_MIN = 30;
const GOLD = ["#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#facc15"];
const PARTY = ["#fbbf24", "#f59e0b", "#facc15", "#a855f7", "#ec4899", "#22d3ee", "#34d399"];

export function completeTask(
  taskId: string,
  origin?: { x: number; y: number },
): CompleteResult | null {
  unlockAudio();
  const tasks = storage.getTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task || task.completed_at) return null;

  const now = new Date().toISOString();
  const combo = computeCurrentCombo(tasks, now);

  const xpGained = xpForTaskInCombo(task.priority, task.energy, combo);
  const updatedTasks = tasks.map((t) =>
    t.id === taskId ? { ...t, completed_at: now } : t,
  );
  storage.setTasks(updatedTasks);

  const prevTotalXp = storage.getXp();
  const newTotalXp = prevTotalXp + xpGained;
  storage.setXp(newTotalXp);

  const prevLevel = levelFromTotalXp(prevTotalXp).level;
  const { level: newLevel } = levelFromTotalXp(newTotalXp);
  const leveledUp = newLevel > prevLevel;
  storage.setLevel(newLevel);

  const streakBumped = bumpStreakIfFirstToday(updatedTasks, now);
  const allDone = updatedTasks.every((t) => t.completed_at);
  const newCombo = combo + 1;

  fireCelebration({
    leveledUp,
    allDone,
    combo: newCombo,
    origin,
    priority: task.priority,
  });

  if (allDone) playSound("jackpot");
  else if (leveledUp) playSound("levelup");
  else if (streakBumped) playSound("streak");
  else if (newCombo >= 3) playSound("combo");
  else playSound("tick");

  if (newCombo >= 1) {
    setTimeout(() => playSound("xp"), 80);
  }

  window.dispatchEvent(
    new CustomEvent("dopamine:xp", {
      detail: {
        xp: newTotalXp,
        prevXp: prevTotalXp,
        gained: xpGained,
        level: newLevel,
        leveledUp,
        streak: storage.getStreak(),
        streakBumped,
        combo: newCombo,
        allDone,
      },
    }),
  );

  return {
    xpGained,
    prevTotalXp,
    newTotalXp,
    leveledUp,
    prevLevel,
    newLevel,
    combo: newCombo,
    allDone,
    streakBumped,
  };
}

export function uncompleteTask(taskId: string) {
  const tasks = storage.getTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task?.completed_at) return;
  storage.setTasks(
    tasks.map((t) => (t.id === taskId ? { ...t, completed_at: undefined } : t)),
  );
  const xpForTask = xpForTaskInCombo(task.priority, task.energy, 0);
  const newXp = Math.max(0, storage.getXp() - xpForTask);
  storage.setXp(newXp);
  storage.setLevel(levelFromTotalXp(newXp).level);
  window.dispatchEvent(
    new CustomEvent("dopamine:xp", {
      detail: {
        xp: newXp,
        prevXp: newXp + xpForTask,
        gained: -xpForTask,
        level: levelFromTotalXp(newXp).level,
        leveledUp: false,
        streak: storage.getStreak(),
        streakBumped: false,
        combo: 0,
        allDone: false,
      },
    }),
  );
}

function computeCurrentCombo(tasks: Task[], nowIso: string): number {
  const completed = tasks
    .filter((t) => t.completed_at)
    .sort(
      (a, b) =>
        new Date(b.completed_at!).getTime() -
        new Date(a.completed_at!).getTime(),
    );
  if (completed.length === 0) return 0;
  const now = new Date(nowIso).getTime();
  let combo = 0;
  let last = now;
  for (const t of completed) {
    const ts = new Date(t.completed_at!).getTime();
    if (last - ts <= COMBO_WINDOW_MIN * 60_000) {
      combo += 1;
      last = ts;
    } else break;
  }
  return combo;
}

function bumpStreakIfFirstToday(tasks: Task[], nowIso: string): boolean {
  const today = nowIso.slice(0, 10);
  const completedToday = tasks.filter(
    (t) => t.completed_at && t.completed_at.slice(0, 10) === today,
  );
  if (completedToday.length !== 1) return false;
  storage.setStreak(storage.getStreak() + 1);
  return true;
}

function fireCelebration(args: {
  leveledUp: boolean;
  allDone: boolean;
  combo: number;
  origin?: { x: number; y: number };
  priority: 1 | 2 | 3;
}) {
  const { leveledUp, allDone, combo, origin, priority } = args;
  const ox = origin
    ? Math.max(0.05, Math.min(0.95, origin.x / window.innerWidth))
    : 0.5;
  const oy = origin
    ? Math.max(0.05, Math.min(0.95, origin.y / window.innerHeight))
    : 0.6;

  const baseCount = priority === 1 ? 90 : priority === 2 ? 65 : 45;
  const colors = combo >= 3 ? PARTY : GOLD;

  // Burst from the checkbox.
  confetti({
    particleCount: baseCount,
    spread: 80,
    startVelocity: 42,
    angle: 90,
    origin: { x: ox, y: oy },
    colors,
    shapes: ["star", "circle"],
    scalar: 1,
    ticks: 110,
    zIndex: 60,
  });

  // Side cannons for combo.
  if (combo >= 2) {
    setTimeout(() => {
      confetti({
        particleCount: 50 + combo * 10,
        angle: 60,
        spread: 70,
        startVelocity: 55,
        origin: { x: 0, y: 0.85 },
        colors,
        shapes: ["star", "circle"],
        zIndex: 60,
      });
      confetti({
        particleCount: 50 + combo * 10,
        angle: 120,
        spread: 70,
        startVelocity: 55,
        origin: { x: 1, y: 0.85 },
        colors,
        shapes: ["star", "circle"],
        zIndex: 60,
      });
    }, 60);
  }

  if (leveledUp && !allDone) {
    setTimeout(() => goldShower(1500), 80);
  }

  if (allDone) {
    goldShower(2400);
    setTimeout(() => bigStarBurst(), 300);
    setTimeout(() => bigStarBurst(), 800);
    setTimeout(() => bigStarBurst(), 1300);
  }
}

function goldShower(durationMs: number) {
  const end = Date.now() + durationMs;
  const tick = () => {
    const remaining = end - Date.now();
    if (remaining <= 0) return;
    confetti({
      particleCount: 6,
      angle: 60,
      spread: 70,
      startVelocity: 55,
      origin: { x: 0, y: 1 },
      colors: PARTY,
      shapes: ["star", "circle"],
      ticks: 180,
      zIndex: 60,
    });
    confetti({
      particleCount: 6,
      angle: 120,
      spread: 70,
      startVelocity: 55,
      origin: { x: 1, y: 1 },
      colors: PARTY,
      shapes: ["star", "circle"],
      ticks: 180,
      zIndex: 60,
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function bigStarBurst() {
  confetti({
    particleCount: 220,
    spread: 360,
    startVelocity: 35,
    ticks: 200,
    origin: { x: 0.5, y: 0.5 },
    colors: PARTY,
    shapes: ["star"],
    scalar: 1.4,
    zIndex: 60,
  });
}

export function progressForCurrentLevel(totalXp: number) {
  const { level, intoLevel, forNext } = levelFromTotalXp(totalXp);
  return {
    level,
    intoLevel,
    forNext,
    pct: Math.min(100, Math.round((intoLevel / Math.max(1, forNext)) * 100)),
    nextLevelTotal: xpRequiredForLevel(level),
  };
}
