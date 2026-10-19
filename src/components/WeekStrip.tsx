import { useApp } from '../store/app';
import { useL10n } from '../i18n';
import { addDays, todayIso, weekday, weekOf } from '../utils/dates';
import { cx, IconBtn, BackIcon, ForwardIcon } from './ui';

/** Horizontal week strip (image 2). Dots: food logged; ring: planned exercise day. */
export function WeekStrip({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const { date: fmt } = useL10n();
  const start = useApp((s) => s.settings.weekStart);
  const planned = useApp((s) => s.settings.exercise.plannedWeekdays);
  const days = useApp((s) => s.days);
  const week = weekOf(date, start);
  const today = todayIso();
  return (
    <div className="flex items-center gap-1">
      <IconBtn label="prevWeek" className="h-8 w-8 text-ink2" onClick={() => onChange(addDays(date, -7))}>
        <BackIcon size={18} />
      </IconBtn>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {week.map((d) => {
          const sel = d === date;
          const log = days[d];
          const hasFood = !!log?.entries.length;
          const didEx = !!log?.exercises.length;
          const isPlanned = planned.includes(weekday(d));
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              className={cx(
                'flex flex-col items-center gap-1 rounded-2xl border py-2 text-xs transition',
                sel ? 'glass-tint' : d === today ? 'border-transparent text-accent' : 'border-transparent text-ink2',
                d > today && !sel && 'opacity-60',
              )}
            >
              <span className="text-[10px] opacity-80">{fmt(d, 'dd')}</span>
              <span className="num text-sm font-bold">{fmt(d, 'D')}</span>
              <span className="flex h-1.5 items-center gap-0.5">
                {hasFood && <span className={cx('h-1.5 w-1.5 rounded-full', sel ? 'bg-white' : 'bg-accent')} />}
                {isPlanned && <span className={cx('h-1.5 w-1.5 rounded-full border', didEx ? 'border-good bg-good' : sel ? 'border-white' : 'border-protein')} />}
              </span>
            </button>
          );
        })}
      </div>
      <IconBtn label="nextWeek" className="h-8 w-8 text-ink2" onClick={() => onChange(addDays(date, 7))}>
        <ForwardIcon size={18} />
      </IconBtn>
    </div>
  );
}
