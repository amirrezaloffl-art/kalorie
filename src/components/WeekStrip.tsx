import { useApp } from '../store/app';
import { useL10n } from '../i18n';
import { addDays, todayIso, weekday, weekOf } from '../utils/dates';
import { cx, IconBtn, BackIcon, ForwardIcon } from './ui';

/** Horizontal week strip (image 2). Dots: food logged; ring: planned exercise day. */
export function WeekStrip({ date, onChange, tone = 'onHero' }: { date: string; onChange: (d: string) => void; tone?: 'onHero' | 'plain' }) {
  const { date: fmt } = useL10n();
  const start = useApp((s) => s.settings.weekStart);
  const planned = useApp((s) => s.settings.exercise.plannedWeekdays);
  const days = useApp((s) => s.days);
  const week = weekOf(date, start);
  const today = todayIso();
  const hero = tone === 'onHero';
  return (
    <div className="flex items-center gap-1">
      <IconBtn label="prevWeek" className={cx('h-8 w-8 shrink-0', hero && 'text-white hover:bg-white/10')} onClick={() => onChange(addDays(date, -7))}>
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
                'flex flex-col items-center gap-1 rounded-md py-2 text-xs transition',
                sel ? (hero ? 'bg-white text-[#121217] shadow-card' : 'bg-primary text-onPrimary') : hero ? 'text-white/85' : 'text-ink2',
                d > today && !sel && 'opacity-60',
              )}
            >
              <span className="text-[10px] opacity-80">{fmt(d, 'dd')}</span>
              <span className="num text-sm font-bold">{fmt(d, 'D')}</span>
              <span className="flex h-1.5 items-center gap-0.5">
                {hasFood && <span className={cx('h-1.5 w-1.5 rounded-full', sel && hero ? 'bg-accent' : hero ? 'bg-white' : 'bg-accent')} />}
                {isPlanned && <span className={cx('h-1.5 w-1.5 rounded-full border', didEx ? 'border-good bg-good' : hero && !sel ? 'border-white' : 'border-protein')} />}
              </span>
            </button>
          );
        })}
      </div>
      <IconBtn label="nextWeek" className={cx('h-8 w-8 shrink-0', hero && 'text-white hover:bg-white/10')} onClick={() => onChange(addDays(date, 7))}>
        <ForwardIcon size={18} />
      </IconBtn>
    </div>
  );
}
