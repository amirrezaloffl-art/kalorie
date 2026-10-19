import type { Food, FoodUnit, UnitOverrides } from './types';

export const overrideKey = (foodId: string, unitId: string) => `${foodId}|${unitId}`;

/** Units for a food, always including the base mass/volume unit, plus g↔ml when density is known. */
export function foodUnits(food: Food): FoodUnit[] {
  const list = [...food.units];
  const baseId = food.basis === 'ml' ? 'ml' : 'gram';
  if (!list.some((u) => u.unitId === baseId)) list.unshift({ unitId: baseId, grams: 1 });
  if (food.densityGPerMl) {
    const otherId = food.basis === 'ml' ? 'gram' : 'ml';
    if (!list.some((u) => u.unitId === otherId)) {
      list.push({ unitId: otherId, grams: food.basis === 'ml' ? 1 / food.densityGPerMl : food.densityGPerMl });
    }
  }
  return list;
}

/** Grams (or ml, in the food's basis) in one `unitId` of `food`, honoring calibration overrides. */
export function unitGrams(food: Food, unitId: string, overrides: UnitOverrides = {}): number {
  const o = overrides[overrideKey(food.id, unitId)];
  if (o) return o;
  return foodUnits(food).find((x) => x.unitId === unitId)?.grams ?? 1;
}

export function defaultUnit(food: Food): FoodUnit {
  const units = foodUnits(food);
  return units.find((u) => u.isDefault) ?? units.find((u) => u.unitId !== 'gram' && u.unitId !== 'ml') ?? units[0];
}

/** Grams equivalent (for display) of an amount stored in the food's basis. */
export function toGrams(food: Food, basisAmount: number): number {
  return food.basis === 'ml' ? basisAmount * (food.densityGPerMl ?? 1) : basisAmount;
}
