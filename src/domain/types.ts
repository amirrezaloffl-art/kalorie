// ---------- Shared ----------
export interface LocalizedText {
  fa: string;
  en: string;
}

// ---------- Foods ----------
export type NutrientBasis = 'g' | 'ml';

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  satFat?: number;
  sodium?: number; // mg
  micros?: Record<string, number>;
}

export interface FoodUnit {
  unitId: string;
  grams: number; // grams (or ml when basis = 'ml') in ONE of this unit for THIS food
  isDefault?: boolean;
}

export type CategoryId =
  | 'bread' | 'rice' | 'stew' | 'soup' | 'kebab' | 'dish' | 'breakfast' | 'dairy'
  | 'legume' | 'vegetable' | 'fruit' | 'nuts' | 'sweets' | 'drink' | 'fastfood'
  | 'snack' | 'condiment' | 'protein' | 'grain' | 'other';

export interface Food {
  id: string; // 'base:…' | 'custom:…' | 'recipe:…'
  source: 'base' | 'custom' | 'recipe';
  name: LocalizedText;
  aliases?: string[];
  brand?: string;
  category: CategoryId;
  basis: NutrientBasis;
  per100: Nutrients;
  units: FoodUnit[];
  densityGPerMl?: number;
  glycemicIndex?: number;
  barcode?: string;
  imageId?: string; // id in the local images store
  favorite?: boolean;
  dataQuality: 'measured' | 'table' | 'estimated';
  createdAt?: string;
  updatedAt?: string;
}

// ---------- Units ----------
export type UnitKind = 'mass' | 'volume' | 'household' | 'piece';

export interface UnitDef {
  id: string;
  name: LocalizedText;
  kind: UnitKind;
  defaultMl?: number;
  custom?: boolean;
}

/** key: `${foodId}|${unitId}` → grams */
export type UnitOverrides = Record<string, number>;

// ---------- Recipes ----------
export interface RecipeIngredient {
  foodId: string;
  unitId: string;
  amount: number;
}

export interface Recipe {
  foodId: string;
  ingredients: RecipeIngredient[];
  cookedWeightG?: number;
  servings?: number;
}

// ---------- Daily log ----------
export type MealId = 'breakfast' | 'snack1' | 'lunch' | 'snack2' | 'dinner';

export interface LogEntry {
  id: string;
  foodId: string;
  mealId: MealId;
  unitId: string;
  amount: number;
  grams: number;
  snapshot: Nutrients;
  foodName: LocalizedText;
  time: string;
}

// ---------- Exercise ----------
export type Intensity = 'light' | 'moderate' | 'vigorous';
export type ExerciseCategoryId = 'yoga' | 'cardio' | 'strength' | 'sports' | 'outdoor' | 'home' | 'other';
export type ExerciseTrack = 'distance' | 'steps' | 'sets' | 'heartRate';

export interface Exercise {
  id: string;
  source: 'base' | 'custom';
  name: LocalizedText;
  aliases?: string[];
  category: ExerciseCategoryId;
  met: Partial<Record<Intensity, number>>;
  defaultIntensity: Intensity;
  tracks?: ExerciseTrack[];
  favorite?: boolean;
  dataQuality: 'compendium' | 'estimated';
}

export interface StrengthSet {
  name: string;
  reps: number;
  kg?: number;
}

export interface ExerciseEntry {
  id: string;
  exerciseId: string;
  exerciseName: LocalizedText;
  category: ExerciseCategoryId;
  minutes: number;
  intensity: Intensity;
  met: number;
  weightKgUsed: number;
  kcal: number;
  kcalManual?: boolean;
  distanceKm?: number;
  steps?: number;
  sets?: StrengthSet[];
  avgHeartRate?: number;
  note?: string;
  time: string;
}

export interface ExerciseRoutine {
  id: string;
  name: LocalizedText;
  items: { exerciseId: string; minutes: number; intensity: Intensity }[];
}

// ---------- Menstrual cycle ----------
export type PeriodFlow = 'spotting' | 'light' | 'medium' | 'heavy';
export type CycleSymptom = 'cramps' | 'bloating' | 'cravings' | 'fatigue' | 'headache' | 'mood' | 'acne' | 'tender';

export interface CycleSettings {
  enabled: boolean;
  cycleLength: number; // default / fallback until enough cycles are logged
  periodLength: number;
  lutealBoost: boolean; // add extra kcal to the goal in the luteal phase
  lutealKcal: number;
}

// ---------- Day ----------
export interface DayLog {
  date: string; // 'YYYY-MM-DD'
  entries: LogEntry[];
  exercises: ExerciseEntry[];
  waterGlasses: number;
  note?: string;
  period?: PeriodFlow;
  symptoms?: CycleSymptom[];
}

// ---------- Weight ----------
export interface WeightEntry {
  id: string;
  date: string;
  kg: number;
  waistCm?: number;
  note?: string;
}

// ---------- Templates ----------
export interface MealTemplate {
  id: string;
  name: string;
  items: { foodId: string; unitId: string; amount: number }[];
}

// ---------- Settings ----------
export type ActivityFactor = 1.2 | 1.375 | 1.55 | 1.725 | 1.9;

export interface MealSlot {
  id: MealId;
  name: LocalizedText;
  visible: boolean;
}

export interface Settings {
  version: number;
  onboarded: boolean;
  userName: string;
  profile: { sex: 'male' | 'female'; birthYear: number; heightCm: number; activity: ActivityFactor };
  goal: { type: 'lose' | 'maintain' | 'gain'; targetKg: number; weeklyRateKg: number; dailyKcal: number; manualKcal: boolean };
  macros: { mode: 'grams' | 'percent'; proteinG: number; carbsG: number; fatG: number; proteinPct: number; carbsPct: number; fatPct: number };
  water: { glassMl: number; goalGlasses: number };
  exercise: { addBackToBudget: boolean; mode: 'net' | 'gross'; weeklyMinutesGoal: number; plannedWeekdays: number[] };
  cycle: CycleSettings;
  meals: MealSlot[];
  weighInWeekday: number;
  theme: 'light' | 'dark';
  lang: 'fa' | 'en';
  calendar: 'jalali' | 'gregorian';
  digits: 'fa' | 'latin';
  weekStart: 'sat' | 'mon';
  lastBackupAt?: string;
}
