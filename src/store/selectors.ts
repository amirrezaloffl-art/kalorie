import { useMemo } from 'react';
import { caloriesLeft, entriesTotal } from '../domain/nutrition';
import { macroTargets } from '../domain/tdee';
import { foodIndex, exerciseIndex } from '../search';
import { emptyDay, useApp } from './app';
import { addDays, weekOf } from '../utils/dates';
import type { DayLog } from '../domain/types';

export function useDay(date: string): DayLog {
  const d = useApp((s) => s.days[date]);
  return useMemo(() => d ?? emptyDay(date), [d, date]);
}

export function dayStats(day: DayLog, goal: number, addBack: boolean) {
  const eaten = entriesTotal(day.entries);
  const burned = day.exercises.reduce((a, e) => a + e.kcal, 0);
  const minutes = day.exercises.reduce((a, e) => a + e.minutes, 0);
  return { eaten, burned, minutes, left: caloriesLeft(goal, eaten.kcal, burned, addBack) };
}

export function useDayStats(date: string) {
  const day = useDay(date);
  const settings = useApp((s) => s.settings);
  return useMemo(() => {
    const st = dayStats(day, settings.goal.dailyKcal, settings.exercise.addBackToBudget);
    return { ...st, day, goal: settings.goal.dailyKcal, targets: macroTargets(settings) };
  }, [day, settings]);
}

/** Active minutes for the week containing `date`. */
export function useWeekMinutes(date: string) {
  const days = useApp((s) => s.days);
  const start = useApp((s) => s.settings.weekStart);
  return useMemo(() => weekOf(date, start).reduce((a, d) => a + (days[d]?.exercises.reduce((x, e) => x + e.minutes, 0) ?? 0), 0), [days, date, start]);
}

export function useFoodIndex() {
  const base = useApp((s) => s.baseFoods);
  const custom = useApp((s) => s.customFoods);
  return useMemo(() => foodIndex([...custom, ...base]), [base, custom]);
}

export function useExerciseIndex() {
  const base = useApp((s) => s.baseExercises);
  const custom = useApp((s) => s.customExercises);
  return useMemo(() => exerciseIndex([...custom, ...base]), [base, custom]);
}

export function useFoodMap() {
  const base = useApp((s) => s.baseFoods);
  const custom = useApp((s) => s.customFoods);
  return useMemo(() => new Map([...base, ...custom].map((f) => [f.id, f])), [base, custom]);
}

/** Days in [from, to] as logs (empty when not logged). */
export function useRange(from: string, n: number) {
  const days = useApp((s) => s.days);
  return useMemo(() => Array.from({ length: n }, (_, i) => days[addDays(from, i)] ?? emptyDay(addDays(from, i))), [days, from, n]);
}
