import { useMemo, useState } from 'react';
import { Search, Trash2, X } from 'lucide-react';
import { useL10n } from '../i18n';
import { deleteFood, findFood, saveRecipe, useApp } from '../store/app';
import { closePage, toast, type Page as PageT } from '../store/ui';
import { useFoodIndex } from '../store/selectors';
import { entryNutrients, sumNutrients } from '../domain/nutrition';
import { foodUnits, toGrams, unitGrams } from '../domain/units';
import type { CategoryId, Food, Nutrients, RecipeIngredient } from '../domain/types';
import { Button, Card, Field, IconBtn, ListRow, NumInput, Page, Select, TextInput } from '../components/ui';
import { FoodThumb } from '../components/icons';
import { CATEGORIES } from './CustomFood';
import { uid } from '../utils/id';

/** Composite dish: ingredients → per-100 g nutrition of the cooked result. */
export function RecipeBuilder({ page }: { page: Extract<PageT, { kind: 'recipe' }> }) {
  const L = useL10n();
  const { t, n } = L;
  const overrides = useApp((s) => s.overrides);
  const favorites = useApp((s) => s.favorites.foods);
  const existing = useApp((s) => s.recipes.find((r) => r.foodId === page.foodId));
  const existingFood = page.foodId ? findFood(page.foodId) : undefined;
  const index = useFoodIndex();

  const [nameFa, setNameFa] = useState(existingFood?.name.fa ?? '');
  const [nameEn, setNameEn] = useState(existingFood?.name.en ?? '');
  const [category, setCategory] = useState<CategoryId>(existingFood?.category ?? 'stew');
  const [items, setItems] = useState<RecipeIngredient[]>(existing?.ingredients ?? []);
  const [cooked, setCooked] = useState<number | undefined>(existing?.cookedWeightG);
  const [servings, setServings] = useState<number | undefined>(existing?.servings);
  const [q, setQ] = useState('');

  const results = useMemo(() => (q.trim() ? index.search(q, { favorites: new Set(favorites), recent: [] }, 8).filter((f) => f.id !== page.foodId) : []), [q, index, favorites, page.foodId]);

  const calc = useMemo(() => {
    let rawWeight = 0;
    const parts: Nutrients[] = [];
    for (const it of items) {
      const f = findFood(it.foodId);
      if (!f) continue;
      const g = unitGrams(f, it.unitId, overrides);
      parts.push(entryNutrients(f, g, it.amount));
      rawWeight += toGrams(f, g * it.amount);
    }
    const total = sumNutrients(parts);
    const weight = cooked && cooked > 0 ? cooked : rawWeight;
    const per100: Nutrients = weight
      ? {
          kcal: Math.round((total.kcal / weight) * 100),
          protein: +((total.protein / weight) * 100).toFixed(1),
          carbs: +((total.carbs / weight) * 100).toFixed(1),
          fat: +((total.fat / weight) * 100).toFixed(1),
          fiber: +(((total.fiber ?? 0) / weight) * 100).toFixed(1),
          sugar: +(((total.sugar ?? 0) / weight) * 100).toFixed(1),
          sodium: Math.round(((total.sodium ?? 0) / weight) * 100),
        }
      : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    return { total, weight, rawWeight, per100 };
  }, [items, cooked, overrides]);

  const valid = (nameFa.trim() || nameEn.trim()) && items.length > 0 && calc.weight > 0;

  const save = () => {
    const id = existingFood?.id ?? `recipe:${uid()}`;
    const portion = servings && servings > 0 ? Math.round(calc.weight / servings) : undefined;
    const keep = existingFood?.units.filter((u) => !['gram', 'porsion'].includes(u.unitId)) ?? [
      { unitId: 'kaseh', grams: 250 },
      { unitId: 'malaqe', grams: 120 },
      { unitId: 'kafgir', grams: 80 },
    ];
    const food: Food = {
      id,
      source: 'recipe',
      name: { fa: nameFa.trim(), en: nameEn.trim() },
      category,
      basis: 'g',
      per100: calc.per100,
      units: [{ unitId: 'gram', grams: 1 }, ...(portion ? [{ unitId: 'porsion', grams: portion, isDefault: true }] : []), ...keep.map((u, i) => ({ ...u, isDefault: !portion && i === 0 }))],
      dataQuality: 'measured',
      createdAt: existingFood?.createdAt,
    };
    saveRecipe({ foodId: id, ingredients: items, cookedWeightG: cooked, servings }, food);
    toast(t('recipe.saved'));
    closePage();
  };

  return (
    <Page
      title={existingFood ? t('recipe.editTitle') : t('recipe.title')}
      footer={
        <div className="flex gap-2">
          {existingFood && (
            <Button variant="danger" aria-label={t('common.delete')} onClick={() => { if (confirm(t('custom.confirmDelete'))) { deleteFood(existingFood.id); closePage(); } }}>
              <Trash2 size={18} />
            </Button>
          )}
          <Button block size="lg" disabled={!valid} onClick={save}>{t('common.save')}</Button>
        </div>
      }
    >
      <Field label={t('custom.nameFa')}><TextInput dir="rtl" value={nameFa} onChange={(e) => setNameFa(e.target.value)} placeholder={t('recipe.placeholder')} /></Field>
      <Field label={t('custom.nameEn')}><TextInput dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></Field>
      <Field label={t('custom.category')}>
        <Select value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: t(`cat.${c}`) }))} />
      </Field>

      <h3 className="mb-2 mt-4 font-bold">{t('recipe.ingredients')}</h3>
      <div className="relative">
        <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink3" />
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('recipe.addIngredient')} className="ps-10" />
      </div>
      {results.length > 0 && (
        <Card className="mt-1 p-1">
          {results.map((f) => (
            <ListRow
              key={f.id}
              onClick={() => {
                // Ingredients are usually weighed, so start in grams (or ml for liquids).
                setItems((l) => [...l, { foodId: f.id, unitId: f.basis === 'ml' ? 'ml' : 'gram', amount: 100 }]);
                setQ('');
              }}
            >
              <FoodThumb food={f} size={32} />
              <span className="text-sm">{L.name(f.name)}</span>
            </ListRow>
          ))}
        </Card>
      )}
      <div className="mt-2 space-y-2">
        {items.map((it, i) => {
          const f = findFood(it.foodId);
          if (!f) return null;
          const kcal = entryNutrients(f, unitGrams(f, it.unitId, overrides), it.amount).kcal;
          return (
            <Card key={i} className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <FoodThumb food={f} size={32} />
                <span className="flex-1 truncate text-sm font-medium">{L.name(f.name)}</span>
                <span className="num text-xs text-ink2">{n(kcal)} {t('unit.kcal')}</span>
                <IconBtn label="remove" onClick={() => setItems((l) => l.filter((_, j) => j !== i))}><X size={16} /></IconBtn>
              </div>
              <div className="flex gap-2">
                <NumInput className="w-24" value={it.amount} onChange={(v) => setItems((l) => l.map((x, j) => (j === i ? { ...x, amount: v ?? 0 } : x)))} />
                <div className="flex-1">
                  <Select value={it.unitId} onChange={(u) => setItems((l) => l.map((x, j) => (j === i ? { ...x, unitId: u } : x)))} options={foodUnits(f).map((u) => ({ value: u.unitId, label: L.unit(u.unitId) }))} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label={t('recipe.cookedWeight')} hint={t('recipe.cookedHint', { g: n(calc.rawWeight) })}>
          <NumInput value={cooked} onChange={setCooked} placeholder={n(calc.rawWeight)} />
        </Field>
        <Field label={t('recipe.servings')}>
          <NumInput value={servings} onChange={setServings} placeholder="4" />
        </Field>
      </div>

      <Card className="mt-3">
        <div className="mb-2 text-xs text-ink2">{t('recipe.result')}</div>
        <div className="num grid grid-cols-4 gap-2 text-center text-sm">
          <div><b>{n(calc.per100.kcal)}</b><div className="text-[11px] text-ink3">{t('unit.kcal')}</div></div>
          <div><b className="text-protein">{n(calc.per100.protein, 1)}</b><div className="text-[11px] text-ink3">{t('macro.pShort')}</div></div>
          <div><b className="text-carbs">{n(calc.per100.carbs, 1)}</b><div className="text-[11px] text-ink3">{t('macro.cShort')}</div></div>
          <div><b className="text-fat">{n(calc.per100.fat, 1)}</b><div className="text-[11px] text-ink3">{t('macro.fShort')}</div></div>
        </div>
        <div className="mt-3 border-t border-line pt-2 text-xs text-ink2">
          {t('recipe.total', { kcal: n(calc.total.kcal), g: n(calc.weight) })}
          {servings ? ` • ${t('recipe.perServing', { kcal: n(calc.total.kcal / servings) })}` : ''}
        </div>
      </Card>
    </Page>
  );
}
