import { storage } from "./storage";

export type SoundId =
  | "tick"
  | "combo"
  | "xp"
  | "levelup"
  | "jackpot"
  | "streak"
  | "streak_loss"
  | "badge";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneOpts {
  freq: number;
  endFreq?: number;
  durationMs: number;
  type?: OscillatorType;
  startMs?: number;
  volume?: number;
  attackMs?: number;
}

function tone(opts: ToneOpts, master: GainNode) {
  const c = master.context as AudioContext;
  const start = c.currentTime + (opts.startMs ?? 0) / 1000;
  const dur = opts.durationMs / 1000;
  const attack = (opts.attackMs ?? 4) / 1000;
  const vol = opts.volume ?? 0.5;

  const osc = c.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, start);
  if (opts.endFreq) {
    osc.frequency.exponentialRampToValueAtTime(opts.endFreq, start + dur);
  }

  const g = c.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(g).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noiseBurst(durationMs: number, master: GainNode, volume = 0.15) {
  const c = master.context as AudioContext;
  const buffer = c.createBuffer(1, c.sampleRate * (durationMs / 1000), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 2000;
  const g = c.createGain();
  g.gain.setValueAtTime(volume, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + durationMs / 1000);
  src.connect(filter).connect(g).connect(master);
  src.start();
  src.stop(c.currentTime + durationMs / 1000);
}

function withMaster(): GainNode | null {
  const c = getCtx();
  if (!c) return null;
  const settings = storage.getSettings();
  if (settings.muted) return null;
  const master = c.createGain();
  master.gain.value = settings.masterVolume;
  master.connect(c.destination);
  return master;
}

const PATTERNS: Record<SoundId, (m: GainNode) => void> = {
  tick: (m) => {
    tone({ freq: 880, endFreq: 1480, durationMs: 90, type: "triangle", volume: 0.35 }, m);
    tone({ freq: 1760, durationMs: 70, type: "sine", volume: 0.18, startMs: 10 }, m);
  },
  xp: (m) => {
    tone({ freq: 988, durationMs: 80, type: "sine", volume: 0.3 }, m);
    tone({ freq: 1318, durationMs: 100, type: "sine", volume: 0.3, startMs: 60 }, m);
    tone({ freq: 1976, durationMs: 140, type: "sine", volume: 0.22, startMs: 130 }, m);
  },
  combo: (m) => {
    [659, 784, 988, 1318].forEach((f, i) =>
      tone({ freq: f, durationMs: 90, type: "triangle", volume: 0.32, startMs: i * 50 }, m),
    );
    noiseBurst(80, m, 0.08);
  },
  levelup: (m) => {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
      tone({ freq: f, durationMs: 140, type: "triangle", volume: 0.32, startMs: i * 70 }, m),
    );
    tone({ freq: 1568, durationMs: 400, type: "sine", volume: 0.25, startMs: 420 }, m);
    noiseBurst(120, m, 0.1);
  },
  jackpot: (m) => {
    const arp = [523, 659, 784, 1047, 1319, 1568, 2093];
    arp.forEach((f, i) =>
      tone({ freq: f, durationMs: 110, type: "square", volume: 0.22, startMs: i * 50 }, m),
    );
    arp
      .slice()
      .reverse()
      .forEach((f, i) =>
        tone({ freq: f, durationMs: 110, type: "triangle", volume: 0.24, startMs: 380 + i * 50 }, m),
      );
    [523, 784, 1047].forEach((f, i) =>
      tone({ freq: f, durationMs: 600, type: "triangle", volume: 0.3, startMs: 760 + i * 60 }, m),
    );
    noiseBurst(200, m, 0.15);
    setTimeout(() => {
      const m2 = withMaster();
      if (m2) noiseBurst(300, m2, 0.12);
    }, 700);
  },
  streak: (m) => {
    tone({ freq: 660, endFreq: 1320, durationMs: 220, type: "triangle", volume: 0.35 }, m);
    tone({ freq: 1980, durationMs: 180, type: "sine", volume: 0.22, startMs: 80 }, m);
  },
  streak_loss: (m) => {
    tone({ freq: 440, endFreq: 165, durationMs: 600, type: "sine", volume: 0.35 }, m);
  },
  badge: (m) => {
    [784, 1047, 1568, 2093].forEach((f, i) =>
      tone({ freq: f, durationMs: 160, type: "triangle", volume: 0.32, startMs: i * 80 }, m),
    );
  },
};

export function playSound(id: SoundId) {
  const m = withMaster();
  if (!m) return;
  try {
    PATTERNS[id](m);
  } catch (err) {
    console.warn("[sound]", id, err);
  }
}

export function unlockAudio() {
  getCtx();
}
