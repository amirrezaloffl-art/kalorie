import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { useL10n } from '../i18n';
import { useApp } from '../store/app';
import { setDate, setTab } from '../store/ui';
import type { CycleSymptom, DayLog, Settings, WeightEntry } from '../domain/types';
import { Card } from '../components/ui';
import { MonthCalendar } from '../components/MonthCalendar';
import { monthBounds, rangeDays, shiftMonth, todayIso } from '../utils/dates';
import { axisTick, ChartCard, dayRow, isOnTarget, tooltipStyle, type DayRow } from './Charts';
import { useCycleOn, PHASE_COLOR } from './Cycle';

interface MonthSummary {
  start: string;
  end: string;
  rows: DayRow[];
  daysElapsed: number;
  logged: number;
  avgKcal: number;
  onTarget: number;
  minutes: number;
  burned: number;
  avgProtein: number;
  avgWater: number;
  avgWeight: number | null;
  weightChange: number | null;
  periodDays: number;
  topSymptoms: CycleSymptom[];
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** Totals for one calendar month (Jalali or Gregorian). Future days are ignored. */
export function summarizeMonth(month: string, days: Record<string, DayLog>, weights: WeightEntry[], settings: Settings): MonthSummary {
  const { start, end } = monthBounds(month, settings.calendar);
  const today = todayIso();
  const rows = rangeDays(start, end).map((d) => dayRow(d, days, settings));
  const past = rows.filter((r) => r.date <= today);
  const logged = past.filter((r) => r.logged);
  const inMonth = weights.filter((w) => w.date >= start && w.date <= end);
  const symptomCount = new Map<CycleSymptom, number>();
  for (const r of past) for (const s of days[r.date]?.symptoms ?? []) symptomCount.set(s, (symptomCount.get(s) ?? 0) + 1);
  return {
    start,
    end,
    rows,
    daysElapsed: past.length,
    logged: logged.length,
    avgKcal: avg(logged.map((r) => r.kcal)),
    onTarget: logged.filter(isOnTarget).length,
    minutes: past.reduce((a, r) => a + r.minutes, 0),
    burned: past.reduce((a, r) => a + r.burned, 0),
    avgProtein: avg(logged.map((r) => r.protein)),
    avgWater: avg(past.filter((r) => r.water > 0).map((r) => r.water)),
    avgWeight: inMonth.length ? avg(inMonth.map((w) => w.kg)) : null,
    weightChange: inMonth.length >= 2 ? inMonth[inMonth.length - 1].kg - inMonth[0].kg : null,
    periodDays: past.filter((r) => r.period).length,
    topSymptoms: [...symptomCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s),
  };
}

export function MonthlyOverview() {
  const L = useL10n();
  const { t, n } = L;
  const settings = useApp((s) => s.settings);
  const days = useApp((s) => s.days);
  const weights = useApp((s) => s.weights);
  const cycleOn = useCycleOn();
  const [month, setMonth] = useState(todayIso());
  const today = todayIso();

  const cur = useMemo(() => summarizeMonth(month, days, weights, settings), [month, days, weights, settings]);
  const prev = useMemo(() => summarizeMonth(shiftMonth(month, -1, settings.calendar), days, weights, settings), [month, days, weights, settings]);
  const trend = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const m = summarizeMonth(shiftMonth(month, i - 11, settings.calendar), days, weights, settings);
        return { start: m.start, avgKcal: m.logged ? Math.round(m.avgKcal) : null, weight: m.avgWeight != null ? Math.round(m.avgWeight * 10) / 10 : null, minutes: m.minutes };
      }),
    [month, days, weights, settings],
  );
  const hasTrend = trend.some((m) => m.avgKcal != null || m.weight != null || m.minutes > 0);

  const status = (r: DayRow) => {
    if (r.date > today || !r.logged) return null;
    if (isOnTarget(r)) return 'rgb(var(--good) / 0.75)';
    if (r.kcal < r.budget * 0.8) return 'rgb(var(--water) / 0.45)';
    return r.kcal <= r.budget * 1.1 ? 'rgb(var(--warn) / 0.75)' : 'rgb(var(--bad) / 0.75)';
  };
  const byDate = new Map(cur.rows.map((r) => [r.date, r]));
  const monthTick = (d: string) => L.date(d, 'MMM');

  return (
    <div>
      {/* Calendar heatmap */}
      <Card className="mt-1">
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          onSelect={(d) => {
            setDate(d);
            setTab('meals');
          }}
          cell={(d) => {
            const r = byDate.get(d);
            const bg = r ? status(r) : null;
            return {
              className: bg ? 'text-white' : undefined,
              style: bg ? { background: bg } : undefined,
              below: r && (r.minutes > 0 || (cycleOn && r.period)) ? (
                <>
                  {r.minutes > 0 && <span className="h-1 w-1 rounded-full bg-white shadow-[0_0_0_1px_rgb(var(--protein))]" />}
                  {cycleOn && r.period && <span className="h-1 w-1 rounded-full" style={{ background: PHASE_COLOR.period, boxShadow: '0 0 0 1px white' }} />}
                </>
              ) : undefined,
            };
          }}
        />
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-ink2">
          <Swatch color="rgb(var(--good) / 0.75)" label={t('monthly.onTarget')} />
          <Swatch color="rgb(var(--water) / 0.45)" label={t('monthly.under')} />
          <Swatch color="rgb(var(--warn) / 0.75)" label={t('monthly.slightlyOver')} />
          <Swatch color="rgb(var(--bad) / 0.75)" label={t('monthly.over')} />
        </div>
        <p className="mt-1 text-[11px] text-ink3">{t('monthly.tapDay')}</p>
      </Card>

      {/* Summary vs previous month */}
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric label={t('charts.avgKcal')} value={cur.logged ? n(cur.avgKcal) : '—'} delta={cur.logged && prev.logged ? cur.avgKcal - prev.avgKcal : null} unit={t('unit.kcal')} />
        <Metric label={t('monthly.loggedDays')} value={`${n(cur.logged)}/${n(cur.daysElapsed)}`} />
        <Metric label={t('charts.onTarget')} value={`${n(cur.onTarget)}/${n(cur.logged)}`} />
        <Metric label={t('charts.avgProtein')} value={cur.logged ? `${n(cur.avgProtein)} ${t('unit.g')}` : '—'} delta={cur.logged && prev.logged ? cur.avgProtein - prev.avgProtein : null} />
        <Metric label={t('monthly.activeMinutes')} value={n(cur.minutes)} delta={cur.minutes - prev.minutes} positiveGood />
        <Metric label={t('monthly.burned')} value={`${n(cur.burned)}`} unit={t('unit.kcal')} />
        <Metric label={t('monthly.avgWater')} value={cur.avgWater ? `${n(cur.avgWater, 1)}` : '—'} unit={t('water.glasses')} />
        <Metric
          label={cur.weightChange == null && cur.avgWeight != null ? t('monthly.avgWeight') : t('monthly.weightChange')}
          value={cur.weightChange != null ? L.signed(cur.weightChange) : cur.avgWeight != null ? n(cur.avgWeight, 1) : '—'}
          unit={cur.weightChange != null || cur.avgWeight != null ? t('unit.kg') : undefined}
          tone={cur.weightChange == null ? undefined : (settings.goal.type === 'gain' ? cur.weightChange >= 0 : cur.weightChange <= 0) ? 'good' : 'bad'}
        />
      </div>
      <p className="mt-1 text-[11px] text-ink3">{t('monthly.vsPrev', { month: L.date(prev.start, 'MMMM') })}</p>

      {cycleOn && (
        <Card className="mt-3">
          <h3 className="mb-1 font-bold">{t('cycle.title')}</h3>
          <div className="text-sm text-ink2">
            {t('monthly.periodDays', { n: n(cur.periodDays) })}
            {cur.topSymptoms.length > 0 && ` • ${t('monthly.topSymptoms')}: ${cur.topSymptoms.map((s) => t(`cycle.symptom.${s}`)).join('، ')}`}
          </div>
        </Card>
      )}

      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        <ChartCard title={t('monthly.dailyKcal')}>
          <BarChart data={cur.rows} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d) => L.date(d, 'D')} tick={axisTick} minTickGap={6} />
            <YAxis tick={axisTick} tickFormatter={(v) => L.d(v)} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => L.date(String(d), 'dddd D MMMM')} formatter={(v: number) => [n(v), t('unit.kcal')]} />
            <ReferenceLine ifOverflow="extendDomain" y={settings.goal.dailyKcal} stroke="rgb(var(--text-2))" strokeDasharray="5 4" />
            <Bar dataKey="kcal" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {cur.rows.map((r) => (
                <Cell key={r.date} fill={status(r) ?? 'transparent'} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title={t('monthly.trend12')}>
          {hasTrend ? (
            <ComposedChart data={trend} margin={{ top: 8, right: -10, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
              <XAxis dataKey="start" tickFormatter={monthTick} tick={axisTick} interval={0} angle={-35} textAnchor="end" height={36} />
              <YAxis yAxisId="k" tick={axisTick} tickFormatter={(v) => L.d(v)} />
              <YAxis yAxisId="w" orientation="right" tick={axisTick} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v) => L.d(Math.round(v))} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(d) => L.date(String(d), 'MMMM YYYY')}
                formatter={(v: number, k: string) => [k === 'weight' ? `${n(v, 1)} ${t('unit.kg')}` : n(v), k === 'weight' ? t('monthly.avgWeight') : t('charts.avgKcal')]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(k) => (k === 'weight' ? t('monthly.avgWeight') : t('charts.avgKcal'))} />
              <Bar yAxisId="k" dataKey="avgKcal" fill="rgb(var(--accent))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Line yAxisId="w" dataKey="weight" stroke="rgb(var(--fat))" strokeWidth={2.5} connectNulls dot={{ r: 3 }} isAnimationActive={false} />
            </ComposedChart>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink3">{t('charts.noData')}</div>
          )}
        </ChartCard>

        <ChartCard title={t('monthly.minutesTrend')}>
          <BarChart data={trend} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
            <XAxis dataKey="start" tickFormatter={monthTick} tick={axisTick} interval={0} angle={-35} textAnchor="end" height={36} />
            <YAxis tick={axisTick} tickFormatter={(v) => L.d(v)} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => L.date(String(d), 'MMMM YYYY')} formatter={(v: number) => [n(v), t('unit.min')]} />
            <Bar dataKey="minutes" fill="rgb(var(--protein))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}

function Metric({ label, value, unit, delta, positiveGood, tone }: { label: string; value: string; unit?: string; delta?: number | null; positiveGood?: boolean; tone?: 'good' | 'bad' }) {
  const L = useL10n();
  const showDelta = delta != null && Math.abs(delta) >= 0.5;
  return (
    <Card className="p-3">
      <div className="text-[11px] text-ink2">{label}</div>
      <div className={`num mt-1 font-bold ${tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : ''}`}>
        {value} {unit && <span className="text-[11px] font-normal text-ink3">{unit}</span>}
      </div>
      {showDelta && (
        <div className={`num text-[11px] ${positiveGood ? (delta! > 0 ? 'text-good' : 'text-bad') : 'text-ink3'}`}>{L.signed(delta!, 0)}</div>
      )}
    </Card>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-md" style={{ background: color }} />
      {label}
    </span>
  );
}

