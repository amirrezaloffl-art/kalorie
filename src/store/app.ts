import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../domain/defaults';
import { dailyGoal } from '../domain/tdee';
import { entryNutrients } from '../domain/nutrition';
import { unitGrams } from '../domain/units';
import { exerciseKcal, metFor } from '../domain/exercise';
import type {
  DayLog, Exercise, ExerciseEntry, ExerciseRoutine, Food, LogEntry, MealId, MealTemplate, Recipe, Settings, UnitDef, UnitOverrides, WeightEntry,
} from '../domain/types';
import { db, kvGet, kvSet, requestPersistence } from '../storage/db';
import { buildFiles, type AppData } from '../storage/files';
import { migrateSettings } from '../storage/migrations';
import { ensurePermission, folderSupported, getFolder, writeFiles } from '../storage/folder';
import { addDays, todayIso } from '../utils/dates';
import { uid } from '../utils/id';
import unitsBase from '../data/units.base.json';
import exercisesBase from '../data/exercises.base.json';

export type FolderState = 'unsupported' | 'none' | 'connected' | 'needsPermission' | 'error';

interface State {
  ready: boolean;
  settings: Settings;
  baseFoods: Food[];
  customFoods: Food[];
  recipes: Recipe[];
  units: UnitDef[];
  overrides: UnitOverrides;
  favorites: { foods: string[]; exercises: string[] };
  templates: MealTemplate[];
  weights: WeightEntry[];
  days: Record<string, DayLog>;
  baseExercises: Exercise[];
  customExercises: Exercise[];
  routines: ExerciseRoutine[];
  imageUrls: Record<string, string>;
  folder: FolderState;
  folderName?: string;
  lastMirrorAt?: string;
}

const baseUnits = unitsBase.units as UnitDef[];
const baseExercises = (exercisesBase.exercises as Omit<Exercise, 'source' | 'dataQuality'>[]).map(
  (e) => ({ ...e, source: 'base', dataQuality: 'compendium' }) as Exercise,
);

export const emptyDay = (date: string): DayLog => ({ date, entries: [], exercises: [], waterGlasses: 0 });

export const useApp = create<State>(() => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  baseFoods: [],
  customFoods: [],
  recipes: [],
  units: baseUnits,
  overrides: {},
  favorites: { foods: [], exercises: [] },
  templates: [],
  weights: [],
  days: {},
  baseExercises,
  customExercises: [],
  routines: [],
  imageUrls: {},
  folder: 'none',
}));

const get = () => useApp.getState();
const set = useApp.setState;

// ---------------------------------------------------------------- mirror to folder (desktop)

const dirty = { core: false, months: new Set<string>(), images: false };
let mirrorTimer: ReturnType<typeof setTimeout> | undefined;

function markDirty(kind: { core?: boolean; month?: string; images?: boolean }) {
  if (kind.core) dirty.core = true;
  if (kind.month) dirty.months.add(kind.month);
  if (kind.images) dirty.images = true;
  clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(flushMirror, 600);
}

export async function snapshot(): Promise<AppData> {
  const s = get();
  const images: Record<string, Blob> = {};
  for (const row of await db.images.toArray()) images[row.id] = row.blob;
  return {
    settings: s.settings,
    customFoods: s.customFoods,
    recipes: s.recipes,
    customUnits: s.units.filter((u) => u.custom),
    overrides: s.overrides,
    favorites: s.favorites,
    templates: s.templates,
    weights: s.weights,
    customExercises: s.customExercises,
    routines: s.routines,
    days: s.days,
    images,
  };
}

