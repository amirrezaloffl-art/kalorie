import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  onboarded: false,
  userName: '',
  profile: { sex: 'male', birthYear: 1995, heightCm: 175, activity: 1.375 },
  goal: { type: 'lose', targetKg: 75, weeklyRateKg: 0.5, dailyKcal: 2000, manualKcal: false },
  macros: { mode: 'percent', proteinG: 140, carbsG: 200, fatG: 65, proteinPct: 30, carbsPct: 40, fatPct: 30 },
  water: { glassMl: 250, goalGlasses: 8 },
  exercise: { addBackToBudget: true, mode: 'net', weeklyMinutesGoal: 150, plannedWeekdays: [] },
  meals: [
    { id: 'breakfast', name: { fa: 'صبحانه', en: 'Breakfast' }, visible: true },
    { id: 'snack1', name: { fa: 'میان‌وعده صبح', en: 'Morning snack' }, visible: true },
    { id: 'lunch', name: { fa: 'ناهار', en: 'Lunch' }, visible: true },
    { id: 'snack2', name: { fa: 'عصرانه', en: 'Afternoon snack' }, visible: true },
    { id: 'dinner', name: { fa: 'شام', en: 'Dinner' }, visible: true },
  ],
  weighInWeekday: 5, // Friday
  theme: 'light',
  lang: 'fa',
  calendar: 'jalali',
  digits: 'fa',
  weekStart: 'sat',
};
