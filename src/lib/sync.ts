import { authHeader } from "./auth";
import { storage, SYNCABLE_NAMES, STORAGE_KEYS } from "./storage";
import { levelFromTotalXp } from "./gamification";

const VERSION_KEY = "dopamine.syncVersion";
const PUSH_DEBOUNCE_MS = 2000;

interface SyncSnapshot {
  version: number;
  data: Record<string, unknown>;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let applying = false;
let started = false;
let pulling = false;
let lastPushAttempt = 0;

function buildSnapshot(): SyncSnapshot {
  const data: Record<string, unknown> = {};
  for (const n of SYNCABLE_NAMES) {
    const fullKey = STORAGE_KEYS[n as keyof typeof STORAGE_KEYS];
    const raw = localStorage.getItem(fullKey);
    if (raw != null) {
      try {
        data[n] = JSON.parse(raw);
      } catch {
        // skip malformed
      }
    }
  }
  return { version: Date.now(), data };
}

function applySnapshot(snap: SyncSnapshot) {
  applying = true;
  try {
    for (const n of SYNCABLE_NAMES) {
      const fullKey = STORAGE_KEYS[n as keyof typeof STORAGE_KEYS];
      if (n in snap.data) {
        localStorage.setItem(fullKey, JSON.stringify(snap.data[n]));
      }
    }
    localStorage.setItem(VERSION_KEY, String(snap.version));
  } finally {
    applying = false;
  }
}

export async function pullState(): Promise<{ pulled: boolean; reason?: string }> {
  if (pulling) return { pulled: false, reason: "already-pulling" };
  pulling = true;
  try {
    const res = await fetch("/api/state", { headers: { ...authHeader() } });
    if (res.status === 503) return { pulled: false, reason: "no-kv" };
    if (!res.ok) return { pulled: false, reason: `http-${res.status}` };
    const data = (await res.json()) as { state: SyncSnapshot | null };
    if (!data.state) return { pulled: false, reason: "no-remote-state" };

    const localVersion = Number(localStorage.getItem(VERSION_KEY) ?? "0");
    if (data.state.version <= localVersion) {
      return { pulled: false, reason: "local-newer" };
    }

    applySnapshot(data.state);

    // Notify the rest of the app that state changed.
    const xp = storage.getXp();
    const { level } = levelFromTotalXp(xp);
    window.dispatchEvent(
      new CustomEvent("dopamine:xp", {
        detail: {
          xp,
          prevXp: xp,
          gained: 0,
          level,
          leveledUp: false,
          streak: storage.getStreak(),
          streakBumped: false,
          combo: 0,
          allDone: false,
        },
      }),
    );
    window.dispatchEvent(new CustomEvent("dopamine:state-pulled"));
    return { pulled: true };
  } catch (err) {
    console.warn("[sync] pull failed", err);
    return { pulled: false, reason: "exception" };
  } finally {
    pulling = false;
  }
}

async function flushPush() {
  pushTimer = null;
  if (applying) return;
  const snap = buildSnapshot();
  lastPushAttempt = Date.now();
  try {
    const res = await fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json", ...authHeader() },
      body: JSON.stringify(snap),
    });
    if (res.ok) {
      localStorage.setItem(VERSION_KEY, String(snap.version));
    } else if (res.status !== 503) {
      console.warn("[sync] push http", res.status);
    }
  } catch (err) {
    console.warn("[sync] push failed", err);
  }
}

export function schedulePush() {
  if (applying) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(flushPush, PUSH_DEBOUNCE_MS);
}

export function flushNow() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  void flushPush();
}

export function startSync() {
  if (started) return;
  started = true;
  window.addEventListener("dopamine:storage-dirty", () => schedulePush());
  // On tab close / visibility change, flush.
  window.addEventListener("beforeunload", () => {
    if (pushTimer) {
      // Best effort, but beacon would be better — JWT requires a header.
      flushNow();
    }
  });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pushTimer) {
      flushNow();
    } else if (document.visibilityState === "visible") {
      // Pull latest when tab becomes active (gentle: skip if recently pushed).
      if (Date.now() - lastPushAttempt > 5000) {
        void pullState();
      }
    }
  });
}
