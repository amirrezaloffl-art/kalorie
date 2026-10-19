import type { WeightEntry } from './types';

const DAY = 86400000;
const t = (d: string) => new Date(d + 'T00:00:00Z').getTime();

/** Exponentially weighted moving average over values in date order. */
export function ewma(values: number[], alpha = 0.3): number[] {
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : alpha * v + (1 - alpha) * out[i - 1]));
  return out.map((v) => Math.round(v * 100) / 100);
}

/** Least-squares slope in kg/week over the last `n` entries. */
export function weeklySlope(entries: WeightEntry[], n = 8): number | null {
  const pts = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-n);
  if (pts.length < 2) return null;
  const x0 = t(pts[0].date);
  const xs = pts.map((p) => (t(p.date) - x0) / (7 * DAY));
  const ys = pts.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  return den ? num / den : null;
}

/** Projected ISO date for reaching `targetKg`, or null when flat / moving away. */
export function projectGoalDate(entries: WeightEntry[], targetKg: number): string | null {
  const slope = weeklySlope(entries);
  if (slope == null || Math.abs(slope) < 0.01) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const trend = ewma(sorted.map((e) => e.kg));
  const diff = targetKg - trend[trend.length - 1];
  const last = sorted[sorted.length - 1].date;
  if (Math.abs(diff) < 0.05) return last;
  if (Math.sign(diff) !== Math.sign(slope)) return null;
  const weeks = diff / slope;
  if (weeks > 520) return null;
  return new Date(t(last) + weeks * 7 * DAY).toISOString().slice(0, 10);
}

export function daysSince(dateIso: string, today: string): number {
  return Math.round((t(today) - t(dateIso)) / DAY);
}
