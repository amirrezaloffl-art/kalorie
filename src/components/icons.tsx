import {
  Activity, Apple, Bean, Beef, CakeSlice, Candy, Carrot, Coffee, Croissant, CupSoda, Drumstick, Dumbbell, Egg, Flower2, HeartPulse,
  Home, Milk, Mountain, Nut, Pizza, Salad, Soup, Trophy, Utensils, Wheat, Cookie, Droplet, Fish,
} from 'lucide-react';
import type { CategoryId, ExerciseCategoryId, Food } from '../domain/types';
import { useApp } from '../store/app';
import { cx } from './ui';

const FOOD_ICONS: Record<CategoryId, typeof Apple> = {
  bread: Croissant, rice: Wheat, stew: Soup, soup: Soup, kebab: Beef, dish: Utensils, breakfast: Egg, dairy: Milk,
  legume: Bean, vegetable: Carrot, fruit: Apple, nuts: Nut, sweets: CakeSlice, drink: CupSoda, fastfood: Pizza,
  snack: Cookie, condiment: Droplet, protein: Drumstick, grain: Wheat, other: Salad,
};

const FOOD_TINT: Record<CategoryId, string> = {
  bread: '#F2A93B', rice: '#C9A15B', stew: '#4CC36B', soup: '#3DBFA8', kebab: '#E5484D', dish: '#7C5CFA', breakfast: '#F2A93B',
  dairy: '#5B8DEF', legume: '#A0785A', vegetable: '#4CC36B', fruit: '#F26D6D', nuts: '#A0785A', sweets: '#E86FB5',
  drink: '#4FA3F7', fastfood: '#F2843B', snack: '#E86FB5', condiment: '#9A9AA8', protein: '#E5484D', grain: '#C9A15B', other: '#7C5CFA',
};

export const foodIcon = (c: CategoryId) => FOOD_ICONS[c] ?? Utensils;
export const fishOr = (f: Pick<Food, 'id'>) => (f.id.includes('fish') || f.id.includes('salmon') || f.id.includes('trout') || f.id.includes('tuna') ? Fish : null);
export const coffeeOr = (f: Pick<Food, 'id'>) => (f.id.includes('coffee') || f.id.includes('tea') || f.id.includes('latte') ? Coffee : null);
export const candyOr = (f: Pick<Food, 'id'>) => (f.id.includes('candy') || f.id.includes('noghl') || f.id.includes('pastille') ? Candy : null);

/** Photo if one exists, otherwise a tinted category icon. */
export function FoodThumb({ food, size = 44, className }: { food: Pick<Food, 'id' | 'category' | 'imageId'>; size?: number; className?: string }) {
  const url = useApp((s) => (food.imageId ? s.imageUrls[food.imageId] : undefined));
  const tint = FOOD_TINT[food.category] ?? '#7C5CFA';
  const Icon = fishOr(food) ?? coffeeOr(food) ?? candyOr(food) ?? foodIcon(food.category);
  if (url) return <img src={url} alt="" className={cx('shrink-0 rounded-md object-cover', className)} style={{ width: size, height: size }} />;
  return (
    <div className={cx('flex shrink-0 items-center justify-center rounded-md', className)} style={{ width: size, height: size, background: `${tint}1f`, color: tint }}>
      <Icon size={size * 0.48} strokeWidth={1.7} />
    </div>
  );
}

export const foodTint = (c: CategoryId) => FOOD_TINT[c] ?? '#7C5CFA';

const EX_ICONS: Record<ExerciseCategoryId, typeof Apple> = {
  yoga: Flower2, cardio: HeartPulse, strength: Dumbbell, sports: Trophy, outdoor: Mountain, home: Home, other: Activity,
};
export const EX_COLORS: Record<ExerciseCategoryId, string> = {
  yoga: '#7C5CFA', cardio: '#F26D6D', strength: '#5B8DEF', sports: '#F2A93B', outdoor: '#4CC36B', home: '#3DBFA8', other: '#9A9AA8',
};

export function ExerciseThumb({ category, size = 44 }: { category: ExerciseCategoryId; size?: number }) {
  const Icon = EX_ICONS[category] ?? Activity;
  const tint = EX_COLORS[category] ?? '#7C5CFA';
  return (
    <div className="flex shrink-0 items-center justify-center rounded-md" style={{ width: size, height: size, background: `${tint}1f`, color: tint }}>
      <Icon size={size * 0.48} strokeWidth={1.7} />
    </div>
  );
}
