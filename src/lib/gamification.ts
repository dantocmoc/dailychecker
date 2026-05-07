import type { Energy, Priority } from "./types";

const PRIORITY_MULTIPLIERS: Record<Priority, number> = { 1: 3, 2: 2, 3: 1 };
const ENERGY_MULTIPLIERS: Record<Energy, number> = {
  deep: 1.5,
  shallow: 1,
  admin: 0.7,
};

export function baseXpForTask(priority: Priority, energy: Energy): number {
  return Math.round(10 * PRIORITY_MULTIPLIERS[priority] * ENERGY_MULTIPLIERS[energy]);
}

export function comboMultiplier(comboCount: number): number {
  if (comboCount >= 5) return 2;
  if (comboCount >= 3) return 1.5;
  return 1;
}

export function xpForTaskInCombo(
  priority: Priority,
  energy: Energy,
  comboCount: number,
): number {
  return Math.round(baseXpForTask(priority, energy) * comboMultiplier(comboCount));
}

export function xpRequiredForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5));
}

export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) total += xpRequiredForLevel(i);
  return total;
}

export function levelFromTotalXp(totalXp: number): {
  level: number;
  intoLevel: number;
  forNext: number;
} {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpRequiredForLevel(level)) {
    remaining -= xpRequiredForLevel(level);
    level += 1;
  }
  return { level, intoLevel: remaining, forNext: xpRequiredForLevel(level) };
}
