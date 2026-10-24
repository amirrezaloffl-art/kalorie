import type { CycleSettings, DayLog } from './types';

// Menstrual-cycle estimates. These are calendar predictions, not medical advice or contraception.
//
// Energy needs: resting energy expenditure rises modestly in the luteal phase (roughly 2-10 %,
// ~100-250 kcal/day in studies) and is not clearly higher during the period itself. Water retention
// in the late luteal phase and the first period days can add 0.5-2 kg to the scale.

export type Phase = 'period' | 'follicular' | 'ovulation' | 'luteal';

const DAY = 86400000;
const t = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const plus = (d: string, n: number) => iso(t(d) + n * DAY);
const diff = (a: string, b: string) => Math.round((t(b) - t(a)) / DAY);

/** First day of each logged period (a period day whose previous day had no period). */
export function periodStarts(days: Record<string, DayLog>): string[] {
  return Object.keys(days)
    .filter((d) => days[d].period && !days[plus(d, -1)]?.period)
    .sort();
}

/** Average cycle and period length from the last six logged cycles, falling back to settings. */
export function cycleStats(days: Record<string, DayLog>, cfg: CycleSettings) {
  const starts = periodStarts(days);
  const gaps = starts
    .slice(1)
    .map((s, i) => diff(starts[i], s))
    .filter((g) => g >= 15 && g <= 60)
    .slice(-6);
  const lengths = starts.slice(-6).map((s) => {
    let n = 0;
    while (days[plus(s, n)]?.period) n++;
    return n;
  });
  const avg = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  return {
    starts,
    cycleLength: gaps.length ? avg(gaps) : cfg.cycleLength,
    periodLength: lengths.length ? Math.min(10, avg(lengths)) : cfg.periodLength,
    loggedCycles: gaps.length,
  };
}

export interface CycleInfo {
  lastStart: string;
  cycleDay: number; // 1 = first day of the (possibly predicted) current cycle
  phase: Phase;
  nextStart: string; // predicted
  daysUntilNext: number;
  cycleLength: number;
  periodLength: number;
}

/** Where `date` falls in the cycle, or null when no period has been logged on or before it. */
export function cycleInfo(date: string, days: Record<string, DayLog>, cfg: CycleSettings): CycleInfo | null {
  const st = cycleStats(days, cfg);
  const lastStart = [...st.starts].reverse().find((s) => s <= date);
  if (!lastStart) return null;
  const len = st.cycleLength;
  const sinceStart = diff(lastStart, date);
  // If no new period was logged, keep predicting cycles forward from the last one.
  const cyclesAhead = Math.floor(sinceStart / len);
  const cycleDay = (sinceStart % len) + 1;
  const nextStart = plus(lastStart, (cyclesAhead + 1) * len);
  const ovulation = len - 14;
  let phase: Phase;
  if (days[date]?.period) phase = 'period';
  // Predicted cycles, or an ongoing period that just hasn't been logged for today yet.
  else if (cycleDay <= st.periodLength && (cyclesAhead > 0 || days[plus(date, -1)]?.period)) phase = 'period';
  else if (Math.abs(cycleDay - ovulation) <= 1) phase = 'ovulation';
  else if (cycleDay < ovulation) phase = 'follicular';
  else phase = 'luteal';
  return { lastStart, cycleDay, phase, nextStart, daysUntilNext: diff(date, nextStart), cycleLength: len, periodLength: st.periodLength };
}

/** Extra kcal for the day's goal (luteal phase only, when the user turned it on). */
export function cycleKcalAdjustment(date: string, days: Record<string, DayLog>, cfg: CycleSettings): number {
  if (!cfg.enabled || !cfg.lutealBoost) return 0;
  return cycleInfo(date, days, cfg)?.phase === 'luteal' ? cfg.lutealKcal : 0;
}

/** True when a weigh-in on `date` likely includes cycle-related water retention. */
export function waterRetentionLikely(date: string, days: Record<string, DayLog>, cfg: CycleSettings): boolean {
  if (!cfg.enabled) return false;
  const c = cycleInfo(date, days, cfg);
  if (!c) return false;
  return (c.phase === 'period' && c.cycleDay <= 3) || (c.phase === 'luteal' && c.daysUntilNext <= 5);
}

/** Predicted period days in [from, to] (for the calendar), excluding days already logged. */
export function predictedPeriodDays(from: string, to: string, days: Record<string, DayLog>, cfg: CycleSettings): Set<string> {
  const out = new Set<string>();
  const st = cycleStats(days, cfg);
  const last = st.starts[st.starts.length - 1];
  if (!last) return out;
  for (let k = 1; k <= 12; k++) {
    const start = plus(last, k * st.cycleLength);
    if (start > to) break;
    for (let i = 0; i < st.periodLength; i++) {
      const d = plus(start, i);
      if (d >= from && d <= to && !days[d]?.period) out.add(d);
    }
  }
  return out;
}

/** Predicted fertile window (ovulation ±2 days) in [from, to], for logged and predicted cycles. */
export function fertileDays(from: string, to: string, days: Record<string, DayLog>, cfg: CycleSettings): Set<string> {
  const out = new Set<string>();
  const st = cycleStats(days, cfg);
  const last = st.starts[st.starts.length - 1];
  if (!last) return out;
  const starts = [...st.starts, ...Array.from({ length: 12 }, (_, k) => plus(last, (k + 1) * st.cycleLength))];
  for (const start of starts) {
    const ov = plus(start, st.cycleLength - 15); // cycle day (length − 14)
    for (let i = -2; i <= 2; i++) {
      const d = plus(ov, i);
      if (d >= from && d <= to) out.add(d);
    }
  }
  return out;
}
