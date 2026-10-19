import type { Nutrients } from './types';

export type ScorePart = 'protein' | 'fiber' | 'sugar' | 'sodium' | 'satFat';

export interface HealthScore {
  score: number;
  parts: { key: ScorePart; points: number }[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Simple, transparent 0-100 score per food (§8.5). */
export function healthScore(n: Nutrients): HealthScore {
  const kcal = Math.max(n.kcal, 1);
  const per100kcal = (v: number) => (v / kcal) * 100;
  const protein = clamp((per100kcal(n.protein) / 10) * 20, 0, 20); // 10 g per 100 kcal → +20
  const fiber = clamp((per100kcal(n.fiber ?? 0) / 5) * 15, 0, 15); // 5 g per 100 kcal → +15
  const sugar = -clamp(((((n.sugar ?? 0) * 4) / kcal) / 0.5) * 20, 0, 20); // 50 % kcal from sugar → −20
  const sodium = -clamp((per100kcal(n.sodium ?? 0) / 400) * 15, 0, 15); // 400 mg per 100 kcal → −15
  const satFat = -clamp(((((n.satFat ?? 0) * 9) / kcal) / 0.2) * 10, 0, 10); // 20 % kcal from sat. fat → −10
  const parts: HealthScore['parts'] = [
    { key: 'protein', points: Math.round(protein) },
    { key: 'fiber', points: Math.round(fiber) },
    { key: 'sugar', points: Math.round(sugar) },
    { key: 'sodium', points: Math.round(sodium) },
    { key: 'satFat', points: Math.round(satFat) },
  ];
  return { score: clamp(Math.round(50 + protein + fiber + sugar + sodium + satFat), 0, 100), parts };
}

export const scoreTone = (s: number): 'good' | 'warn' | 'bad' => (s >= 70 ? 'good' : s >= 40 ? 'warn' : 'bad');
