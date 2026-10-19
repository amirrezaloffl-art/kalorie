import { describe, expect, it } from 'vitest';
import foods from '../src/data/foods.base.json';
import units from '../src/data/units.base.json';
import exercises from '../src/data/exercises.base.json';
import type { Food } from '../src/domain/types';

const list = foods.foods as Food[];
const unitIds = new Set(units.units.map((u) => u.id));

describe('food database', () => {
  it('has 400+ foods with unique ids', () => {
    expect(list.length).toBeGreaterThanOrEqual(400);
    expect(new Set(list.map((f) => f.id)).size).toBe(list.length);
  });

  it('every food has ≥2 units (base + household), all known', () => {
    for (const f of list) {
      expect(f.units.length, f.id).toBeGreaterThanOrEqual(2);
      for (const u of f.units) {
        expect(unitIds.has(u.unitId), `${f.id} ${u.unitId}`).toBe(true);
        expect(u.grams, f.id).toBeGreaterThan(0);
      }
      expect(f.units.filter((u) => u.isDefault).length, f.id).toBe(1);
    }
  });

  it('macros roughly match kcal (4P + 4C + 9F, ±25 %)', () => {
    for (const f of list) {
      const p = f.per100;
      const calc = 4 * p.protein + 4 * p.carbs + 9 * p.fat;
      const calcFiber = calc - 2 * (p.fiber ?? 0);
      if (p.kcal < 25 && calc < 30) continue;
      const err = Math.min(Math.abs(calc - p.kcal), Math.abs(calcFiber - p.kcal)) / p.kcal;
      expect(err, f.id).toBeLessThanOrEqual(0.25);
    }
  });

  it('has bilingual names', () => {
    for (const f of list) {
      expect(f.name.fa.length, f.id).toBeGreaterThan(0);
      expect(f.name.en.length, f.id).toBeGreaterThan(0);
    }
  });
});

describe('exercise database', () => {
  it('includes power yoga and has MET values', () => {
    const ex = exercises.exercises;
    expect(ex.find((e) => e.id === 'base:power-yoga')).toBeTruthy();
    for (const e of ex) expect(Object.values(e.met).every((m) => typeof m === 'number' && m > 0), e.id).toBe(true);
  });
});
