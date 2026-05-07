import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Lock, Sparkles } from "lucide-react";
import { loginWithPin } from "@/lib/auth";
import { playSound, unlockAudio } from "@/lib/sounds";
import { cn } from "@/lib/utils";

interface PinGateProps {
  onSuccess: () => void;
}

const PAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "←"],
];

export function PinGate({ onSuccess }: PinGateProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (submitting) return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("←");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, submitting]);

  function press(digit: string) {
    if (submitting) return;
    unlockAudio();
    setError(null);
    if (digit === "←") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (digit === "" || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      void submit(next);
    }
  }

  async function submit(value: string) {
    setSubmitting(true);
    const r = await loginWithPin(value);
    setSubmitting(false);
    if (r.ok) {
      playSound("levelup");
      setTimeout(onSuccess, 220);
    } else {
      playSound("streak_loss");
      setError(r.error);
      setShake((n) => n + 1);
      setTimeout(() => setPin(""), 500);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--background)] px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-2 mb-10"
      >
        <div className="flex items-center gap-2 text-[var(--primary)]">
          <Sparkles className="size-7" />
          <span className="text-2xl font-semibold tracking-tight">Dopamine</span>
        </div>
        <div className="text-sm text-[var(--muted-foreground)] flex items-center gap-1.5">
          <Lock className="size-3.5" />
          Enter your PIN
        </div>
      </motion.div>

      <motion.div
        key={shake}
        animate={
          shake
            ? { x: [0, -10, 10, -8, 8, -4, 4, 0] }
            : undefined
        }
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3 mb-8"
      >
        {[0, 1, 2, 3].map((i) => {
          const filled = i < pin.length;
          return (
            <motion.div
              key={i}
              animate={
                filled
                  ? { scale: [1, 1.3, 1] }
                  : { scale: 1 }
              }
              transition={{ duration: 0.18 }}
              className={cn(
                "size-5 rounded-full border-2 transition-colors",
                filled
                  ? "bg-[var(--primary)] border-[var(--primary)]"
                  : "border-[var(--border)]",
              )}
            />
          );
        })}
      </motion.div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {PAD.flat().map((d, i) => {
          if (d === "") return <div key={i} />;
          const isDel = d === "←";
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.92 }}
              onClick={() => press(d)}
              disabled={submitting}
              className={cn(
                "h-16 rounded-2xl text-2xl font-medium transition-colors",
                "bg-[var(--secondary)] hover:bg-[var(--accent)] active:bg-[var(--accent)]",
                "border border-[var(--border)] disabled:opacity-50",
                isDel && "text-[var(--muted-foreground)]",
              )}
            >
              {isDel ? <Delete className="size-5 mx-auto" /> : d}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-6 text-sm text-[var(--destructive)]"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {submitting && (
        <div className="mt-6 text-sm text-[var(--muted-foreground)]">
          checking...
        </div>
      )}
    </div>
  );
}
