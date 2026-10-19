import JSZip from 'jszip';
import type { DayLog, Exercise, ExerciseRoutine, Food, MealTemplate, Recipe, Settings, UnitDef, UnitOverrides, WeightEntry } from '../domain/types';
import { migrateSettings } from './migrations';

export const SCHEMA_VERSION = 1;

/** Everything the user owns. Base foods/exercises/units ship with the app and are not part of it. */
export interface AppData {
  settings: Settings;
  customFoods: Food[];
  recipes: Recipe[];
  customUnits: UnitDef[];
  overrides: UnitOverrides;
  favorites: { foods: string[]; exercises: string[] };
  templates: MealTemplate[];
  weights: WeightEntry[];
  customExercises: Exercise[];
  routines: ExerciseRoutine[];
  days: Record<string, DayLog>;
  images: Record<string, Blob>;
}

const wrap = (key: string, data: unknown) => JSON.stringify({ version: SCHEMA_VERSION, [key]: data }, null, 2);

/** Paths of the per-month log files touched by the given days. */
export const monthFile = (month: string) => `logs/${month}.json`;

export function monthPayload(days: Record<string, DayLog>, month: string): string {
  const out: Record<string, DayLog> = {};
  for (const [date, d] of Object.entries(days)) if (date.startsWith(month)) out[date] = d;
  return wrap('days', out);
}

const imageExt = (b: Blob) => (b.type === 'image/png' ? 'png' : b.type === 'image/webp' ? 'webp' : 'jpg');

/** Builds the folder layout from §9.1 as path → content. */
export function buildFiles(d: AppData, only?: { months?: string[]; core?: boolean; images?: boolean }): Record<string, string | Blob> {
  const files: Record<string, string | Blob> = {};
  if (!only || only.core) {
    files['settings.json'] = wrap('settings', d.settings);
    files['foods.custom.json'] = wrap('foods', d.customFoods);
    files['recipes.json'] = wrap('recipes', d.recipes);
    files['units.library.json'] = wrap('units', d.customUnits);
    files['units.overrides.json'] = wrap('overrides', d.overrides);
    files['favorites.json'] = wrap('favorites', d.favorites);
    files['templates.json'] = wrap('templates', d.templates);
    files['weights.json'] = wrap('weights', d.weights);
    files['exercises.custom.json'] = wrap('exercises', d.customExercises);
    files['routines.json'] = wrap('routines', d.routines);
  }
  const months = only?.months ?? [...new Set(Object.keys(d.days).map((k) => k.slice(0, 7)))];
  for (const m of months) files[monthFile(m)] = monthPayload(d.days, m);
  if (!only || only.images) {
    for (const [id, blob] of Object.entries(d.images)) files[`images/${id}.${imageExt(blob)}`] = blob;
  }
  return files;
}

export async function exportZip(d: AppData): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder('Kalori')!;
  for (const [path, content] of Object.entries(buildFiles(d))) root.file(path, content);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/** Parses a backup (ZIP or a folder's files) back into AppData. Throws on unreadable input. */
export async function parseFiles(read: (path: string) => Promise<string | null>, list: (dir: string) => Promise<string[]>, readBlob: (path: string) => Promise<Blob | null>): Promise<AppData> {
  const json = async <T>(path: string, key: string, fallback: T): Promise<T> => {
    const raw = await read(path);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed?.[key] ?? fallback) as T;
  };
  const settingsRaw = await json<Partial<Settings> | null>('settings.json', 'settings', null);
  if (!settingsRaw) throw new Error('settings.json missing');
  const days: Record<string, DayLog> = {};
  for (const f of await list('logs')) {
    if (!f.endsWith('.json')) continue;
    Object.assign(days, await json<Record<string, DayLog>>(`logs/${f}`, 'days', {}));
  }
  const images: Record<string, Blob> = {};
  for (const f of await list('images')) {
    const b = await readBlob(`images/${f}`);
    if (b) images[f.replace(/\.[^.]+$/, '')] = b;
  }
  return {
    settings: migrateSettings(settingsRaw),
    customFoods: await json('foods.custom.json', 'foods', []),
    recipes: await json('recipes.json', 'recipes', []),
    customUnits: await json('units.library.json', 'units', []),
    overrides: await json('units.overrides.json', 'overrides', {}),
    favorites: await json('favorites.json', 'favorites', { foods: [], exercises: [] }),
    templates: await json('templates.json', 'templates', []),
    weights: await json('weights.json', 'weights', []),
    customExercises: await json('exercises.custom.json', 'exercises', []),
    routines: await json('routines.json', 'routines', []),
    days,
    images,
  };
}

export async function importZip(file: Blob): Promise<AppData> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  // Accept both "Kalori/settings.json" and "settings.json" at the root.
  const prefix = zip.file('settings.json') ? '' : Object.keys(zip.files).find((p) => p.endsWith('/settings.json'))?.replace('settings.json', '') ?? '';
  const read = async (p: string) => (await zip.file(prefix + p)?.async('string')) ?? null;
  const readBlob = async (p: string) => {
    const b = await zip.file(prefix + p)?.async('blob');
    if (!b) return null;
    const ext = p.split('.').pop();
    return new Blob([b], { type: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg' });
  };
  const list = async (dir: string) =>
    Object.keys(zip.files)
      .filter((p) => p.startsWith(`${prefix}${dir}/`) && !zip.files[p].dir)
      .map((p) => p.slice(`${prefix}${dir}/`.length))
      .filter((p) => !p.includes('/'));
  return parseFiles(read, list, readBlob);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** iOS: hand the ZIP to the share sheet so it can be saved to Files / iCloud Drive. */
export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'application/zip' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  downloadBlob(blob, filename);
}
