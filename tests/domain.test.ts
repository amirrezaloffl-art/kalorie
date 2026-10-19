import { describe, expect, it } from 'vitest';
import { caloriesLeft, entryNutrients, macroSplit, perServingToPer100, sumNutrients } from '../src/domain/nutrition';
import { defaultUnit, foodUnits, unitGrams } from '../src/domain/units';
import { ageFromBirthYear, bmr, dailyGoal, macrosFromPercent } from '../src/domain/tdee';
import { ewma, projectGoalDate, weeklySlope } from '../src/domain/trend';
import { healthScore, scoreTone } from '../src/domain/healthScore';
import { exerciseKcal, metFor, setsVolume } from '../src/domain/exercise';
import { DEFAULT_SETTINGS } from '../src/domain/defaults';
import { normalizeFa } from '../src/search/normalize';
import { fmtAmount, fmtNum, parseNum, toDigits } from '../src/utils/digits';
import { fmtDate, weekOf } from '../src/utils/dates';
import { migrateSettings } from '../src/storage/migrations';
import type { Exercise, Food } from '../src/domain/types';

const rice: Food = {
  id: 'base:rice',
  source: 'base',
  name: { fa: 'چلو', en: 'Rice' },
  category: 'rice',
  basis: 'g',
  per100: { kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4 },
  units: [{ unitId: 'gram', grams: 1 }, { unitId: 'kafgir', grams: 80, isDefault: true }, { unitId: 'boshghab', grams: 300 }],
  dataQuality: 'table',
};

const milk: Food = {
  id: 'base:milk',
  source: 'base',
  name: { fa: 'شیر', en: 'Milk' },
  category: 'dairy',
  basis: 'ml',
  per100: { kcal: 46, protein: 3.3, carbs: 4.8, fat: 1.5 },
  units: [{ unitId: 'livan', grams: 250, isDefault: true }],
  densityGPerMl: 1.03,
  dataQuality: 'table',
};

describe('nutrition', () => {
  it('scales per-100 values by unit grams and amount', () => {
    const n = entryNutrients(rice, 80, 2); // 2 kafgir = 160 g
    expect(n.kcal).toBe(208);
    expect(n.protein).toBe(4.3);
    expect(n.carbs).toBe(45.1);
    expect(n.fiber).toBe(0.6);
  });

  it('sums snapshots and computes macro split', () => {
    const t = sumNutrients([entryNutrients(rice, 100, 1), entryNutrients(rice, 100, 1)]);
    expect(t.kcal).toBe(260);
    const s = macroSplit({ kcal: 0, protein: 25, carbs: 50, fat: 11.1 });
    expect(s.protein + s.carbs + s.fat).toBeGreaterThanOrEqual(99);
    expect(s.carbs).toBe(50);
  });

  it('calories left = goal − eaten + burned (only when added back)', () => {
    expect(caloriesLeft(2000, 1500, 300, true)).toBe(800);
    expect(caloriesLeft(2000, 1500, 300, false)).toBe(500);
  });

  it('converts per-serving to per-100 g (biscuit: 12 g = 55 kcal)', () => {
    const p = perServingToPer100({ kcal: 55, protein: 0.8, carbs: 8, fat: 2.2 }, 12);
    expect(p.kcal).toBe(458);
    expect(p.fat).toBeCloseTo(18.3, 1);
  });
});

describe('units', () => {
  it('uses per-food grams and personal overrides', () => {
    expect(unitGrams(rice, 'kafgir')).toBe(80);
    expect(unitGrams(rice, 'kafgir', { 'base:rice|kafgir': 65 })).toBe(65);
    expect(unitGrams(rice, 'gram')).toBe(1);
  });

  it('picks the default unit', () => {
    expect(defaultUnit(rice).unitId).toBe('kafgir');
  });

  it('adds ml/gram conversion for liquids with density', () => {
    const units = foodUnits(milk).map((u) => u.unitId);
    expect(units).toEqual(['ml', 'livan', 'gram']);
    // 103 g of milk ≈ 100 ml
    expect(unitGrams(milk, 'gram') * 103).toBeCloseTo(100, 0);
  });
});

describe('tdee', () => {
  it('Mifflin-St Jeor', () => {
    expect(bmr('male', 80, 180, 30)).toBe(1780);
    expect(bmr('female', 60, 165, 30)).toBeCloseTo(1320.25, 2);
  });

  it('accepts Jalali birth years', () => {
    const now = new Date('2026-10-19');
    expect(ageFromBirthYear(1995, now)).toBe(31);
    expect(ageFromBirthYear(1374, now)).toBe(31);
  });

  it('daily goal subtracts weekly rate deficit', () => {
    const s = { ...DEFAULT_SETTINGS, profile: { sex: 'male' as const, birthYear: 1996, heightCm: 180, activity: 1.2 as const } };
    const g = dailyGoal({ ...s, goal: { ...s.goal, type: 'lose', weeklyRateKg: 0.5 } }, 80, new Date('2026-06-01'));
    // BMR 1780 (age 30) × 1.2 = 2136; − 550 = 1586 → 1590
    expect(g.tdee).toBe(2136);
    expect(g.kcal).toBe(1590);
    expect(g.belowFloor).toBe(false);
    const m = dailyGoal({ ...s, goal: { ...s.goal, type: 'maintain' } }, 80, new Date('2026-06-01'));
    expect(m.kcal).toBe(2140);
  });

  it('macro grams from percentages', () => {
    expect(macrosFromPercent(2000, 30, 40, 30)).toEqual({ proteinG: 150, carbsG: 200, fatG: 67 });
  });
});

