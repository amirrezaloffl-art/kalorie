import type { ReactNode } from 'react';
import { useApp } from '../store/app';
import { useL10n } from '../i18n';
import { monthBounds, rangeDays, shiftMonth, todayIso, weekOf } from '../utils/dates';
import { BackIcon, cx, ForwardIcon, IconBtn } from './ui';

export interface DayCell {
  className?: string;
  style?: React.CSSProperties;
  below?: ReactNode; // small marks under the number
}

/** Month grid that follows the calendar (Jalali / Gregorian) and week-start settings. */
export function MonthCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  cell,
}: {
  month: string; // any day inside the month
  onMonthChange: (iso: string) => void;
  selected?: string;
  onSelect?: (iso: string) => void;
  cell?: (iso: string) => DayCell;
}) {
  const L = useL10n();
  const calendar = useApp((s) => s.settings.calendar);
  const weekStart = useApp((s) => s.settings.weekStart);
  const { start, end } = monthBounds(month, calendar);
  const first = weekOf(start, weekStart)[0];
  const lastWeek = weekOf(end, weekStart);
  const grid = rangeDays(first, lastWeek[6]);
  const today = todayIso();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <IconBtn label="prevMonth" onClick={() => onMonthChange(shiftMonth(month, -1, calendar))}>
          <BackIcon size={20} />
        </IconBtn>
        <div className="font-bold">{L.date(start, 'MMMM YYYY')}</div>
        <IconBtn label="nextMonth" onClick={() => onMonthChange(shiftMonth(month, 1, calendar))}>
          <ForwardIcon size={20} />
        </IconBtn>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] text-ink3">
        {grid.slice(0, 7).map((d) => (
          <div key={d}>{L.date(d, 'dd')}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d) => {
          const inMonth = d >= start && d <= end;
          if (!inMonth) return <div key={d} />;
          const c = cell?.(d) ?? {};
          return (
            <button
              key={d}
              onClick={() => onSelect?.(d)}
              className={cx(
                'relative flex aspect-square flex-col items-center justify-center rounded-2xl border text-sm transition',
                selected === d ? 'border-accent ring-2 ring-accent/40' : 'border-transparent',
                d === today && 'font-bold text-accent',
                d > today && 'opacity-70',
                c.className,
              )}
              style={c.style}
            >
              <span className="num leading-none">{L.date(d, 'D')}</span>
              {c.below && <span className="mt-0.5 flex h-1.5 items-center gap-0.5">{c.below}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