export async function flushMirror(all = false) {
  clearTimeout(mirrorTimer);
  if (get().folder !== 'connected') return;
  const handle = await getFolder();
  if (!handle) return;
  const pending = { core: dirty.core || all, months: [...dirty.months], images: dirty.images || all };
  dirty.core = false;
  dirty.months.clear();
  dirty.images = false;
  try {
    const data = await snapshot();
    const files = buildFiles(data, all ? undefined : { core: pending.core, months: pending.months, images: pending.images });
    await writeFiles(handle, files);
    set({ lastMirrorAt: new Date().toISOString() });
  } catch (e) {
    console.error('mirror failed', e);
    set({ folder: 'error' });
  }
}

export async function refreshFolderState() {
  if (!folderSupported()) return set({ folder: 'unsupported' });
  const h = await getFolder();
  if (!h) return set({ folder: 'none', folderName: undefined });
  const ok = await ensurePermission(h, false);
  set({ folder: ok ? 'connected' : 'needsPermission', folderName: h.name });
}

/** Must be called from a user gesture (permission prompt). */
export async function reconnectFolder() {
  const h = await getFolder();
  if (!h) return;
  if (await ensurePermission(h, true)) {
    set({ folder: 'connected', folderName: h.name });
    await flushMirror(true);
  }
}

// ---------------------------------------------------------------- init

export async function initApp() {
  const [settingsRaw, customFoods, recipes, customUnits, overrides, favorites, templates, weights, dayRows, customExercises, routines, images] =
    await Promise.all([
      kvGet<Partial<Settings> | null>('settings', null),
      db.foods.toArray(),
      db.recipes.toArray(),
      db.units.toArray(),
      kvGet<UnitOverrides>('overrides', {}),
      kvGet('favorites', { foods: [] as string[], exercises: [] as string[] }),
      db.templates.toArray(),
      db.weights.toArray(),
      db.days.toArray(),
      db.exercises.toArray(),
      db.routines.toArray(),
      db.images.toArray(),
    ]);
  const base = (await import('../data/foods.base.json')).default as { foods: Food[] };
  const days: Record<string, DayLog> = {};
  for (const d of dayRows) days[d.date] = d;
  const imageUrls: Record<string, string> = {};
  for (const img of images) imageUrls[img.id] = URL.createObjectURL(img.blob);
  set({
    ready: true,
    settings: migrateSettings(settingsRaw),
    baseFoods: base.foods,
    customFoods,
    recipes,
    units: [...baseUnits, ...customUnits.map((u) => ({ ...u, custom: true }))],
    overrides,
    favorites,
    templates,
    weights: weights.sort((a, b) => a.date.localeCompare(b.date)),
    days,
    customExercises,
    routines,
    imageUrls,
  });
  requestPersistence();
  await refreshFolderState();
  if (!listening) {
    listening = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushMirror();
    });
  }
}

let listening = false;

// ---------------------------------------------------------------- settings

export function updateSettings(fn: (s: Settings) => Settings) {
  const settings = fn(structuredClone(get().settings));
  set({ settings });
  kvSet('settings', settings);
  markDirty({ core: true });
}

export const latestWeightKg = () => {
  const w = get().weights;
  return w.length ? w[w.length - 1].kg : 70;
};

/** Recomputes the daily kcal goal from profile + latest weight unless it is set manually. */
export function recalcGoal() {
  const s = get().settings;
  if (s.goal.manualKcal) return;
  const { kcal } = dailyGoal(s, latestWeightKg());
  if (kcal !== s.goal.dailyKcal) updateSettings((x) => ({ ...x, goal: { ...x.goal, dailyKcal: kcal } }));
}

// ---------------------------------------------------------------- days

export const getDay = (date: string) => get().days[date] ?? emptyDay(date);

function saveDay(day: DayLog) {
  set({ days: { ...get().days, [day.date]: day } });
  db.days.put(day);
  markDirty({ month: day.date.slice(0, 7) });
}

export function mutateDay(date: string, fn: (d: DayLog) => DayLog) {
  saveDay(fn(structuredClone(getDay(date))));
}

// ---------------------------------------------------------------- foods & log

