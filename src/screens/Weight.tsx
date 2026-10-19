import { useMemo, useState } from 'react';
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { Trash2 } from 'lucide-react';
import { useL10n } from '../i18n';
import { deleteWeight, saveWeight, useApp } from '../store/app';
import { toast } from '../store/ui';
import { ewma, projectGoalDate, weeklySlope, daysSince } from '../domain/trend';
import { Badge, Button, Card, Field, IconBtn, NumInput, Page, TextInput } from '../components/ui';
import { todayIso } from '../utils/dates';
import { uid } from '../utils/id';

export function WeightPage() {
  const L = useL10n();
  const { t, n } = L;
  const weights = useApp((s) => s.weights);
  const target = useApp((s) => s.settings.goal.targetKg);
  const last = weights[weights.length - 1];
  const [date, setDate] = useState(todayIso());
  const [kg, setKg] = useState<number | undefined>(last?.kg);
  const [waist, setWaist] = useState<number | undefined>();
  const [note, setNote] = useState('');

  const stats = useMemo(() => {
    if (!weights.length) return null;
    const first = weights[0];
    const slope = weeklySlope(weights);
    return { total: last.kg - first.kg, slope, eta: projectGoalDate(weights, target) };
  }, [weights, last, target]);

  const chart = useMemo(() => {
    const trend = ewma(weights.map((w) => w.kg));
    return weights.map((w, i) => ({ date: w.date, kg: w.kg, trend: trend[i] }));
  }, [weights]);

  const due = !last || daysSince(last.date, todayIso()) >= 7;

  const save = () => {
    if (!kg || kg < 20 || kg > 400) return;
    const same = weights.find((w) => w.date === date);
    saveWeight({ id: same?.id ?? uid(), date, kg: Math.round(kg * 10) / 10, waistCm: waist, note: note.trim() || undefined });
    toast(t('weight.saved'));
    setNote('');
    setWaist(undefined);
  };

  const domain = chart.length ? [Math.floor(Math.min(...chart.map((c) => c.kg), target) - 1), Math.ceil(Math.max(...chart.map((c) => c.kg), target) + 1)] : [0, 100];

  return (
    <Page title={t('weight.title')}>
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold">{t('weight.newEntry')}</h3>
          {due && <Badge tone="warn">{t('weight.due')}</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label={`${t('weight.kg')} (${t('unit.kg')})`}>
            <NumInput value={kg} onChange={setKg} autoFocus className="text-lg font-bold" />
          </Field>
          <Field label={t('weight.date')}>
            <TextInput type="date" value={date} max={todayIso()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
          <Field label={`${t('weight.waist')} (${t('unit.cm')})`}>
            <NumInput value={waist} onChange={setWaist} />
          </Field>
          <Field label={t('exercise.note')}>
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <div className="mt-1 text-xs text-ink3">{L.date(date, 'dddd D MMMM YYYY')}</div>
        <Button block className="mt-3" disabled={!kg} onClick={save}>{t('common.save')}</Button>
      </Card>

      {stats && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <div className="text-[11px] text-ink2">{t('weight.totalChange')}</div>
            <div className={`num mt-1 font-bold ${stats.total <= 0 ? 'text-good' : 'text-bad'}`}>{L.signed(stats.total)}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-[11px] text-ink2">{t('weight.perWeek')}</div>
            <div className="num mt-1 font-bold">{stats.slope == null ? '—' : L.signed(stats.slope, 2)}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-[11px] text-ink2">{t('weight.eta')}</div>
            <div className="mt-1 text-sm font-bold">{stats.eta ? L.date(stats.eta, 'D MMM YY') : '—'}</div>
          </Card>
        </div>
      )}

      <Card className="mt-3">
        <h3 className="mb-2 font-bold">{t('weight.chart')}</h3>
        {chart.length > 0 ? (
          <div className="h-56" dir="ltr">
            <ResponsiveContainer>
              <ComposedChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => L.date(d, 'D MMM')} tick={{ fontSize: 10, fill: 'rgb(var(--text-2))' }} />
                <YAxis domain={domain} tick={{ fontSize: 10, fill: 'rgb(var(--text-2))' }} tickFormatter={(v) => L.d(v)} />
                <Tooltip
                  contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--border))', borderRadius: 12 }}
                  labelFormatter={(d) => L.date(String(d), 'D MMMM YYYY')}
                  formatter={(v: number, k) => [`${n(v, 1)} ${t('unit.kg')}`, k === 'trend' ? t('weight.trend') : t('weight.kg')]}
                />
                <ReferenceLine ifOverflow="extendDomain" y={target} stroke="rgb(var(--good))" strokeDasharray="5 4" label={{ value: t('weight.goal'), fill: 'rgb(var(--good))', fontSize: 10, position: 'insideTopRight' }} />
                <Line dataKey="trend" stroke="rgb(var(--accent))" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Scatter dataKey="kg" fill="rgb(var(--fat))" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-ink3">{t('weight.none')}</p>
        )}
      </Card>

      <h3 className="mb-2 mt-4 font-bold">{t('weight.history')}</h3>
      <div className="space-y-1">
        {[...weights].reverse().map((w) => (
          <div key={w.id} className="flex items-center gap-3 rounded-md bg-surface px-3 py-2">
            <div className="flex-1">
              <div className="num font-medium">{n(w.kg, 1)} {t('unit.kg')}{w.waistCm ? <span className="text-xs text-ink2"> • {t('weight.waist')} {n(w.waistCm)}</span> : null}</div>
              <div className="text-xs text-ink2">{L.date(w.date, 'dddd D MMMM YYYY')}{w.note ? ` • ${w.note}` : ''}</div>
            </div>
            <IconBtn label="delete" onClick={() => confirm(t('weight.confirmDelete')) && deleteWeight(w.id)}><Trash2 size={16} /></IconBtn>
          </div>
        ))}
      </div>
    </Page>
  );
}