describe('trend', () => {
  const w = (date: string, kg: number) => ({ id: date, date, kg });
  const entries = [w('2026-09-01', 90), w('2026-09-08', 89.4), w('2026-09-15', 89.1), w('2026-09-22', 88.4), w('2026-09-29', 88)];

  it('ewma smooths values', () => {
    expect(ewma([10, 20], 0.5)).toEqual([10, 15]);
  });

  it('weekly slope is about −0.5 kg/week', () => {
    expect(weeklySlope(entries)!).toBeCloseTo(-0.5, 1);
  });

  it('projects goal date in the future, null when moving away', () => {
    const eta = projectGoalDate(entries, 85)!;
    expect(eta > '2026-09-29').toBe(true);
    expect(projectGoalDate(entries, 95)).toBeNull();
  });
});

describe('health score', () => {
  it('rewards protein and penalizes sugar', () => {
    const chicken = healthScore({ kcal: 165, protein: 31, carbs: 0, fat: 3.6, sodium: 74 });
    const soda = healthScore({ kcal: 42, protein: 0, carbs: 10.6, fat: 0, sugar: 10.6 });
    expect(chicken.score).toBeGreaterThan(65);
    expect(soda.score).toBeLessThan(40);
    expect(scoreTone(chicken.score)).not.toBe('bad');
    expect(scoreTone(soda.score)).toBe('bad');
  });
});

describe('exercise', () => {
  const yoga: Exercise = {
    id: 'base:power-yoga', source: 'base', name: { fa: 'پاور یوگا', en: 'Power yoga' }, category: 'yoga',
    met: { light: 3, moderate: 4, vigorous: 5 }, defaultIntensity: 'moderate', dataQuality: 'compendium',
  };
  it('MET × kg × hours, net subtracts resting MET', () => {
    expect(exerciseKcal(4, 80, 45, 'gross')).toBe(240);
    expect(exerciseKcal(4, 80, 45, 'net')).toBe(180);
  });
  it('falls back to the nearest intensity', () => {
    expect(metFor({ ...yoga, met: { light: 2 } }, 'vigorous')).toBe(2);
    expect(metFor(yoga, 'vigorous')).toBe(5);
  });
  it('strength volume', () => {
    expect(setsVolume([{ name: 'squat', reps: 10, kg: 40 }, { name: 'squat', reps: 8, kg: 50 }])).toBe(800);
  });
});

describe('persian text', () => {
  it('normalizes Arabic letters, ZWNJ and digits', () => {
    expect(normalizeFa('قورمه‌سبزي')).toBe('قورمه سبزی');
    expect(normalizeFa('كباب  كوبيده')).toBe('کباب کوبیده');
    expect(normalizeFa('۱۲۳')).toBe('123');
    expect(normalizeFa('Rice')).toBe('rice');
  });

  it('digits round-trip', () => {
    expect(toDigits('12.5', 'fa')).toBe('۱۲٫۵');
    expect(parseNum('۱۲٫۵')).toBe(12.5);
    expect(parseNum('٣')).toBe(3);
    expect(fmtNum(1286, 'fa')).toBe('۱٬۲۸۶');
    expect(fmtNum(1286, 'latin')).toBe('1,286');
    expect(fmtAmount(1.5, 'fa')).toBe('۱½');
    expect(fmtAmount(0.25, 'latin')).toBe('¼');
  });
});

describe('dates', () => {
  it('formats Jalali in Persian', () => {
    expect(fmtDate('2026-10-19', 'D MMMM YYYY', { calendar: 'jalali', lang: 'fa', digits: 'fa' })).toBe('۲۷ مهر ۱۴۰۵');
  });
  it('formats Gregorian in English', () => {
    expect(fmtDate('2026-10-19', 'MMM D, YYYY', { calendar: 'gregorian', lang: 'en', digits: 'latin' })).toBe('Oct 19, 2026');
  });
  it('Jalali with English UI uses transliterated month names', () => {
    expect(fmtDate('2026-10-19', 'D MMMM YYYY', { calendar: 'jalali', lang: 'en', digits: 'latin' })).toBe('27 Mehr 1405');
  });
  it('weeks start on Saturday or Monday', () => {
    expect(weekOf('2026-10-19', 'sat')[0]).toBe('2026-10-17');
    expect(weekOf('2026-10-19', 'mon')[0]).toBe('2026-10-19');
  });
});

describe('migrations', () => {
  it('fills missing settings with defaults', () => {
    const s = migrateSettings({ userName: 'یاسین', water: { glassMl: 200 } } as never);
    expect(s.userName).toBe('یاسین');
    expect(s.water.glassMl).toBe(200);
    expect(s.water.goalGlasses).toBe(8);
    expect(s.meals).toHaveLength(5);
    expect(s.version).toBe(1);
  });
});
