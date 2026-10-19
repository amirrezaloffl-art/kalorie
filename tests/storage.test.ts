import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildFiles, importZip, type AppData } from '../src/storage/files';
import { DEFAULT_SETTINGS } from '../src/domain/defaults';
import { SearchIndex } from '../src/search';
import foods from '../src/data/foods.base.json';
import type { Food } from '../src/domain/types';

const data: AppData = {
  settings: { ...DEFAULT_SETTINGS, userName: 'Yasin', onboarded: true },
  customFoods: [
    {
      id: 'custom:biscuit', source: 'custom', name: { fa: 'بیسکوییت مادر', en: 'Madar biscuit' }, category: 'snack', basis: 'g',
      per100: { kcal: 458, protein: 7, carbs: 70, fat: 17 }, units: [{ unitId: 'gram', grams: 1 }, { unitId: 'adad', grams: 12, isDefault: true }, { unitId: 'baste', grams: 120 }],
      dataQuality: 'measured', barcode: '6260100300011',
    },
  ],
  recipes: [],
  customUnits: [],
  overrides: { 'base:rice-chelow|kafgir': 65 },
  favorites: { foods: ['custom:biscuit'], exercises: [] },
  templates: [],
  weights: [{ id: 'w1', date: '2026-10-17', kg: 82.4 }],
  customExercises: [],
  routines: [],
  days: {
    '2026-10-19': { date: '2026-10-19', entries: [], exercises: [], waterGlasses: 5 },
    '2026-09-30': { date: '2026-09-30', entries: [], exercises: [], waterGlasses: 3 },
  },
  images: {},
};

describe('backup files', () => {
  it('builds the §9.1 folder layout with schema versions', () => {
    const files = buildFiles(data);
    expect(Object.keys(files).sort()).toEqual(
      [
        'exercises.custom.json', 'favorites.json', 'foods.custom.json', 'logs/2026-09.json', 'logs/2026-10.json', 'recipes.json',
        'routines.json', 'settings.json', 'templates.json', 'units.library.json', 'units.overrides.json', 'weights.json',
      ].sort(),
    );
    const settings = JSON.parse(files['settings.json'] as string);
    expect(settings.version).toBe(1);
    expect(JSON.parse(files['logs/2026-10.json'] as string).days['2026-10-19'].waterGlasses).toBe(5);
  });

  it('only writes dirty months on incremental mirror', () => {
    const files = buildFiles(data, { months: ['2026-10'], core: false, images: false });
    expect(Object.keys(files)).toEqual(['logs/2026-10.json']);
  });

  it('round-trips through a ZIP', async () => {
    const zip = new JSZip();
    const root = zip.folder('Kalori')!;
    for (const [p, c] of Object.entries(buildFiles(data))) root.file(p, c);
    const blob = await zip.generateAsync({ type: 'uint8array' });
    const back = await importZip(new Blob([blob]));
    expect(back.settings.userName).toBe('Yasin');
    expect(back.customFoods[0].units).toHaveLength(3);
    expect(back.overrides['base:rice-chelow|kafgir']).toBe(65);
    expect(Object.keys(back.days).sort()).toEqual(['2026-09-30', '2026-10-19']);
    expect(back.weights[0].kg).toBe(82.4);
  });

  it('rejects a zip without settings.json', async () => {
    const zip = new JSZip();
    zip.file('hello.txt', 'x');
    await expect(importZip(new Blob([await zip.generateAsync({ type: 'uint8array' })]))).rejects.toThrow();
  });
});

describe('search', () => {
  const idx = new SearchIndex(foods.foods as Food[]);
  const none = { favorites: new Set<string>(), recent: [] };
  it('finds the same item in Persian and English', () => {
    expect(idx.search('برنج', none)[0].category).toBe('rice');
    expect(idx.search('rice', none)[0].category).toBe('rice');
  });
  it('tolerates Arabic letters and missing ZWNJ', () => {
    expect(idx.search('قورمه سبزي', none)[0].id).toBe('base:stew-ghormeh-sabzi');
    expect(idx.search('كوبيده', none)[0].id).toMatch(/koobideh/);
  });
  it('boosts favorites', () => {
    const plain = idx.search('کباب', none).map((f) => f.id);
    const fav = idx.search('کباب', { favorites: new Set([plain[5]]), recent: [] }).map((f) => f.id);
    expect(fav.indexOf(plain[5])).toBeLessThan(5);
  });
});
