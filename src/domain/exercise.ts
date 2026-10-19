import type { Exercise, Intensity, StrengthSet } from './types';

const ORDER: Intensity[] = ['light', 'moderate', 'vigorous'];

/** MET for an intensity; falls back to the nearest defined intensity. */
export function metFor(ex: Exercise, intensity: Intensity): number {
  if (ex.met[intensity] != null) return ex.met[intensity]!;
  const i = ORDER.indexOf(intensity);
  for (let d = 1; d < 3; d++) {
    const lo = ORDER[i - d], hi = ORDER[i + d];
    if (lo && ex.met[lo] != null) return ex.met[lo]!;
    if (hi && ex.met[hi] != null) return ex.met[hi]!;
  }
  return 3;
}

/**
 * kcal = MET × kg × hours. In 'net' mode the resting 1 MET is subtracted,
 * so only calories above what the body burns anyway go back into the budget.
 */
export function exerciseKcal(met: number, kg: number, minutes: number, mode: 'net' | 'gross'): number {
  const m = mode === 'net' ? Math.max(met - 1, 0) : met;
  return Math.round(m * kg * (minutes / 60));
}

export const availableIntensities = (ex: Exercise): Intensity[] => ORDER.filter((i) => ex.met[i] != null);

/** Total lifted volume (kg) for strength sets. */
export const setsVolume = (sets: StrengthSet[] = []) => sets.reduce((a, s) => a + s.reps * (s.kg ?? 0), 0);