export const allFoods = () => [...get().customFoods, ...get().baseFoods];
export const findFood = (id: string) => get().customFoods.find((f) => f.id === id) ?? get().baseFoods.find((f) => f.id === id);

export function makeEntry(food: Food, unitId: string, amount: number, mealId: MealId, time = new Date().toISOString()): LogEntry {
  const grams = unitGrams(food, unitId, get().overrides);
  return {
    id: uid(),
    foodId: food.id,
    mealId,
    unitId,
    amount,
    grams: Math.round(grams * amount * 10) / 10,
    snapshot: entryNutrients(food, grams, amount),
    foodName: { ...food.name },
    time,
  };
}

export function addEntry(date: string, entry: LogEntry) {
  mutateDay(date, (d) => ({ ...d, entries: [...d.entries, entry] }));
}

export function updateEntry(date: string, id: string, patch: { unitId?: string; amount?: number; mealId?: MealId }) {
  mutateDay(date, (d) => ({
    ...d,
    entries: d.entries.map((e) => {
      if (e.id !== id) return e;
      const food = findFood(e.foodId);
      const unitId = patch.unitId ?? e.unitId;
      const amount = patch.amount ?? e.amount;
      if (!food) {
        // Food was deleted: scale the frozen snapshot instead.
        const k = amount / e.amount;
        const s = e.snapshot;
        return {
          ...e, ...patch, amount, grams: e.grams * k,
          snapshot: { ...s, kcal: Math.round(s.kcal * k), protein: s.protein * k, carbs: s.carbs * k, fat: s.fat * k, fiber: (s.fiber ?? 0) * k },
        };
      }
      const fresh = makeEntry(food, unitId, amount, patch.mealId ?? e.mealId, e.time);
      return { ...fresh, id: e.id };
    }),
  }));
}

export function removeEntry(date: string, id: string) {
  mutateDay(date, (d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }));
}

export function copyMeal(fromDate: string, toDate: string, mealId: MealId) {
  const src = getDay(fromDate).entries.filter((e) => e.mealId === mealId);
  if (!src.length) return 0;
  mutateDay(toDate, (d) => ({ ...d, entries: [...d.entries, ...src.map((e) => ({ ...e, id: uid(), time: new Date().toISOString() }))] }));
  return src.length;
}

export function setWater(date: string, glasses: number) {
  mutateDay(date, (d) => ({ ...d, waterGlasses: Math.max(0, glasses) }));
}

export function saveFood(food: Food) {
  const now = new Date().toISOString();
  const f = { ...food, updatedAt: now, createdAt: food.createdAt ?? now };
  const list = get().customFoods.filter((x) => x.id !== f.id);
  set({ customFoods: [f, ...list] });
  db.foods.put(f);
  markDirty({ core: true });
  return f;
}

export function deleteFood(id: string) {
  const food = findFood(id);
  set({ customFoods: get().customFoods.filter((f) => f.id !== id), recipes: get().recipes.filter((r) => r.foodId !== id) });
  db.foods.delete(id);
  db.recipes.delete(id);
  if (food?.imageId) deleteImage(food.imageId);
  markDirty({ core: true });
}

export function saveRecipe(recipe: Recipe, food: Food) {
  saveFood(food);
  set({ recipes: [recipe, ...get().recipes.filter((r) => r.foodId !== recipe.foodId)] });
  db.recipes.put(recipe);
  markDirty({ core: true });
}

export function toggleFavorite(kind: 'foods' | 'exercises', id: string) {
  const fav = get().favorites;
  const list = fav[kind].includes(id) ? fav[kind].filter((x) => x !== id) : [id, ...fav[kind]];
  const favorites = { ...fav, [kind]: list };
  set({ favorites });
  kvSet('favorites', favorites);
  markDirty({ core: true });
}

