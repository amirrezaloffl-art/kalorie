import type { Settings } from './types';

/** Accepts a Gregorian (1995) or Jalali (1374) birth year. */
export function ageFromBirthYear(birthYear: number, today = new Date()): number {
  const gregorian = birthYear < 1700 ? birthYear + 621 : birthYear;
  return today.getFullYear() - gregorian;
}

/** Mifflin-St Jeor */
export function bmr(sex: 'male' | 'female', kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function tdee(s: Settings, kg: number, today = new Date()): number {
  const p = s.profile;
  return bmr(p.sex, kg, p.heightCm, ageFromBirthYear(p.birthYear, today)) * p.activity;
}

export const kcalFloor = (sex: 'male' | 'female') => (sex === 'male' ? 1500 : 1200);

/** Daily goal from TDEE and the weekly rate (kg/week): lose → deficit, gain → surplus. */
export function dailyGoal(s: Settings, kg: number, today = new Date()): { kcal: number; belowFloor: boolean; tdee: number } {
  const t = tdee(s, kg, today);
  const delta = (s.goal.weeklyRateKg * 7700) / 7;
  const raw = s.goal.type === 'lose' ? t - delta : s.goal.type === 'gain' ? t + delta : t;
  const kcal = Math.round(raw / 10) * 10;
  return { kcal, belowFloor: kcal < kcalFloor(s.profile.sex), tdee: Math.round(t) };
}

/** Macro grams from percentages of a kcal goal. */
export function macrosFromPercent(kcal: number, pPct: number, cPct: number, fPct: number) {
  return {
    proteinG: Math.round((kcal * pPct) / 100 / 4),
    carbsG: Math.round((kcal * cPct) / 100 / 4),
    fatG: Math.round((kcal * fPct) / 100 / 9),
  };
}

export function macroTargets(s: Settings) {
  const m = s.macros;
  if (m.mode === 'percent') return macrosFromPercent(s.goal.dailyKcal, m.proteinPct, m.carbsPct, m.fatPct);
  return { proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG };
}
