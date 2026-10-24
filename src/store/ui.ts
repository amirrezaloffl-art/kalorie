import { create } from 'zustand';
import type { MealId } from '../domain/types';
import { todayIso } from '../utils/dates';

export type Tab = 'home' | 'meals' | 'exercise' | 'charts';

/** Full-screen pages stacked above the tabs. */
export type Page =
  | { kind: 'addFood'; date: string; mealId?: MealId; query?: string; mode?: 'barcode' | 'favorites' | 'recent' }
  | { kind: 'food'; foodId: string; date: string; mealId?: MealId; entryId?: string }
  | { kind: 'customFood'; foodId?: string; duplicateOf?: string; name?: string; barcode?: string; date?: string; mealId?: MealId }
  | { kind: 'recipe'; foodId?: string }
  | { kind: 'addExercise'; date: string }
  | { kind: 'exercise'; exerciseId: string; date: string; entryId?: string }
  | { kind: 'customExercise'; exerciseId?: string }
  | { kind: 'routines'; date: string }
  | { kind: 'weight' }
  | { kind: 'cycle' }
  | { kind: 'settings' }
  | { kind: 'calibrate'; foodId?: string }
  | { kind: 'templates'; date: string; mealId: MealId };

export type SheetKind = 'quickAdd' | null;

interface UI {
  tab: Tab;
  date: string;
  pages: Page[];
  sheet: SheetKind;
  toast?: { id: number; text: string };
}

export const useUI = create<UI>(() => ({ tab: 'home', date: todayIso(), pages: [], sheet: null }));

const set = useUI.setState;
const get = useUI.getState;

export const setTab = (tab: Tab) => set({ tab });
export const setDate = (date: string) => set({ date });

export function openPage(p: Page) {
  set({ pages: [...get().pages, p], sheet: null });
  history.pushState({ depth: get().pages.length }, '');
}

/** Replace the top page (no extra history entry). */
export function replacePage(p: Page) {
  const pages = get().pages.slice(0, -1);
  set({ pages: [...pages, p] });
}

export function closePage() {
  if (!get().pages.length) return;
  history.back();
}

/** Close several pages at once (e.g. after adding a food from search → detail). */
export function closePages(n: number) {
  const k = Math.min(n, get().pages.length);
  if (k > 0) history.go(-k);
}

window.addEventListener('popstate', (e) => {
  const depth = (e.state as { depth?: number } | null)?.depth ?? 0;
  const pages = get().pages;
  if (depth < pages.length) set({ pages: pages.slice(0, depth) });
  else if (get().sheet) set({ sheet: null });
});

export const openSheet = (sheet: SheetKind) => set({ sheet });

let toastId = 0;
export function toast(text: string) {
  const id = ++toastId;
  set({ toast: { id, text } });
  setTimeout(() => {
    if (get().toast?.id === id) set({ toast: undefined });
  }, 2200);
}
