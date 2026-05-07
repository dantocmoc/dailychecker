import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Flame,
  LayoutDashboard,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { storage } from "@/lib/storage";
import { levelFromTotalXp } from "@/lib/gamification";

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center gap-2 px-3 h-9 rounded-lg text-sm transition-colors",
    isActive
      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]/50",
  );
}

interface XpEventDetail {
  xp: number;
  prevXp: number;
  gained: number;
  level: number;
  leveledUp: boolean;
  streak: number;
  streakBumped: boolean;
}

function CountUp({ value, prev }: { value: number; prev: number }) {
  const mv = useMotionValue(prev);
  const display = useTransform(mv, (n) => Math.round(n).toString());
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.6, ease: "easeOut" });
    return controls.stop;
  }, [mv, value]);
  return <motion.span>{display}</motion.span>;
}

export function AppLayout() {
  const [xp, setXp] = useState(() => storage.getXp());
  const prevXpRef = useRef(xp);
  const [streak, setStreak] = useState(() => storage.getStreak());
  const [pulseXp, setPulseXp] = useState(0);
  const [pulseStreak, setPulseStreak] = useState(0);
  const [pulseLevel, setPulseLevel] = useState(0);

  const { level } = levelFromTotalXp(xp);

  useEffect(() => {
    function onXp(e: Event) {
      const detail = (e as CustomEvent<XpEventDetail>).detail;
      prevXpRef.current = detail.prevXp;
      setXp(detail.xp);
      setStreak(detail.streak);
      setPulseXp((n) => n + 1);
      if (detail.streakBumped) setPulseStreak((n) => n + 1);
      if (detail.leveledUp) setPulseLevel((n) => n + 1);
    }
    window.addEventListener("dopamine:xp", onXp);
    return () => window.removeEventListener("dopamine:xp", onXp);
  }, []);

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-[var(--border)] sticky top-0 z-20 backdrop-blur-md bg-[var(--background)]/80">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-5 text-[var(--primary)]" />
            <span>Dopamine</span>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              <LayoutDashboard className="size-4" />
              Today
            </NavLink>
            <NavLink to="/generate" className={navClass}>
              <Plus className="size-4" />
              New plan
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              <SettingsIcon className="size-4" />
              Settings
            </NavLink>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <motion.div
              key={`lv-${pulseLevel}`}
              animate={
                pulseLevel
                  ? { scale: [1, 1.4, 1], rotate: [0, -8, 8, 0] }
                  : undefined
              }
              transition={{ duration: 0.5 }}
              className="flex items-center gap-1.5 px-2 h-8 rounded-md bg-[var(--secondary)]"
            >
              <span className="text-xs text-[var(--muted-foreground)]">LV</span>
              <span className="font-semibold">{level}</span>
            </motion.div>
            <motion.div
              key={`xp-${pulseXp}`}
              animate={pulseXp ? { scale: [1, 1.18, 1] } : undefined}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-1.5 px-2 h-8 rounded-md bg-[var(--secondary)]"
            >
              <Sparkles className="size-3.5 text-[var(--primary)]" />
              <span className="font-semibold tabular-nums">
                <CountUp value={xp} prev={prevXpRef.current} />
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">XP</span>
            </motion.div>
            <motion.div
              key={`streak-${pulseStreak}`}
              animate={
                pulseStreak
                  ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] }
                  : undefined
              }
              transition={{ duration: 0.45 }}
              className="flex items-center gap-1.5 px-2 h-8 rounded-md bg-[var(--secondary)]"
            >
              <Flame className="size-3.5 text-orange-400" />
              <span className="font-semibold tabular-nums">{streak}</span>
            </motion.div>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 relative">
        <Outlet />
      </main>
    </div>
  );
}
