import type { Task, DayHistoryEntry, UnlockedBadge } from "./types";

const NS = "dopamine";

export const STORAGE_KEYS = {
  tasks: `${NS}.tasks`,
  xp: `${NS}.xp`,
  level: `${NS}.level`,
  streak: `${NS}.streak`,
  perfStreak: `${NS}.perfStreak`,
  freezes: `${NS}.freezes`,
  badges: `${NS}.badges`,
  history: `${NS}.history`,
  settings: `${NS}.settings`,
  authToken: `${NS}.authToken`,
} as const;

export interface AppSettings {
  workingHoursStart: string;
  workingHoursEnd: string;
  reminderMinutesBefore: number;
  masterVolume: number;
  muted: boolean;
  timezone: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  workingHoursStart: "08:00",
  workingHoursEnd: "18:00",
  reminderMinutesBefore: 5,
  masterVolume: 0.7,
  muted: false,
  timezone: "Australia/Brisbane",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  getTasks: () => read<Task[]>(STORAGE_KEYS.tasks, []),
  setTasks: (tasks: Task[]) => write(STORAGE_KEYS.tasks, tasks),

  getXp: () => read<number>(STORAGE_KEYS.xp, 0),
  setXp: (xp: number) => write(STORAGE_KEYS.xp, xp),

  getLevel: () => read<number>(STORAGE_KEYS.level, 1),
  setLevel: (level: number) => write(STORAGE_KEYS.level, level),

  getStreak: () => read<number>(STORAGE_KEYS.streak, 0),
  setStreak: (streak: number) => write(STORAGE_KEYS.streak, streak),

  getPerfStreak: () => read<number>(STORAGE_KEYS.perfStreak, 0),
  setPerfStreak: (streak: number) => write(STORAGE_KEYS.perfStreak, streak),

  getFreezes: () => read<number>(STORAGE_KEYS.freezes, 0),
  setFreezes: (n: number) => write(STORAGE_KEYS.freezes, n),

  getBadges: () => read<UnlockedBadge[]>(STORAGE_KEYS.badges, []),
  setBadges: (badges: UnlockedBadge[]) => write(STORAGE_KEYS.badges, badges),

  getHistory: () => read<DayHistoryEntry[]>(STORAGE_KEYS.history, []),
  setHistory: (entries: DayHistoryEntry[]) => write(STORAGE_KEYS.history, entries),

  getSettings: (): AppSettings => ({
    ...DEFAULT_SETTINGS,
    ...read<Partial<AppSettings>>(STORAGE_KEYS.settings, {}),
  }),
  setSettings: (settings: AppSettings) => write(STORAGE_KEYS.settings, settings),

  getAuthToken: () => read<string | null>(STORAGE_KEYS.authToken, null),
  setAuthToken: (token: string | null) => write(STORAGE_KEYS.authToken, token),

  exportAll: () => {
    const out: Record<string, unknown> = {};
    for (const [name, key] of Object.entries(STORAGE_KEYS)) {
      const raw = localStorage.getItem(key);
      out[name] = raw == null ? null : JSON.parse(raw);
    }
    return out;
  },

  importAll: (data: Record<string, unknown>) => {
    for (const [name, key] of Object.entries(STORAGE_KEYS)) {
      if (name in data && data[name] !== undefined) {
        localStorage.setItem(key, JSON.stringify(data[name]));
      }
    }
  },

  resetProgress: () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      if (key === STORAGE_KEYS.authToken || key === STORAGE_KEYS.settings) continue;
      localStorage.removeItem(key);
    }
  },
};