export function setOverride(foodId: string, unitId: string, grams: number | null) {
  const overrides = { ...get().overrides };
  const key = `${foodId}|${unitId}`;
  if (grams == null || !(grams > 0)) delete overrides[key];
  else overrides[key] = grams;
  set({ overrides });
  kvSet('overrides', overrides);
  markDirty({ core: true });
}

export function saveUnit(unit: UnitDef) {
  const u = { ...unit, custom: true };
  set({ units: [...get().units.filter((x) => x.id !== u.id), u] });
  db.units.put(u);
  markDirty({ core: true });
}

export function deleteUnit(id: string) {
  set({ units: get().units.filter((u) => u.id !== id || !u.custom) });
  db.units.delete(id);
  markDirty({ core: true });
}

// ---------------------------------------------------------------- templates

export function saveTemplate(t: MealTemplate) {
  set({ templates: [t, ...get().templates.filter((x) => x.id !== t.id)] });
  db.templates.put(t);
  markDirty({ core: true });
}

export function deleteTemplate(id: string) {
  set({ templates: get().templates.filter((t) => t.id !== id) });
  db.templates.delete(id);
  markDirty({ core: true });
}

export function applyTemplate(date: string, mealId: MealId, t: MealTemplate) {
  const entries = t.items.flatMap((it) => {
    const f = findFood(it.foodId);
    return f ? [makeEntry(f, it.unitId, it.amount, mealId)] : [];
  });
  mutateDay(date, (d) => ({ ...d, entries: [...d.entries, ...entries] }));
  return entries.length;
}

// ---------------------------------------------------------------- weight

export function saveWeight(w: WeightEntry) {
  const weights = [...get().weights.filter((x) => x.id !== w.id), w].sort((a, b) => a.date.localeCompare(b.date));
  set({ weights });
  db.weights.put(w);
  markDirty({ core: true });
  recalcGoal();
}

export function deleteWeight(id: string) {
  set({ weights: get().weights.filter((w) => w.id !== id) });
  db.weights.delete(id);
  markDirty({ core: true });
  recalcGoal();
}

// ---------------------------------------------------------------- exercise

export const allExercises = () => [...get().customExercises, ...get().baseExercises];
export const findExercise = (id: string) => allExercises().find((e) => e.id === id);

export function makeExerciseEntry(ex: Exercise, minutes: number, intensity: ExerciseEntry['intensity'], extra: Partial<ExerciseEntry> = {}): ExerciseEntry {
  const met = metFor(ex, intensity);
  const kg = latestWeightKg();
  const auto = exerciseKcal(met, kg, minutes, get().settings.exercise.mode);
  return {
    id: uid(),
    exerciseId: ex.id,
    exerciseName: { ...ex.name },
    category: ex.category,
    minutes,
    intensity,
    met,
    weightKgUsed: kg,
    kcal: auto,
    time: new Date().toISOString(),
    ...extra,
  };
}

export function saveExerciseEntry(date: string, entry: ExerciseEntry) {
  mutateDay(date, (d) => ({ ...d, exercises: [...d.exercises.filter((e) => e.id !== entry.id), entry] }));
}

export function removeExerciseEntry(date: string, id: string) {
  mutateDay(date, (d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== id) }));
}

export function saveCustomExercise(ex: Exercise) {
  set({ customExercises: [ex, ...get().customExercises.filter((x) => x.id !== ex.id)] });
  db.exercises.put(ex);
  markDirty({ core: true });
}

export function deleteCustomExercise(id: string) {
  set({ customExercises: get().customExercises.filter((x) => x.id !== id) });
  db.exercises.delete(id);
  markDirty({ core: true });
}

export function saveRoutine(r: ExerciseRoutine) {
  set({ routines: [r, ...get().routines.filter((x) => x.id !== r.id)] });
  db.routines.put(r);
  markDirty({ core: true });
}

export function deleteRoutine(id: string) {
  set({ routines: get().routines.filter((x) => x.id !== id) });
  db.routines.delete(id);
  markDirty({ core: true });
}

