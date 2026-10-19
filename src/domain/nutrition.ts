import type { Food, LogEntry, Nutrients } from './types';

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Nutrients for `amount` of a unit weighing `unitGrams` of `food`. */
export function entryNutrients(food: Pick<Food, 'per100'>, unitGrams: number, amount: number): Nutrients {
  const factor = (amount * unitGrams) / 100;
  const p = food.per100;
  const out: Nutrients = {
    kcal: Math.round(p.kcal * factor),
    protein: r1(p.protein * factor),
    carbs: r1(p.carbs * factor),
    fat: r1(p.fat * factor),
  };
  if (p.fiber != null) out.fiber = r1(p.fiber * factor);
  if (p.sugar != null) out.sugar = r1(p.sugar * factor);
  if (p.satFat != null) out.satFat = r1(p.satFat * factor);
  if (p.sodium != null) out.sodium = Math.round(p.sodium * factor);
  return out;
}

export const emptyNutrients = (): Nutrients => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 });

export function sumNutrients(list: Nutrients[]): Nutrients {
  let kcal = 0, protein = 0, carbs = 0, fat = 0, fiber = 0, sugar = 0, sodium = 0;
  for (const n of list) {
    kcal += n.kcal;
    protein += n.protein;
    carbs += n.carbs;
    fat += n.fat;
    fiber += n.fiber ?? 0;
    sugar += n.sugar ?? 0;
    sodium += n.sodium ?? 0;
  }
  return { kcal: Math.round(kcal), protein: r1(protein), carbs: r1(carbs), fat: r1(fat), fiber: r1(fiber), sugar: r1(sugar), sodium: Math.round(sodium) };
}

export const entriesTotal = (entries: LogEntry[]) => sumNutrients(entries.map((e) => e.snapshot));

/** Percent of calories from protein / carbs / fat. */
export function macroSplit(n: Nutrients): { protein: number; carbs: number; fat: number } {
  const p = n.protein * 4, c = n.carbs * 4, f = n.fat * 9;
  const total = p + c + f;
  if (!total) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: Math.round((p / total) * 100), carbs: Math.round((c / total) * 100), fat: Math.round((f / total) * 100) };
}

/** Remaining kcal: goal − eaten + burned (burned only if added back). */
export function caloriesLeft(goal: number, eaten: number, burned: number, addBack: boolean): number {
  return Math.round(goal - eaten + (addBack ? burned : 0));
}

/** Macro sanity check used by the seed validator: 4P + 4C + 9F ≈ kcal. Returns relative error. */
export function macroKcalError(n: Nutrients): number {
  const calc = 4 * n.protein + 4 * n.carbs + 9 * n.fat;
  if (n.kcal < 25 && calc < 30) return 0;
  return Math.abs(calc - n.kcal) / Math.max(n.kcal, 1);
}

/** Convert "per serving" values into per-100 g values. */
export function perServingToPer100(n: Nutrients, servingGrams: number): Nutrients {
  return entryNutrients({ per100: n }, 100 / servingGrams, 100);
}
