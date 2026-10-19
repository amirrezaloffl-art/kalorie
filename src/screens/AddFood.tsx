import { useMemo, useState } from 'react';
import { Barcode, ChefHat, Plus, Search, Star } from 'lucide-react';
import { useL10n } from '../i18n';
import { recentFoodIds, useApp } from '../store/app';
import { openPage, type Page as PageT } from '../store/ui';
import { useFoodIndex, useFoodMap } from '../store/selectors';
import { defaultUnit, unitGrams } from '../domain/units';
import { entryNutrients } from '../domain/nutrition';
import type { CategoryId, Food, MealId, Settings } from '../domain/types';
import { Badge, Button, cx, Empty, ListRow, Page, Segmented, TextInput } from '../components/ui';
import { FoodThumb } from '../components/icons';
import { normalizeFa } from '../search/normalize';

type TabId = 'recent' | 'favorites' | 'mine' | 'all';

/** Meal that fits the current time of day. */
export function mealByTime(s: Settings, d = new Date()): MealId {
  const h = d.getHours() + d.getMinutes() / 60;
  const want: MealId = h < 10.5 ? 'breakfast' : h < 12 ? 'snack1' : h < 15.5 ? 'lunch' : h < 19 ? 'snack2' : 'dinner';
  const visible = s.meals.filter((m) => m.visible).map((m) => m.id);
  return visible.includes(want) ? want : visible[0] ?? 'lunch';
}

export function AddFood({ page }: { page: Extract<PageT, { kind: 'addFood' }> }) {
  const L = useL10n();
  const { t } = L;
  const [q, setQ] = useState(page.query ?? '');
  const [barcode, setBarcode] = useState('');
  const [tab, setTab] = useState<TabId>(page.mode === 'favorites' ? 'favorites' : 'recent');
  const [cat, setCat] = useState<CategoryId | 'any'>('any');
  const index = useFoodIndex();
  const map = useFoodMap();
  const favorites = useApp((s) => s.favorites.foods);
  const custom = useApp((s) => s.customFoods);
  const base = useApp((s) => s.baseFoods);
  const days = useApp((s) => s.days);
  const recent = useMemo(() => recentFoodIds(), [days]); // eslint-disable-line react-hooks/exhaustive-deps
  const settings = useApp((s) => s.settings);
  const mealId = page.mealId ?? mealByTime(settings);

  const results: Food[] = useMemo(() => {
    if (page.mode === 'barcode' && barcode.trim()) {
      const code = normalizeFa(barcode).replace(/\s/g, '');
      return [...custom, ...base].filter((f) => f.barcode && f.barcode.replace(/\s/g, '') === code);
    }
    if (q.trim()) return index.search(q, { favorites: new Set(favorites), recent });
    const ids = tab === 'recent' ? recent : tab === 'favorites' ? favorites : [];
    if (tab === 'mine') return custom;
    if (tab === 'all') return base.filter((f) => cat === 'any' || f.category === cat);
    return ids.map((id) => map.get(id)).filter(Boolean) as Food[];
  }, [q, tab, index, favorites, recent, custom, base, map, cat, barcode, page.mode]);

  const openFood = (f: Food) => openPage({ kind: 'food', foodId: f.id, date: page.date, mealId });
  const categories = useMemo(() => [...new Set(base.map((f) => f.category))], [base]);

  return (
    <Page title={page.mode === 'barcode' ? t('addFood.barcodeTitle') : t('addFood.title')}>
      {page.mode === 'barcode' ? (
        <div className="mb-3 space-y-2">
          <div className="relative">
            <Barcode size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink3" />
            <TextInput autoFocus inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder={t('addFood.barcodePlaceholder')} className="ps-10" />
          </div>
          <p className="text-xs text-ink3">{t('addFood.barcodeHint')}</p>
        </div>
      ) : (
        <div className="sticky top-0 z-10 -mx-4 px-4 pb-2">
          <div className="relative">
            <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink3" />
            <TextInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('addFood.searchPlaceholder')} className="glass-strong h-12 rounded-full ps-10" />
          </div>
          {!q.trim() && (
            <Segmented
              className="mt-2"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'recent', label: t('addFood.recent') },
                { value: 'favorites', label: t('addFood.favorites') },
                { value: 'mine', label: t('addFood.mine') },
                { value: 'all', label: t('addFood.all') },
              ]}
            />
          )}
          {!q.trim() && tab === 'all' && (
            <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
              {(['any', ...categories] as const).map((c) => (
                <button key={c} onClick={() => setCat(c)} className={cx('shrink-0 rounded-full px-3 py-1 text-xs', cat === c ? 'glass-tint' : 'glass')}>
                  {t(`cat.${c}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-2 flex items-center justify-between text-xs text-ink2">
        <span>{t('addFood.addingTo', { meal: L.name(settings.meals.find((m) => m.id === mealId)?.name) })}</span>
        {tab === 'mine' && !q.trim() && (
          <button className="flex items-center gap-1 text-accent" onClick={() => openPage({ kind: 'recipe' })}>
            <ChefHat size={14} /> {t('recipe.new')}
          </button>
        )}
      </div>

      <div className="space-y-0.5">
        {results.map((f) => (
          <FoodRow key={f.id} food={f} fav={favorites.includes(f.id)} onClick={() => openFood(f)} />
        ))}
      </div>

      {!results.length && (
        <Empty
          text={q.trim() || barcode.trim() ? t('addFood.noResults') : tab === 'favorites' ? t('addFood.noFavorites') : tab === 'mine' ? t('addFood.noCustom') : t('addFood.noRecent')}
          icon={tab === 'favorites' ? <Star size={22} /> : undefined}
        />
      )}

      {(q.trim() || barcode.trim() || tab === 'mine') && (
        <Button
          variant="secondary"
          block
          className="mt-4"
          onClick={() => openPage({ kind: 'customFood', name: q.trim() || undefined, barcode: barcode.trim() || undefined, date: page.date, mealId })}
        >
          <Plus size={18} /> {t('addFood.addNew')}
        </Button>
      )}
    </Page>
  );
}

export function FoodRow({ food, fav, onClick, right }: { food: Food; fav?: boolean; onClick: () => void; right?: React.ReactNode }) {
  const L = useL10n();
  const { t, n } = L;
  const overrides = useApp((s) => s.overrides);
  const u = defaultUnit(food);
  const kcal = entryNutrients(food, unitGrams(food, u.unitId, overrides), 1).kcal;
  return (
    <ListRow onClick={onClick}>
      <FoodThumb food={food} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-sm font-medium">
          {L.name(food.name)}
          {fav && <Star size={12} className="shrink-0 fill-warn text-warn" />}
          {food.source !== 'base' && <Badge tone="muted">{t(`source.${food.source}`)}</Badge>}
        </div>
        <div className="num truncate text-xs text-ink2">
          {food.brand && `${food.brand} • `}
          {L.d(1)} {L.unit(u.unitId)} • {n(kcal)} {t('unit.kcal')}
        </div>
      </div>
      {right}
    </ListRow>
  );
}
