import { useMemo, useState } from 'react';
import { RotateCcw, Scale, Search } from 'lucide-react';
import { useL10n } from '../i18n';
import { findFood, setOverride, useApp } from '../store/app';
import { replacePage, toast, type Page as PageT } from '../store/ui';
import { useFoodIndex } from '../store/selectors';
import { foodUnits, overrideKey } from '../domain/units';
import { Card, Empty, IconBtn, ListRow, NumInput, Page, TextInput } from '../components/ui';
import { FoodThumb } from '../components/icons';

/** Weigh a household portion once and save it as a personal override (§6.4). */
export function Calibrate({ page }: { page: Extract<PageT, { kind: 'calibrate' }> }) {
  const L = useL10n();
  const { t, n } = L;
  const overrides = useApp((s) => s.overrides);
  const favorites = useApp((s) => s.favorites.foods);
  const index = useFoodIndex();
  const [q, setQ] = useState('');
  const food = page.foodId ? findFood(page.foodId) : undefined;
  const results = useMemo(() => (q.trim() ? index.search(q, { favorites: new Set(favorites), recent: [] }, 15) : []), [q, index, favorites]);

  if (!food) {
    const existing = Object.entries(overrides).map(([k, g]) => {
      const [foodId, unitId] = k.split('|');
      return { foodId, unitId, g, food: findFood(foodId) };
    });
    return (
      <Page title={t('calibrate.title')}>
        <p className="mb-3 text-sm text-ink2">{t('calibrate.intro')}</p>
        <div className="relative">
          <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink3" />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('addFood.searchPlaceholder')} className="ps-10" />
        </div>
        <div className="mt-2">
          {results.map((f) => (
            <ListRow key={f.id} onClick={() => replacePage({ kind: 'calibrate', foodId: f.id })}>
              <FoodThumb food={f} size={36} />
              <span className="text-sm">{L.name(f.name)}</span>
            </ListRow>
          ))}
        </div>
        <h3 className="mb-2 mt-5 font-bold">{t('calibrate.saved')}</h3>
        {existing.length ? (
          <div className="space-y-1">
            {existing.map((o) => (
              <ListRow key={`${o.foodId}|${o.unitId}`} onClick={() => o.food && replacePage({ kind: 'calibrate', foodId: o.foodId })}>
                {o.food && <FoodThumb food={o.food} size={36} />}
                <span className="flex-1 text-sm">{L.name(o.food?.name) || o.foodId}</span>
                <span className="num text-sm text-ink2">1 {L.unit(o.unitId)} = {n(o.g)} {t('unit.g')}</span>
              </ListRow>
            ))}
          </div>
        ) : (
          <Empty text={t('calibrate.none')} icon={<Scale size={22} />} />
        )}
      </Page>
    );
  }

  const basis = food.basis === 'ml' ? t('unit.ml') : t('unit.g');
  return (
    <Page title={L.name(food.name)}>
      <p className="mb-3 text-sm text-ink2">{t('calibrate.howTo')}</p>
      <div className="space-y-2">
        {foodUnits(food)
          .filter((u) => u.unitId !== 'gram' && u.unitId !== 'ml')
          .map((u) => {
            const key = overrideKey(food.id, u.unitId);
            const o = overrides[key];
            return (
              <Card key={u.unitId} className="flex items-center gap-3 p-3">
                <div className="flex-1">
                  <div className="font-medium">1 {L.unit(u.unitId)}</div>
                  <div className="num text-xs text-ink2">{t('calibrate.database', { g: n(u.grams), basis })}</div>
                </div>
                <NumInput
                  className="w-24 text-center"
                  value={o}
                  placeholder={String(u.grams)}
                  onChange={(v) => {
                    setOverride(food.id, u.unitId, v ?? null);
                  }}
                />
                <span className="text-xs text-ink2">{basis}</span>
                {o != null && (
                  <IconBtn label="reset" onClick={() => { setOverride(food.id, u.unitId, null); toast(t('calibrate.reset')); }}>
                    <RotateCcw size={16} />
                  </IconBtn>
                )}
              </Card>
            );
          })}
      </div>
      {food.units.filter((u) => u.unitId !== 'gram' && u.unitId !== 'ml').length === 0 && <Empty text={t('calibrate.noUnits')} />}
      <p className="mt-4 text-xs text-ink3">{t('calibrate.note')}</p>
    </Page>
  );
}
