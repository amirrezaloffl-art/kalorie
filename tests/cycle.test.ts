import { describe, expect, it } from 'vitest';
import { cycleInfo, cycleKcalAdjustment, cycleStats, fertileDays, periodStarts, predictedPeriodDays, waterRetentionLikely } from '../src/domain/cycle';
import type { CycleSettings, DayLog } from '../src/domain/types';

const cfg: CycleSettings = { enabled: true, cycleLength: 28, periodLength: 5, lutealBoost: true, lutealKcal: 150 };

function log(starts: [string, number][]): Record<string, DayLog> {
  const days: Record<string, DayLog> = {};
  for (const [start, len] of starts) {
    for (let i = 0; i < len; i++) {
      const d = new Date(Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10) + i)).toISOString().slice(0, 10);
      days[d] = { date: d, entries: [], exercises: [], waterGlasses: 0, period: 'medium' };
    }
  }
  return days;
}

// Three 30-day cycles, 4-day periods
const days = log([['2026-07-01', 4], ['2026-07-31', 4], ['2026-08-30', 4]]);

describe('cycle', () => {
  it('finds period starts and averages', () => {
    expect(periodStarts(days)).toEqual(['2026-07-01', '2026-07-31', '2026-08-30']);
    const st = cycleStats(days, cfg);
    expect(st.cycleLength).toBe(30);
    expect(st.periodLength).toBe(4);
  });

  it('falls back to settings with one cycle', () => {
    const st = cycleStats(log([['2026-07-01', 5]]), cfg);
    expect(st.cycleLength).toBe(28);
  });

  it('works out phases (30-day cycle → ovulation on day 16)', () => {
    expect(cycleInfo('2026-08-31', days, cfg)!.phase).toBe('period');
    expect(cycleInfo('2026-09-05', days, cfg)!.phase).toBe('follicular');
    expect(cycleInfo('2026-09-14', days, cfg)!.phase).toBe('ovulation'); // day 16
    const late = cycleInfo('2026-09-25', days, cfg)!;
    expect(late.phase).toBe('luteal');
    expect(late.nextStart).toBe('2026-09-29');
    expect(late.daysUntilNext).toBe(4);
  });

  it('keeps predicting when no new period is logged', () => {
    const c = cycleInfo('2026-10-01', days, cfg)!; // 2 days into predicted cycle
    expect(c.cycleDay).toBe(3);
    expect(c.phase).toBe('period');
    expect(c.nextStart).toBe('2026-10-29');
  });

  it('treats an ongoing, not-yet-logged period day as period', () => {
    const d = log([['2026-07-01', 4], ['2026-07-31', 4], ['2026-08-30', 2]]);
    expect(cycleInfo('2026-09-01', d, cfg)!.phase).toBe('period');
    expect(cycleInfo('2026-09-03', d, cfg)!.phase).toBe('follicular');
  });

  it('adds luteal kcal only when enabled', () => {
    expect(cycleKcalAdjustment('2026-09-25', days, cfg)).toBe(150);
    expect(cycleKcalAdjustment('2026-09-05', days, cfg)).toBe(0);
    expect(cycleKcalAdjustment('2026-09-25', days, { ...cfg, lutealBoost: false })).toBe(0);
    expect(cycleKcalAdjustment('2026-09-25', days, { ...cfg, enabled: false })).toBe(0);
  });

  it('flags water retention before and early in the period', () => {
    expect(waterRetentionLikely('2026-09-26', days, cfg)).toBe(true);
    expect(waterRetentionLikely('2026-09-10', days, cfg)).toBe(false);
  });

  it('predicts upcoming period and fertile days', () => {
    const p = predictedPeriodDays('2026-09-01', '2026-10-31', days, cfg);
    expect([...p].sort()).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-29', '2026-10-30', '2026-10-31']);
    const f = fertileDays('2026-09-01', '2026-09-30', days, cfg);
    expect([...f].sort()).toEqual(['2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16']);
  });

  it('returns null before any period is logged', () => {
    expect(cycleInfo('2026-06-01', days, cfg)).toBeNull();
  });
});
