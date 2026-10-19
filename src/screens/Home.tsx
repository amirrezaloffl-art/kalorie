import { Pie, PieChart, Cell, ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';
import { Activity, Archive, Barcode, Clock, Droplet, Flame, Minus, Plus, Scale, Search, Star, User } from 'lucide-react';
import { useRef } from 'react';
import { useL10n } from '../i18n';
import { markBackedUp, setWater, snapshot, useApp } from '../store/app';
import { openPage, setDate, toast, useUI } from '../store/ui';
import { useDayStats, useWeekMinutes } from '../store/selectors';
import { macroSplit } from '../domain/nutrition';
import { daysSince } from '../domain/trend';
import { Badge, Button, Card, cx, ProgressBar, Ring } from '../components/ui';
import { ExerciseThumb } from '../components/icons';
import { WeekStrip } from '../components/WeekStrip';
import { todayIso } from '../utils/dates';
import { exportZip, shareOrDownload } from '../storage/files';

export function Home() {
  const L = useL10n();
  const { t, n } = L;
  const date = useUI((s) => s.date);
  const settings = useApp((s) => s.settings);
  const st = useDayStats(date);
  const today = todayIso();

  const hour = new Date().getHours();
  const greet = hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
  const over = st.left < 0;

  return (
    <div className="pb-28">
      {/* Hero */}
      <div className="pt-safe px-4 pb-6">
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-lg font-bold">
              {t(`home.greet.${greet}`)}
              {settings.userName ? (L.lang === 'fa' ? '، ' : ', ') + settings.userName : ''}
            </div>
            <div className="text-sm text-ink2">{L.date(date, 'dddd D MMMM YYYY')}</div>
          </div>
          <button aria-label={t('settings.title')} onClick={() => openPage({ kind: 'settings' })} className="glass flex h-11 w-11 items-center justify-center rounded-full text-accent">
            {settings.userName ? <span className="text-lg font-bold">{settings.userName.slice(0, 1)}</span> : <User size={20} />}
          </button>
        </div>
        <div className="glass mt-2 rounded-[28px] p-1.5">
          <WeekStrip date={date} onChange={setDate} />
        </div>
        {date !== today && (
          <div className="mt-2 text-center">
            <button className="glass rounded-full px-3 py-1 text-xs text-accent" onClick={() => setDate(today)}>
              {t('common.backToToday')}
            </button>
          </div>
        )}
      </div>

      <div className="-mt-3 space-y-3 px-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        <div className="space-y-3">
          <Reminders />
          {/* Calorie ring */}
          <Card className="flex items-center gap-4">
            <Ring value={st.eaten.kcal} max={st.goal + (settings.exercise.addBackToBudget ? st.burned : 0)} size={156} stroke={14} color={over ? 'rgb(var(--bad))' : 'rgb(var(--accent))'}>
              <span className={cx('num text-4xl font-bold leading-none', over && 'text-bad')}>{n(Math.abs(st.left))}</span>
              <span className="mt-1 text-xs text-ink2">{over ? t('home.kcalOver') : t('home.kcalLeft')}</span>
            </Ring>
            <div className="flex-1 space-y-3">
              <Stat label={t('home.goal')} value={n(st.goal)} />
              <Stat label={t('home.eaten')} value={n(st.eaten.kcal)} color="rgb(var(--accent))" />
              <Stat label={t('home.burned')} value={n(st.burned)} color="rgb(var(--protein))" icon={<Flame size={14} />} />
            </div>
          </Card>

          {/* Macro cards */}
          <div className="grid grid-cols-3 gap-2">
            <MacroCard label={t('macro.protein')} value={st.eaten.protein} target={st.targets.proteinG} color="rgb(var(--protein))" />
            <MacroCard label={t('macro.carbs')} value={st.eaten.carbs} target={st.targets.carbsG} color="rgb(var(--carbs))" />
            <MacroCard label={t('macro.fat')} value={st.eaten.fat} target={st.targets.fatG} color="rgb(var(--fat))" />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-2">
            <QuickAction icon={<Search size={20} />} label={t('home.searchFood')} onClick={() => openPage({ kind: 'addFood', date })} />
            <QuickAction icon={<Barcode size={20} />} label={t('home.barcode')} onClick={() => openPage({ kind: 'addFood', date, mode: 'barcode' })} />
            <QuickAction icon={<Star size={20} />} label={t('home.recentFav')} onClick={() => openPage({ kind: 'addFood', date, mode: 'favorites' })} />
          </div>

          <ExerciseCard date={date} burned={st.burned} minutes={st.minutes} />
        </div>

        <div className="space-y-3">
          <WaterCard date={date} glasses={st.day.waterGlasses} />
          <MacroDonut p={st.eaten.protein} c={st.eaten.carbs} f={st.eaten.fat} />
          <WeightCard />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-sm text-ink2">
        <span className="h-2 w-2 rounded-full" style={{ background: color ?? 'rgb(var(--text-3))' }} />
        {label}
        {icon}
      </span>
      <span className="num font-bold">{value}</span>
    </div>
  );
}

function MacroCard({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const { n, t } = useL10n();
  return (
    <Card className="p-3">
      <div className="text-xs text-ink2">{label}</div>
      <div className="num mt-1 whitespace-nowrap text-[13px]">
        <b className="text-base">{n(value)}</b>
        <span className="text-ink3"> / {n(target)} {t('unit.g')}</span>
      </div>
      <ProgressBar className="mt-2" value={value} max={target} color={color} />
    </Card>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="glass flex flex-col items-center gap-1.5 rounded-[26px] p-3 text-xs font-medium active:scale-[0.97]">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">{icon}</span>
      {label}
    </button>
  );
}

function ExerciseCard({ date, burned, minutes }: { date: string; burned: number; minutes: number }) {
  const L = useL10n();
  const { t, n } = L;
  const day = useApp((s) => s.days[date]);
  const goal = useApp((s) => s.settings.exercise.weeklyMinutesGoal);
  const week = useWeekMinutes(date);
  const sessions = day?.exercises ?? [];
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold">
          <Activity size={18} className="text-protein" /> {t('home.exercise')}
        </h3>
        <button className="text-sm text-accent" onClick={() => openPage({ kind: 'addExercise', date })}>
          + {t('common.add')}
        </button>
      </div>
      {sessions.length ? (
        <div className="space-y-2">
          {sessions.map((s) => (
            <button key={s.id} className="flex w-full items-center gap-3 text-start" onClick={() => openPage({ kind: 'exercise', exerciseId: s.exerciseId, date, entryId: s.id })}>
              <ExerciseThumb category={s.category} size={36} />
              <span className="flex-1 text-sm">
                {L.name(s.exerciseName)} • {n(s.minutes)} {t('unit.min')}
              </span>
              <span className="num text-sm font-bold">{n(s.kcal)} <span className="text-xs font-normal text-ink3">{t('unit.kcal')}</span></span>
            </button>
          ))}
          <div className="flex justify-between border-t border-ink/10 pt-2 text-xs text-ink2">
            <span>{t('home.activeMinutes', { n: n(minutes) })}</span>
            <span>{n(burned)} {t('unit.kcal')}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink3">{t('home.noExercise')}</p>
      )}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-ink2">
          <span>{t('home.weekMinutes')}</span>
          <span className="num">{n(week)} / {n(goal)} {t('unit.min')}</span>
        </div>
        <ProgressBar value={week} max={goal} color="rgb(var(--protein))" />
      </div>
    </Card>
  );
}

function WaterCard({ date, glasses }: { date: string; glasses: number }) {
  const { t, n } = useL10n();
  const water = useApp((s) => s.settings.water);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const segs = Math.max(water.goalGlasses, glasses);
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold">
          <Droplet size={18} className="text-water" /> {t('water.title')}
        </h3>
        <span className="num text-sm text-ink2">
          <b className="text-lg text-ink">{n(glasses)}</b> / {n(water.goalGlasses)} {t('water.glasses')}
        </span>
      </div>
      <div className="mb-3 flex gap-1">
        {Array.from({ length: segs }, (_, i) => (
          <div key={i} className={cx('h-8 flex-1 rounded-full transition', i < glasses ? 'bg-water shadow-[inset_0_1px_0_rgba(255,255,255,.5)]' : 'bg-water/15')} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label={t('water.remove')}
          onClick={() => setWater(date, glasses - 1)}
          disabled={glasses === 0}
        >
          <Minus size={16} />
        </Button>
        <Button
          className="flex-1 !bg-water !text-white"
          onClick={() => setWater(date, glasses + 1)}
          onPointerDown={() => (timer.current = setTimeout(() => { setWater(date, glasses - 1); toast(t('water.removed')); timer.current = undefined; }, 600))}
          onPointerUp={() => clearTimeout(timer.current)}
          onPointerLeave={() => clearTimeout(timer.current)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Plus size={18} /> {t('water.addGlass')}
        </Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-ink3">{t('water.hint', { ml: n(water.glassMl), total: n(glasses * water.glassMl) })}</p>
    </Card>
  );
}

function MacroDonut({ p, c, f }: { p: number; c: number; f: number }) {
  const { t, n } = useL10n();
  const split = macroSplit({ kcal: 0, protein: p, carbs: c, fat: f });
  const data = [
    { key: 'protein', v: split.protein, color: 'rgb(var(--protein))' },
    { key: 'carbs', v: split.carbs, color: 'rgb(var(--carbs))' },
    { key: 'fat', v: split.fat, color: 'rgb(var(--fat))' },
  ];
  const empty = !p && !c && !f;
  return (
    <Card>
      <h3 className="mb-2 font-bold">{t('home.macroSplit')}</h3>
      <div className="flex items-center gap-4">
        <div className="h-32 w-32 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={empty ? [{ v: 1 }] : data} dataKey="v" innerRadius={40} outerRadius={60} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}>
                {(empty ? [{ color: 'rgb(var(--accent-soft))' }] : data).map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d) => (
            <div key={d.key} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                {t(`macro.${d.key}`)}
              </span>
              <span className="num font-bold">{n(d.v)}{t('unit.pct')}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function WeightCard() {
  const L = useL10n();
  const { t, n } = L;
  const weights = useApp((s) => s.weights);
  const last = weights[weights.length - 1];
  const prev = last ? [...weights].reverse().find((w) => daysSince(w.date, last.date) >= 6) : undefined;
  const due = !last || daysSince(last.date, todayIso()) >= 7;
  const diff = last && prev ? last.kg - prev.kg : null;
  const spark = weights.slice(-8).map((w) => ({ kg: w.kg }));
  return (
    <Card onClick={() => openPage({ kind: 'weight' })}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold">
          <Scale size={18} className="text-fat" /> {t('weight.title')}
        </h3>
        {due && <Badge tone="warn"><Clock size={12} /> {t('weight.due')}</Badge>}
      </div>
      {last ? (
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="num text-3xl font-bold">
              {n(last.kg, 1)} <span className="text-sm font-normal text-ink2">{t('unit.kg')}</span>
            </div>
            <div className="text-xs text-ink2">
              {diff != null ? (
                <span className={diff <= 0 ? 'text-good' : 'text-bad'}>
                  {L.signed(diff)} {t('weight.sinceLastWeek')}
                </span>
              ) : (
                L.date(last.date, 'D MMMM')
              )}
            </div>
          </div>
          {spark.length > 1 && (
            <div className="h-12 w-32">
              <ResponsiveContainer>
                <LineChart data={spark}>
                  <YAxis hide domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                  <Line type="monotone" dataKey="kg" stroke="rgb(var(--fat))" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink3">{t('weight.none')}</p>
      )}
    </Card>
  );
}

function Reminders() {
  const { t } = useL10n();
  const last = useApp((s) => s.settings.lastBackupAt);
  const hasData = useApp((s) => Object.keys(s.days).length > 0);
  const folder = useApp((s) => s.folder);
  const due = hasData && folder !== 'connected' && (!last || daysSince(last, todayIso()) >= 7);
  if (!due) return null;
  return (
    <Card className="flex items-center gap-3 !bg-accent/10">
      <Archive size={22} className="shrink-0 text-accent" />
      <div className="flex-1 text-sm">{t('backup.reminder')}</div>
      <Button
        size="sm"
        variant="accent"
        onClick={async () => {
          const blob = await exportZip(await snapshot());
          await shareOrDownload(blob, `kalori-backup-${todayIso()}.zip`);
          markBackedUp();
        }}
      >
        {t('backup.now')}
      </Button>
    </Card>
  );
}