export function logRoutine(date: string, r: ExerciseRoutine) {
  const entries = r.items.flatMap((it) => {
    const ex = findExercise(it.exerciseId);
    return ex ? [makeExerciseEntry(ex, it.minutes, it.intensity)] : [];
  });
  mutateDay(date, (d) => ({ ...d, exercises: [...d.exercises, ...entries] }));
  return entries.length;
}

// ---------------------------------------------------------------- images

/** Downscales to max 640px JPEG and stores it locally. Returns the image id. */
export async function saveImage(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.82));
  const id = uid();
  await db.images.put({ id, blob });
  set({ imageUrls: { ...get().imageUrls, [id]: URL.createObjectURL(blob) } });
  markDirty({ images: true });
  return id;
}

export function deleteImage(id: string) {
  const urls = { ...get().imageUrls };
  if (urls[id]) URL.revokeObjectURL(urls[id]);
  delete urls[id];
  set({ imageUrls: urls });
  db.images.delete(id);
}

// ---------------------------------------------------------------- backup / restore

export async function replaceAllData(d: AppData) {
  await db.transaction('rw', [db.kv, db.foods, db.recipes, db.days, db.weights, db.exercises, db.routines, db.templates, db.units, db.images], async () => {
    await Promise.all([db.foods.clear(), db.recipes.clear(), db.days.clear(), db.weights.clear(), db.exercises.clear(), db.routines.clear(), db.templates.clear(), db.units.clear(), db.images.clear()]);
    await db.kv.put({ key: 'settings', value: d.settings });
    await db.kv.put({ key: 'overrides', value: d.overrides });
    await db.kv.put({ key: 'favorites', value: d.favorites });
    await db.foods.bulkPut(d.customFoods);
    await db.recipes.bulkPut(d.recipes);
    await db.days.bulkPut(Object.values(d.days));
    await db.weights.bulkPut(d.weights);
    await db.exercises.bulkPut(d.customExercises);
    await db.routines.bulkPut(d.routines);
    await db.templates.bulkPut(d.templates);
    await db.units.bulkPut(d.customUnits);
    await db.images.bulkPut(Object.entries(d.images).map(([id, blob]) => ({ id, blob })));
  });
  Object.values(get().imageUrls).forEach((u) => URL.revokeObjectURL(u));
  await initApp();
  markDirty({ core: true, images: true });
  Object.keys(d.days).forEach((k) => dirty.months.add(k.slice(0, 7)));
}

export async function resetAll() {
  const handle = await getFolder();
  await db.delete();
  await db.open();
  if (handle) await db.kv.put({ key: 'folderHandle', value: handle });
  Object.values(get().imageUrls).forEach((u) => URL.revokeObjectURL(u));
  set({ settings: DEFAULT_SETTINGS });
  await initApp();
}

export function markBackedUp() {
  updateSettings((s) => ({ ...s, lastBackupAt: todayIso() }));
}

// ---------------------------------------------------------------- derived helpers

/** Foods logged recently (most recent first). */
export function recentFoodIds(limit = 30): string[] {
  const days = get().days;
  const out: string[] = [];
  const today = todayIso();
  for (let i = 0; i < 60 && out.length < limit; i++) {
    const d = days[addDays(today, -i)];
    if (!d) continue;
    for (const e of [...d.entries].sort((a, b) => b.time.localeCompare(a.time))) if (!out.includes(e.foodId)) out.push(e.foodId);
  }
  return out.slice(0, limit);
}

export function recentExerciseIds(limit = 20): string[] {
  const days = get().days;
  const out: string[] = [];
  const today = todayIso();
  for (let i = 0; i < 90 && out.length < limit; i++) {
    const d = days[addDays(today, -i)];
    if (!d) continue;
    for (const e of d.exercises) if (!out.includes(e.exerciseId)) out.push(e.exerciseId);
  }
  return out;
}
