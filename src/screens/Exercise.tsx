import { CalendarDays, ListChecks, Plus } from 'lucide-react';
import { useL10n } from '../i18n';
import { removeExerciseEntry, updateSettings, useApp } from '../store/app';
import { openPage, setDate, useUI } from '../store/ui';
import { useDayStats, useWeekMinutes } from '../store/selectors';
import { setsVolume } from '../domain/exercise';
import { Button, Card, cx, Empty, IconBtn, Ring, Segmented, Swipeable } from '../components/ui';
import { ExerciseThumb } from '../components/icons';
import { addDays, todayIso, weekOf } from '../utils/dates';

export function ExerciseScreen() {
  const L = useL10n();
  const { t, n } = L;
  const date = useUI((s) => s.date);
  const st = useDayStats(date);
  const week = useWeekMinutes(date);
  const settings = useApp((s) => s.settings);
  const goal = settings.exercise.weeklyMinutesGoal;
  const today = todayIso();
  const rel = date === addDays(today, -1) ? 'yesterday' : date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : 'other';
  const sessions = st.day.exercises;
  const volume = sessions.reduce((a, s) => a + setsVolume(s.sets), 0);
  const weekDays = weekOf(today, settings.weekStart);

  return (
    <div className="pt-safe px-4 pb-28">
      <header className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-bold">{t('exercise.title')}</h1>
        <label className="relative">
          <IconBtn label="pickDate" className="pointer-events-none"><CalendarDays size={22} /></IconBtn>
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

      <div className="mt-3 lg:grid lg:grid-cols-2 lg:gap-4">
        <div>
          <Card className="flex items-center gap-4">
            <Ring value={week} max={goal} size={120} stroke={12} color="rgb(var(--protein))" track="rgb(var(--protein) / 0.15)">
              <span className="num text-2xl font-bold">{n(week)}</span>
              <span className="text-[11px] text-ink2">/ {n(goal)} {t('unit.min')}</span>
            </Ring>
            <div className="flex-1 space-y-2 text-sm">
              <div className="text-xs text-ink2">{t('exercise.thisWeek')}</div>
              <div className="flex justify-between"><span className="text-ink2">{t('exercise.todayMinutes')}</span><b className="num">{n(st.minutes)}</b></div>
              <div className="flex justify-between"><span className="text-ink2">{t('exercise.todayKcal')}</span><b className="num">{n(st.burned)}</b></div>
              {volume > 0 && <div className="flex justify-between"><span className="text-ink2">{t('exercise.volume')}</span><b className="num">{n(volume)} {t('unit.kg')}</b></div>}
            </div>
          </Card>

          <Card className="mt-3">
            <div className="mb-2 text-sm font-bold">{t('exercise.weeklyPlan')}</div>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((d) => {
                const dow = new Date(d + 'T12:00:00').getDay();
                const on = settings.exercise.plannedWeekdays.includes(dow);
                return (
                  <button
                    key={d}
                    onClick={() => updateSettings((s) => ({ ...s, exercise: { ...s.exercise, plannedWeekdays: on ? s.exercise.plannedWeekdays.filter((x) => x !== dow) : [...s.exercise.plannedWeekdays, dow] } }))}
                    className={cx('rounded-2xl py-2 text-xs font-medium transition', on ? 'bg-protein text-white shadow-[inset_0_1px_0_rgba(255,255,255,.4)]' : 'glass-thin text-ink2')}
                  >
                    {L.date(d, 'dd')}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-ink3">{t('exercise.planHint')}</p>
          </Card>
        </div>

        <div>
          <div className="mt-3 flex gap-2 lg:mt-0">
            <Button block onClick={() => openPage({ kind: 'addExercise', date })}><Plus size={18} /> {t('exercise.add')}</Button>
            <Button variant="secondary" onClick={() => openPage({ kind: 'routines', date })}><ListChecks size={18} /> {t('exercise.routines')}</Button>
          </div>
          <div className="mt-3 space-y-2">
            {sessions.length ? (
              sessions.map((s) => (
                <Card key={s.id} className="p-0">
                  <Swipeable onDelete={() => removeExerciseEntry(date, s.id)} deleteLabel={t('common.delete')}>
                    <button className="flex w-full items-center gap-3 p-3 text-start" onClick={() => openPage({ kind: 'exercise', exerciseId: s.exerciseId, date, entryId: s.id })}>
                      <ExerciseThumb category={s.category} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{L.name(s.exerciseName)}</div>
                        <div className="text-xs text-ink2">
                          {n(s.minutes)} {t('unit.min')} • {t(`intensity.${s.intensity}`)}
                          {s.distanceKm ? ` • ${n(s.distanceKm, 1)} ${t('unit.km')}` : ''}
                          {s.steps ? ` • ${n(s.steps)} ${t('exercise.steps')}` : ''}
                          {s.sets?.length ? ` • ${n(s.sets.length)} ${t('exercise.sets')}` : ''}
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="num font-bold">{n(s.kcal)}</div>
                        <div className="text-[11px] text-ink3">{t('unit.kcal')}{s.kcalManual ? ' ✎' : ''}</div>
                      </div>
                    </button>
                  </Swipeable>
                </Card>
              ))
            ) : (
              <Empty text={t('exercise.empty')} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
