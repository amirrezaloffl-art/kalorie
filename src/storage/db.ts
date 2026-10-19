import Dexie, { type Table } from 'dexie';
import type { DayLog, Exercise, ExerciseRoutine, Food, MealTemplate, Recipe, UnitDef, WeightEntry } from '../domain/types';

export interface KV {
  key: string;
  value: unknown;
}

export interface ImageRow {
  id: string;
  blob: Blob;
}

/** Live on-device store (IndexedDB). JSON files are a mirror / backup of this. */
export class KaloriDB extends Dexie {
  kv!: Table<KV, string>;
  foods!: Table<Food, string>; // custom + recipe foods only (base foods ship read-only)
  recipes!: Table<Recipe, string>;
  days!: Table<DayLog, string>;
  weights!: Table<WeightEntry, string>;
  exercises!: Table<Exercise, string>; // custom exercises only
  routines!: Table<ExerciseRoutine, string>;
  templates!: Table<MealTemplate, string>;
  units!: Table<UnitDef, string>; // custom units
  images!: Table<ImageRow, string>;

  constructor(name = 'kalori') {
    super(name);
    this.version(1).stores({
      kv: 'key',
      foods: 'id, barcode',
      recipes: 'foodId',
      days: 'date',
      weights: 'id, date',
      exercises: 'id',
      routines: 'id',
      templates: 'id',
      units: 'id',
      images: 'id',
    });
  }
}

export const db = new KaloriDB();

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}

export const kvSet = (key: string, value: unknown) => db.kv.put({ key, value });

/** Ask the browser not to evict our storage (important on iOS). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}
