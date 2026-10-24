import { useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { useL10n } from '../i18n';
import { useApp } from '../store/app';
import { dayStats, goalFor } from '../store/selectors';
import { ewma } from '../domain/trend';
import { macroSplit } from '../domain/nutrition';
import type { DayLog, ExerciseCategoryId, Settings } from '../domain/types';
import { MonthlyOverview } from './Monthly';
import { Card, Segmented, TextInput } from '../components/ui';
import { EX_COLORS } from '../components/icons';
import { addDays, rangeDays, todayIso, weekOf } from '../utils/dates';

type Range = '7' | '30' | '90' | 'custom';

export const axisTick = { fontSize: 10, fill: 'rgb(var(--text-2))' };
export const tooltipStyle = { background: 'rgb(var(--surface))', border: '1px solid rgb(var(--border))', borderRadius: 12, fontSize: 12 };
const PIE_COLORS = ['#7C5CFA', '#F26D6D', '#F2A93B', '#5B8DEF', '#3DBFA8', '#4CC36B', '#E86FB5', '#9A9AA8'];

/** Per-day numbers shared by the range charts and the monthly overview. */
export function dayRow(d: string, allDays: Record<string, DayLog>, settings: Settings) {
  const day: DayLog = allDays[d] ?? { date: d, entries: [], exercises: [], waterGlasses: 0 };
  const addBack = settings.exercise.addBackToBudget;
  const goal = goalFor(d, settings, allDays);
  const st = dayStats(day, goal, addBack);
  const budget = goal + (addBack ? st.burned : 0);
  const byCat: Partial<Record<ExerciseCategoryId, number>> = {};
  for (const e of day.exercises) byCat[e.category] = (byCat[e.category] ?? 0) + e.minutes;
  return {
    date: d,
    kcal: st.eaten.kcal,
    burned: st.burned,
    net: st.eaten.kcal - st.burned,
    goal,
    budget,
    protein: st.eaten.protein,
    carbs: st.eaten.carbs,
    fat: st.eaten.fat,
    water: day.waterGlasses,
    minutes: st.minutes,
    logged: day.entries.length > 0,
    period: !!day.period,
    ...Object.fromEntries(Object.entries(byCat).map(([k, v]) => [`m_${k}`, v])),
  };
}
export type DayRow = ReturnType<typeof dayRow>;

/** On target = between 80 % and 100 % of the day's budget. */
export const isOnTarget = (r: DayRow) => r.kcal <= r.budget && r.kcal >= r.budget * 0.8;

export function Charts() {
  const { t } = useL10n();
  const [view, setView] = useState<'trends' | 'monthly'>('trends');
  return (
    <div className="pt-safe px-4 pb-28">
      <header className="flex items-center justify-between gap-3 py-2">
        <h1 className="text-2xl font-bold">{t('charts.title')}</h1>
        <Segmented
          className="w-48"
          value={view}
          onChange={setView}
          options={[
            { value: 'trends', label: t('charts.trends') },
            { value: 'monthly', label: t('charts.monthly') },
          ]}
        />
      </header>
      {view === 'trends' ? <RangeCharts /> : <MonthlyOverview />}
    </div>
  );
}

function RangeCharts() {
  const L = useL10n();
  const { t, n } = L;
  const today = todayIso();
  const [range, setRange] = useState<Range>('7');
  const [from, setFrom] = useState(addDays(today, -13));
  const [to, setTo] = useState(today);
  const settings = useApp((s) => s.settings);
  const allDays = useApp((s) => s.days);
  const weights = useApp((s) => s.weights);

  const [start, end] = range === 'custom' ? [from <= to ? from : to, from <= to ? to : from] : [addDays(today, -(Number(range) - 1)), today];
  const dates = useMemo(() => rangeDays(start, end), [start, end]);
  const goal = settings.goal.dailyKcal;
  const rows = useMemo(() => dates.map((d) => dayRow(d, allDays, settings)), [dates, allDays, settings]);

  const logged = rows.filter((r) => r.logged);
  const avgKcal = logged.length ? logged.reduce((a, r) => a + r.kcal, 0) / logged.length : 0;
  const onTarget = logged.filter(isOnTarget).length;
  const avgProtein = logged.length ? logged.reduce((a, r) => a + r.protein, 0) / logged.length : 0;
  const totals = logged.reduce((a, r) => ({ protein: a.protein + r.protein, carbs: a.carbs + r.carbs, fat: a.fat + r.fat }), { protein: 0, carbs: 0, fat: 0 });
  const split = macroSplit({ kcal: 0, ...totals });

  const exByType = useMemo(() => {
    const m = new Map<string, { name: string; kcal: number }>();
    for (const d of dates) for (const e of allDays[d]?.exercises ?? []) {
      const k = e.exerciseId;
      const cur = m.get(k) ?? { name: L.name(e.exerciseName), kcal: 0 };
      cur.kcal += e.kcal;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => b.kcal - a.kcal);
  }, [dates, allDays, L]);

  const weekly = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const wk = weekOf(r.date, settings.weekStart)[0];
      m.set(wk, (m.get(wk) ?? 0) + r.burned);
    }
    return [...m.entries()].map(([week, kcal]) => ({ week, kcal }));
  }, [rows, settings.weekStart]);

  const usedCats = (Object.keys(EX_COLORS) as ExerciseCategoryId[]).filter((c) => rows.some((r) => (r as Record<string, unknown>)[`m_${c}`]));

  const weightRows = useMemo(() => {
    const inRange = weights.filter((w) => w.date >= start && w.date <= end);
    const tr = ewma(inRange.map((w) => w.kg));
    return inRange.map((w, i) => ({ date: w.date, kg: w.kg, trend: tr[i] }));
  }, [weights, start, end]);

  const tickDate = (d: string) => L.date(d, dates.length > 31 ? 'D/M' : 'D MMM');
  const xAxis = <XAxis dataKey="date" tickFormatter={tickDate} tick={axisTick} minTickGap={12} />;
  const tip = <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => L.date(String(d), 'dddd D MMMM')} formatter={(v: number, name: string) => [n(v), name]} />;
  const barColor = (r: (typeof rows)[number]) => (r.kcal <= r.budget ? 'rgb(var(--accent))' : r.kcal <= r.budget * 1.1 ? 'rgb(var(--warn))' : 'rgb(var(--bad))');

  return (
    <div>
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: '7', label: t('charts.days', { n: n(7) }) },
          { value: '30', label: t('charts.days', { n: n(30) }) },
          { value: '90', label: t('charts.days', { n: n(90) }) },
          { value: 'custom', label: t('charts.custom') },
        ]}
      />
      {range === 'custom' && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <TextInput type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          <TextInput type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Summary label={t('charts.avgKcal')} value={n(avgKcal)} />
        <Summary label={t('charts.onTarget')} value={`${n(onTarget)}/${n(logged.length)}`} />
        <Summary label={t('charts.avgProtein')} value={`${n(avgProtein)} ${t('unit.g')}`} />
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        <ChartCard title={t('charts.calories')}>
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
            {xAxis}
            <YAxis tick={axisTick} tickFormatter={(v) => L.d(v)} />
            {tip}
            <ReferenceLine ifOverflow="extendDomain" y={goal} stroke="rgb(var(--text-2))" strokeDasharray="5 4" />
            <Bar dataKey="kcal" name={t('home.eaten')} radius={[6, 6, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => <Cell key={r.date} fill={barColor(r)} />)}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title={t('charts.intakeVsBurned')}>
          <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
            {xAxis}
            <YAxis tick={axisTick} tickFormatter={(v) => L.d(v)} />
            {tip}
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="kcal" name={t('home.eaten')} fill="rgb(var(--accent))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="burned" name={t('home.burned')} fill="rgb(var(--protein))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Line dataKey="net" name={t('charts.net')} stroke="rgb(var(--text))" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ChartCard>

        <ChartCard title={t('charts.exerciseMinutes')}>
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
            {xAxis}
            <YAxis tick={axisTick} tickFormatter={(v) => L.d(v)} />
            {tip}
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {usedCats.map((c) => (
              <Bar key={c} dataKey={`m_${c}`} name={t(`exCat.${c}`)} stackId="m" fill={EX_COLORS[c]} isAnimationActive={false} />
            ))}
          </BarChart>
        </ChartCard>

        <ChartCard title={t('charts.weeklyBurned')}>
          <BarChart data={weekly} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
            <XAxis dataKey="week" tickFormatter={(d) => L.date(d, 'D MMM')} tick={axisTick} />
            <YAxis tick={axisTick} tickFormatter={(v) => L.d(v)} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => L.date(String(d), 'D MMMM')} formatter={(v: number) => [n(v), t('unit.kcal')]} />
            <Bar dataKey="kcal" fill="rgb(var(--protein))" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartCard>

        <Card className="mt-3">
          <h3 className="mb-2 font-bold">{t('charts.exerciseTypes')}</h3>
          {exByType.length ? (
            <Donut data={exByType.map((e, i) => ({ name: e.name, value: e.kcal, color: PIE_COLORS[i % PIE_COLORS.length] }))} unit={t('unit.kcal')} />
          ) : (
            <p className="text-sm text-ink3">{t('charts.noData')}</p>
          )}
        </Card>

        <ChartCard title={t('charts.macros')}>
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
            {xAxis}
            <YAxis tick={axisTick} tickFormatter={(v) => L.d(v)} />
            {tip}
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="protein" name={t('macro.protein')} stackId="a" fill="rgb(var(--protein))" isAnimationActive={false} />
            <Bar dataKey="carbs" name={t('macro.carbs')} stackId="a" fill="rgb(var(--carbs))" isAnimationActive={false} />
            <Bar dataKey="fat" name={t('macro.fat')} stackId="a" fill="rgb(var(--fat))" isAnimationActive={false} />
          </BarChart>
        </ChartCard>

        <Card className="mt-3">
          <h3 className="mb-2 font-bold">{t('charts.macroAvg')}</h3>
          {logged.length ? (
            <Donut
              unit={t('unit.pct')}
              data={[
                { name: t('macro.protein'), value: split.protein, color: 'rgb(var(--protein))' },
                { name: t('macro.carbs'), value: split.carbs, color: 'rgb(var(--carbs))' },
                { name: t('macro.fat'), value: split.fat, color: 'rgb(var(--fat))' },
              ]}
            />
          ) : (
            <p className="text-sm text-ink3">{t('charts.noData')}</p>
          )}
        </Card>

        <ChartCard title={t('charts.water')}>
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
            {xAxis}
            <YAxis tick={axisTick} tickFormatter={(v) => L.d(v)} allowDecimals={false} />
            {tip}
            <ReferenceLine ifOverflow="extendDomain" y={settings.water.goalGlasses} stroke="rgb(var(--water))" strokeDasharray="5 4" />
            <Bar dataKey="water" name={t('water.glasses')} fill="rgb(var(--water))" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartCard>

        <ChartCard title={t('weight.title')}>
          {weightRows.length ? (
            <ComposedChart data={weightRows} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
              {xAxis}
              <YAxis tick={axisTick} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v) => L.d(Math.round(v))} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => L.date(String(d), 'D MMMM')} formatter={(v: number, k: string) => [n(v, 1), k === 'trend' ? t('weight.trend') : t('unit.kg')]} />
              <ReferenceLine ifOverflow="extendDomain" y={settings.goal.targetKg} stroke="rgb(var(--good))" strokeDasharray="5 4" />
              <Line dataKey="trend" stroke="rgb(var(--accent))" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Scatter dataKey="kg" fill="rgb(var(--fat))" isAnimationActive={false} />
            </ComposedChart>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink3">{t('charts.noData')}</div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

export function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <div className="text-[11px] text-ink2">{label}</div>
      <div className="num mt-1 font-bold">{value}</div>
    </Card>
  );
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mt-3">
      <h3 className="mb-2 font-bold">{title}</h3>
      <div className="h-52" dir="ltr">
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </Card>
  );
}

function Donut({ data, unit }: { data: { name: string; value: number; color: string }[]; unit: string }) {
  const { n } = useL10n();
  return (
    <div className="flex items-center gap-4">
      <div className="h-32 w-32 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={38} outerRadius={60} stroke="none" isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {data.slice(0, 6).map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="num shrink-0 font-bold">{n(d.value)} <span className="text-xs font-normal text-ink3">{unit}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
