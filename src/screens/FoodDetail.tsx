import { useMemo, useState } from 'react';
import { Copy, Pencil, Ruler, Star, Trash2 } from 'lucide-react';
import { useL10n } from '../i18n';
import { addEntry, findFood, getDay, makeEntry, removeEntry, toggleFavorite, updateEntry, useApp } from '../store/app';
import { closePage, closePages, openPage, toast, useUI, type Page as PageT } from '../store/ui';
import { defaultUnit, foodUnits, unitGrams } from '../domain/units';
import { entryNutrients } from '../domain/nutrition';
import { healthScore, scoreTone } from '../domain/healthScore';
import type { MealId } from '../domain/types';
import { Badge, Button, Card, Chips, cx, Field, IconBtn, NumInput, Page, ProgressBar, Select, Sheet, Stepper } from '../components/ui';
import { FoodThumb, foodTint } from '../components/icons';
import { mealByTime } from './AddFood';

const FRACTIONS = [0.25, 0.5, 1, 1.5, 2, 3];

export function FoodDetail({ page }: { page: Extract<PageT, { kind: 'food' }> }) {
  const L = useL10n();
  const { t, n } = L;
  useApp((s) => s.customFoods); // re-render after edits
  const food = findFood(page.foodId);
  const settings = useApp((s) => s.settings);
  const overrides = useApp((s) => s.overrides);
  const favorites = useApp((s) => s.favorites.foods);
  const pagesDepth = useUI((s) => s.pages.length);
  const existing = page.entryId ? getDay(page.date).entries.find((e) => e.id === page.entryId) : undefined;

  const initialUnit = existing?.unitId ?? (food ? defaultUnit(food).unitId : 'gram');
  const [unitId, setUnitId] = useState(initialUnit);
  const [amount, setAmount] = useState<number | undefined>(existing?.amount ?? (initialUnit === 'gram' || initialUnit === 'ml' ? 100 : 1));
  const [mealId, setMealId] = useState<MealId>(existing?.mealId ?? page.mealId ?? mealByTime(settings));
  const [showScore, setShowScore] = useState(false);

  const grams = food ? unitGrams(food, unitId, overrides) : 0;
  const preview = useMemo(() => (food ? entryNutrients(food, grams, amount ?? 0) : null), [food, grams, amount]);
  const score = useMemo(() => (food ? healthScore(food.per100) : null), [food]);

  if (!food || !preview || !score) {
    return (
      <Page title={existing ? L.name(existing.foodName) : '—'}>
        <p className="text-sm text-ink2">{t('food.missing')}</p>
        {existing && (
          <Button variant="danger" className="mt-4" onClick={() => { removeEntry(page.date, existing.id); closePage(); }}>
            <Trash2 size={18} /> {t('common.delete')}
          </Button>
        )}
      </Page>
    );
  }

  const isBase = unitId === 'gram' || unitId === 'ml';
  const fav = favorites.includes(food.id);
  const basisUnit = food.basis === 'ml' ? t('unit.ml') : t('unit.g');
  const valid = (amount ?? 0) > 0;

  const submit = () => {
    if (!valid) return;
    if (existing) {
      updateEntry(page.date, existing.id, { unitId, amount, mealId });
      toast(t('food.updated'));
      closePage();
    } else {
      addEntry(page.date, makeEntry(food, unitId, amount!, mealId));
      toast(t('food.added', { meal: L.name(settings.meals.find((m) => m.id === mealId)?.name) }));
      // Close detail + search pages, back to where the user started.
      const below = useUI.getState().pages[pagesDepth - 2];
      closePages(below?.kind === 'addFood' ? 2 : 1);
    }
  };

  const nutrRows = [
    { key: 'protein', v: preview.protein, color: 'rgb(var(--protein))', max: 50 },
    { key: 'carbs', v: preview.carbs, color: 'rgb(var(--carbs))', max: 100 },
    { key: 'fat', v: preview.fat, color: 'rgb(var(--fat))', max: 40 },
    { key: 'fiber', v: preview.fiber ?? 0, color: 'rgb(var(--fiber))', max: 15 },
  ];

  return (
    <Page
      title={L.name(food.name)}
      actions={
        <IconBtn label="favorite" onClick={() => toggleFavorite('foods', food.id)}>
          <Star size={20} className={cx(fav && 'fill-warn text-warn')} />
        </IconBtn>
      }
      footer={
        <div className="flex gap-2">
          {existing && (
            <Button variant="danger" onClick={() => { removeEntry(page.date, existing.id); closePage(); }} aria-label={t('common.delete')}>
              <Trash2 size={18} />
            </Button>
          )}
          <Button block size="lg" disabled={!valid} onClick={submit}>
            {existing ? t('common.save') : t('food.add')} • <span className="num">{n(preview.kcal)}</span> {t('unit.kcal')}
          </Button>
        </div>
      }
    >
      {/* Hero */}
      <div className="relative -mx-4 mb-4 flex h-40 items-center justify-center overflow-hidden" style={{ background: `linear-gradient(160deg, ${foodTint(food.category)}33, transparent 80%)` }}>
        <FoodThumb food={food} size={food.imageId ? 160 : 96} className={food.imageId ? '!h-40 !w-full rounded-none' : ''} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Badge>{t(`cat.${food.category}`)}</Badge>
        <Badge tone="muted">{t(`source.${food.source}`)}</Badge>
        {food.brand && <Badge tone="muted">{food.brand}</Badge>}
        <button onClick={() => setShowScore(true)}>
          <Badge tone={scoreTone(score.score)}>
            {t('food.healthScore')} {n(score.score)}
          </Badge>
        </button>
        {food.dataQuality === 'estimated' && <Badge tone="muted">{t('food.estimated')}</Badge>}
      </div>

      {/* Amount */}
      <Card>
        <Field label={t('food.unit')}>
          <Chips value={unitId} onChange={(u) => { setUnitId(u); setAmount(u === 'gram' || u === 'ml' ? 100 : 1); }} options={foodUnits(food).map((u) => ({ value: u.unitId, label: L.unit(u.unitId) }))} />
        </Field>
        <div className="mt-2 flex items-center gap-3">
          <NumInput value={amount} onChange={setAmount} className="w-28 text-center text-lg font-bold" />
          <span className="flex-1 text-sm text-ink2">{L.unit(unitId)}</span>
          <Stepper value={amount ?? 0} step={isBase ? 10 : 0.5} min={0} format={() => ''} onChange={setAmount} />
        </div>
        {!isBase && (
          <div className="mt-3 flex flex-wrap gap-2">
            {FRACTIONS.map((f) => (
              <button key={f} onClick={() => setAmount(f)} className={cx('num rounded-full px-3 py-1 text-sm', amount === f ? 'glass-tint' : 'glass-thin')}>
                {L.amt(f)}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs text-ink2">
          {!isBase && t('food.oneUnitIs', { unit: L.unit(unitId), g: n(grams), basis: basisUnit })}
          {' '}
          <button className="text-accent" onClick={() => openPage({ kind: 'calibrate', foodId: food.id })}>
            {t('food.calibrate')}
          </button>
        </div>
        <Field label={t('food.meal')}>
          <Select value={mealId} onChange={setMealId} options={settings.meals.filter((m) => m.visible || m.id === mealId).map((m) => ({ value: m.id, label: L.name(m.name) }))} />
        </Field>
      </Card>

      {/* Live preview */}
      <Card className="mt-3">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="num text-3xl font-bold">{n(preview.kcal)}</div>
            <div className="text-xs text-ink2">{t('unit.kcal')}</div>
          </div>
          <div className="num text-sm text-ink2">≈ {n(grams * (amount ?? 0))} {basisUnit}</div>
        </div>
        <div className="space-y-2.5">
          {nutrRows.map((r) => (
            <div key={r.key}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{t(`macro.${r.key}`)}</span>
                <span className="num font-medium">{n(r.v, 1)} {t('unit.g')}</span>
              </div>
              <ProgressBar value={r.v} max={r.max} color={r.color} />
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <SmallStat label={t('macro.sugar')} value={food.per100.sugar != null ? `${n(preview.sugar ?? 0, 1)} ${t('unit.g')}` : '—'} />
        <SmallStat label={t('macro.sodium')} value={food.per100.sodium != null ? `${n(preview.sodium ?? 0)} ${t('unit.mg')}` : '—'} />
        <SmallStat label={t('food.gi')} value={food.glycemicIndex != null ? n(food.glycemicIndex) : '—'} />
      </div>

      {food.per100.micros && Object.keys(food.per100.micros).length > 0 && (
        <Card className="mt-3">
          <h3 className="mb-2 font-bold">{t('food.micros')}</h3>
          {Object.entries(food.per100.micros).map(([k, v]) => (
            <div key={k} className="flex justify-between py-1 text-sm">
              <span>{k}</span>
              <span className="num">{n(v, 1)}</span>
            </div>
          ))}
        </Card>
      )}

      <Card className="mt-3">
        <div className="mb-2 text-xs text-ink2">{t('food.per100', { basis: basisUnit })}</div>
        <div className="num grid grid-cols-4 gap-2 text-center text-sm">
          <div><b>{n(food.per100.kcal)}</b><div className="text-[11px] text-ink3">{t('unit.kcal')}</div></div>
          <div><b className="text-protein">{n(food.per100.protein, 1)}</b><div className="text-[11px] text-ink3">{t('macro.pShort')}</div></div>
          <div><b className="text-carbs">{n(food.per100.carbs, 1)}</b><div className="text-[11px] text-ink3">{t('macro.cShort')}</div></div>
          <div><b className="text-fat">{n(food.per100.fat, 1)}</b><div className="text-[11px] text-ink3">{t('macro.fShort')}</div></div>
        </div>
      </Card>

      <div className="mt-3 flex flex-wrap gap-2">
        {food.source === 'custom' && (
          <Button variant="secondary" size="sm" onClick={() => openPage({ kind: 'customFood', foodId: food.id })}>
            <Pencil size={16} /> {t('common.edit')}
          </Button>
        )}
        {food.source === 'recipe' && (
          <Button variant="secondary" size="sm" onClick={() => openPage({ kind: 'recipe', foodId: food.id })}>
            <Pencil size={16} /> {t('common.edit')}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => openPage({ kind: 'customFood', duplicateOf: food.id })}>
          <Copy size={16} /> {t('food.duplicate')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => openPage({ kind: 'calibrate', foodId: food.id })}>
          <Ruler size={16} /> {t('food.manageUnits')}
        </Button>
      </div>

      <Sheet open={showScore} onClose={() => setShowScore(false)} title={`${t('food.healthScore')}: ${n(score.score)}`}>
        <p className="mb-3 text-sm text-ink2">{t('food.scoreExplain')}</p>
        <div className="space-y-1 pb-3 text-sm">
          <div className="flex justify-between"><span>{t('food.scoreBase')}</span><span className="num">{n(50)}</span></div>
          {score.parts.map((p) => (
            <div key={p.key} className="flex justify-between">
              <span>{t(`food.score.${p.key}`)}</span>
              <span className={cx('num font-medium', p.points > 0 ? 'text-good' : p.points < 0 ? 'text-bad' : 'text-ink3')}>
                {p.points > 0 ? '+' : p.points < 0 ? '−' : ''}{n(Math.abs(p.points))}
              </span>
            </div>
          ))}
        </div>
      </Sheet>
    </Page>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <div className="text-[11px] text-ink2">{label}</div>
      <div className="num mt-1 text-sm font-bold">{value}</div>
    </Card>
  );
}
