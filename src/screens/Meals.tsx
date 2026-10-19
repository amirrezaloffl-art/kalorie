import { useState } from 'react';
import { CalendarDays, Copy, LayoutTemplate, MoreHorizontal, Plus } from 'lucide-react';
import { useL10n } from '../i18n';
import { copyMeal, removeEntry, saveTemplate, updateEntry, useApp } from '../store/app';
import { openPage, setDate, toast, useUI } from '../store/ui';
import { useDay, useDayStats, useFoodMap } from '../store/selectors';
import { entriesTotal } from '../domain/nutrition';
import type { LogEntry, MealId } from '../domain/types';
import { Card, Empty, IconBtn, MacroChips, Segmented, Sheet, Stepper, Swipeable, TextInput, Button, Field } from '../components/ui';
import { FoodThumb } from '../components/icons';
import { addDays, todayIso } from '../utils/dates';
import { uid } from '../utils/id';

export function Meals() {
  const L = useL10n();
  const { t, n } = L;
  const date = useUI((s) => s.date);
  const meals = useApp((s) => s.settings.meals.filter((m) => m.visible));
  const st = useDayStats(date);
  const today = todayIso();
  const rel = date === addDays(today, -1) ? 'yesterday' : date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : 'other';

  return (
    <div className="pt-safe px-4 pb-28">
      <header className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-bold">{t('meals.title')}</h1>
        <label className="relative">
          <IconBtn label="pickDate" className="pointer-events-none">
            <CalendarDays size={22} />
          </IconBtn>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 opacity-0" aria-label={t('a11y.pickDate')} />
        </label>
      </header>
      <Segmented
        value={rel}
        onChange={(v) => setDate(v === 'yesterday' ? addDays(today, -1) : v === 'tomorrow' ? addDays(today, 1) : today)}
        options={[
          { value: 'yesterday', label: t('day.yesterday') },
          { value: 'today', label: t('day.today') },
          { value: 'tomorrow', label: t('day.tomorrow') },
          ...(rel === 'other' ? [{ value: 'other' as const, label: L.date(date, 'D MMM') }] : []),
        ]}
      />
      <Card className="mt-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-ink2">{t('meals.dayTotal')}</div>
          <div className="num text-2xl font-bold">
            {n(st.eaten.kcal)} <span className="text-sm font-normal text-ink3">/ {n(st.goal)} {t('unit.kcal')}</span>
          </div>
        </div>
        <MacroChips p={st.eaten.protein} c={st.eaten.carbs} f={st.eaten.fat} fiber={st.eaten.fiber} />
      </Card>
      <div className="mt-3 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {meals.map((m) => (
          <MealSection key={m.id} date={date} mealId={m.id} title={L.name(m.name)} />
        ))}
      </div>
    </div>
  );
}

function MealSection({ date, mealId, title }: { date: string; mealId: MealId; title: string }) {
  const L = useL10n();
  const { t, n } = L;
  const day = useDay(date);
  const entries = day.entries.filter((e) => e.mealId === mealId);
  const total = entriesTotal(entries);
  const [menu, setMenu] = useState(false);
  const [tplName, setTplName] = useState<string | null>(null);

  const copyYesterday = () => {
    const c = copyMeal(addDays(date, -1), date, mealId);
    toast(c ? t('meals.copied', { n: n(c) }) : t('meals.nothingToCopy'));
    setMenu(false);
  };

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="font-bold">{title}</h3>
          <div className="num text-xs text-ink2">
            {n(total.kcal)} {t('unit.kcal')}
          </div>
        </div>
        <div className="flex items-center">
          <IconBtn label="more" onClick={() => setMenu(true)}>
            <MoreHorizontal size={20} />
          </IconBtn>
          <IconBtn label="addFood" className="glass-tint" onClick={() => openPage({ kind: 'addFood', date, mealId })}>
            <Plus size={20} />
          </IconBtn>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {entries.length ? (
          entries.map((e) => <EntryRow key={e.id} entry={e} date={date} />)
        ) : (
          <button className="w-full" onClick={() => openPage({ kind: 'addFood', date, mealId })}>
            <Empty text={t('meals.empty')} />
          </button>
        )}
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={title}>
        <div className="space-y-2 pb-2">
          <Button variant="secondary" block onClick={copyYesterday}>
            <Copy size={18} /> {t('meals.copyYesterday')}
          </Button>
          <Button variant="secondary" block disabled={!entries.length} onClick={() => { setMenu(false); setTplName(''); }}>
            <LayoutTemplate size={18} /> {t('meals.saveTemplate')}
          </Button>
          <Button variant="secondary" block onClick={() => { setMenu(false); openPage({ kind: 'templates', date, mealId }); }}>
            <LayoutTemplate size={18} /> {t('meals.useTemplate')}
          </Button>
        </div>
      </Sheet>

      <Sheet open={tplName != null} onClose={() => setTplName(null)} title={t('meals.saveTemplate')}>
        <Field label={t('meals.templateName')}>
          <TextInput autoFocus value={tplName ?? ''} placeholder={t('meals.templatePlaceholder')} onChange={(e) => setTplName(e.target.value)} />
        </Field>
        <Button
          block
          className="my-3"
          disabled={!tplName?.trim()}
          onClick={() => {
            saveTemplate({ id: uid(), name: tplName!.trim(), items: entries.map((e) => ({ foodId: e.foodId, unitId: e.unitId, amount: e.amount })) });
            setTplName(null);
            toast(t('meals.templateSaved'));
          }}
        >
          {t('common.save')}
        </Button>
      </Sheet>
    </Card>
  );
}

function EntryRow({ entry: e, date }: { entry: LogEntry; date: string }) {
  const L = useL10n();
  const { t, n } = L;
  const foods = useFoodMap();
  const food = foods.get(e.foodId);
  const step = e.unitId === 'gram' || e.unitId === 'ml' ? (e.amount >= 100 ? 10 : 5) : 0.5;
  return (
    <Swipeable onDelete={() => removeEntry(date, e.id)} deleteLabel={t('common.delete')}>
      <div className="flex items-center gap-3 px-1 py-2">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-start" onClick={() => openPage({ kind: 'food', foodId: e.foodId, date, entryId: e.id, mealId: e.mealId })}>
          <FoodThumb food={food ?? { id: e.foodId, category: 'other' }} size={42} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{L.name(e.foodName)}</div>
            <div className="num text-xs text-ink2">
              {L.amt(e.amount)} {L.unit(e.unitId)}
              {e.unitId !== 'gram' && e.unitId !== 'ml' && ` • ${n(e.grams)} ${food?.basis === 'ml' ? t('unit.ml') : t('unit.g')}`}
              {' • '}
              <b className="text-ink">{n(e.snapshot.kcal)}</b> {t('unit.kcal')}
            </div>
            <MacroChips p={e.snapshot.protein} c={e.snapshot.carbs} f={e.snapshot.fat} fiber={e.snapshot.fiber} />
          </div>
        </button>
        <Stepper compact value={e.amount} step={step} min={step} format={(v) => L.amt(v)} onChange={(v) => updateEntry(date, e.id, { amount: v })} />
      </div>
    </Swipeable>
  );
}
