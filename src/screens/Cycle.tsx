import { useMemo, useState } from 'react';
import { Droplets, Flower2 } from 'lucide-react';
import { useL10n } from '../i18n';
import { setPeriod, toggleSymptom, useApp } from '../store/app';
import { openPage } from '../store/ui';
import { cycleInfo, cycleStats, fertileDays, predictedPeriodDays, type Phase } from '../domain/cycle';
import type { CycleSymptom, PeriodFlow } from '../domain/types';
import { Badge, Button, Card, cx, Page, ProgressBar } from '../components/ui';
import { MonthCalendar } from '../components/MonthCalendar';
import { monthBounds, todayIso } from '../utils/dates';

export const PHASE_COLOR: Record<Phase, string> = {
  period: '#E5484D',
  follicular: '#3DBFA8',
  ovulation: '#7C5CFA',
  luteal: '#F2A93B',
};

const FLOWS: PeriodFlow[] = ['spotting', 'light', 'medium', 'heavy'];
const SYMPTOMS: CycleSymptom[] = ['cramps', 'bloating', 'cravings', 'fatigue', 'headache', 'mood', 'acne', 'tender'];

/** True when cycle tracking applies to this user. */
export function useCycleOn() {
  const sex = useApp((s) => s.settings.profile.sex);
  const enabled = useApp((s) => s.settings.cycle.enabled);
  return sex === 'female' && enabled;
}

/** Home card: phase, cycle day, next period, quick "period today" toggle. */
export function CycleCard({ date }: { date: string }) {
  const L = useL10n();
  const { t, n } = L;
  const days = useApp((s) => s.days);
  const cfg = useApp((s) => s.settings.cycle);
  const info = useMemo(() => cycleInfo(date, days, cfg), [date, days, cfg]);
  const flow = days[date]?.period;

  return (
    <Card onClick={() => openPage({ kind: 'cycle' })}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold">
          <Flower2 size={18} style={{ color: PHASE_COLOR.period }} /> {t('cycle.title')}
        </h3>
        {info && (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: PHASE_COLOR[info.phase] }}>
            {t(`cycle.phase.${info.phase}`)}
          </span>
        )}
      </div>
      {info ? (
        <>
          <div className="flex items-end justify-between">
            <div>
              <div className="num text-2xl font-bold">{t('cycle.dayN', { n: n(info.cycleDay) })}</div>
              <div className="text-xs text-ink2">
                {info.daysUntilNext > 0 ? t('cycle.nextIn', { n: n(info.daysUntilNext), date: L.date(info.nextStart, 'D MMMM') }) : t('cycle.dueToday')}
              </div>
            </div>
          </div>
          <ProgressBar className="mt-3" value={info.cycleDay} max={info.cycleLength} color={PHASE_COLOR[info.phase]} />
          <p className="mt-2 text-xs text-ink2">{t(`cycle.tip.${info.phase}`)}</p>
        </>
      ) : (
        <p className="text-sm text-ink2">{t('cycle.noData')}</p>
      )}
      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant={flow ? 'danger' : 'secondary'} onClick={() => setPeriod(date, flow ? null : 'medium')}>
          <Droplets size={16} /> {flow ? t('cycle.removePeriod') : t('cycle.logPeriod')}
        </Button>
      </div>
    </Card>
  );
}

export function CyclePage() {
  const L = useL10n();
  const { t, n } = L;
  const days = useApp((s) => s.days);
  const cfg = useApp((s) => s.settings.cycle);
  const calendar = useApp((s) => s.settings.calendar);
  const [month, setMonth] = useState(todayIso());
  const [sel, setSel] = useState(todayIso());

  const { start, end } = monthBounds(month, calendar);
  const predicted = useMemo(() => predictedPeriodDays(start, end, days, cfg), [start, end, days, cfg]);
  const fertile = useMemo(() => fertileDays(start, end, days, cfg), [start, end, days, cfg]);
  const stats = useMemo(() => cycleStats(days, cfg), [days, cfg]);
  const info = useMemo(() => cycleInfo(todayIso(), days, cfg), [days, cfg]);
  const day = days[sel];

  return (
    <Page title={t('cycle.title')}>
      <Card>
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          selected={sel}
          onSelect={setSel}
          cell={(d) => {
            if (days[d]?.period) return { className: 'text-white', style: { background: PHASE_COLOR.period } };
            if (predicted.has(d)) return { style: { border: `2px dashed ${PHASE_COLOR.period}88` } };
            if (fertile.has(d)) return { style: { background: `${PHASE_COLOR.ovulation}22` } };
            return { below: days[d]?.symptoms?.length ? <span className="h-1 w-1 rounded-full bg-warn" /> : undefined };
          }}
        />
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-ink2">
          <Legend swatch={{ background: PHASE_COLOR.period }} label={t('cycle.legend.period')} />
          <Legend swatch={{ border: `2px dashed ${PHASE_COLOR.period}88` }} label={t('cycle.legend.predicted')} />
          <Legend swatch={{ background: `${PHASE_COLOR.ovulation}33` }} label={t('cycle.legend.fertile')} />
        </div>
      </Card>

      <Card className="mt-3">
        <div className="mb-2 font-bold">{L.date(sel, 'dddd D MMMM')}</div>
        <div className="mb-1 text-xs text-ink2">{t('cycle.flow')}</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPeriod(sel, null)} className={cx('rounded-full px-3 py-1 text-sm', !day?.period ? 'glass-tint' : 'glass-thin')}>
            {t('cycle.noFlow')}
          </button>
          {FLOWS.map((f) => (
            <button
              key={f}
              onClick={() => setPeriod(sel, f)}
              className={cx('rounded-full px-3 py-1 text-sm', day?.period === f ? 'text-white' : 'glass-thin')}
              style={day?.period === f ? { background: PHASE_COLOR.period } : undefined}
            >
              {t(`cycle.flows.${f}`)}
            </button>
          ))}
        </div>
        <div className="mb-1 mt-3 text-xs text-ink2">{t('cycle.symptoms')}</div>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((s) => (
            <button key={s} onClick={() => toggleSymptom(sel, s)} className={cx('rounded-full px-3 py-1 text-sm', day?.symptoms?.includes(s) ? 'glass-tint' : 'glass-thin')}>
              {t(`cycle.symptom.${s}`)}
            </button>
          ))}
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label={t('cycle.avgCycle')} value={t('cycle.days', { n: n(stats.cycleLength) })} />
        <Stat label={t('cycle.avgPeriod')} value={t('cycle.days', { n: n(stats.periodLength) })} />
        <Stat label={t('cycle.nextPeriod')} value={info ? L.date(info.nextStart, 'D MMMM') : '—'} />
        <Stat label={t('cycle.logged')} value={n(stats.loggedCycles)} />
      </div>
      {stats.loggedCycles < 2 && <p className="mt-2 text-xs text-ink3">{t('cycle.learning')}</p>}

      <Card className="mt-3">
        <h3 className="mb-1 font-bold">{t('cycle.energyTitle')}</h3>
        <p className="text-sm text-ink2">{t('cycle.energyText')}</p>
        <div className="mt-2">
          <Badge tone={cfg.lutealBoost ? 'good' : 'muted'}>
            {cfg.lutealBoost ? t('cycle.boostOn', { n: n(cfg.lutealKcal) }) : t('cycle.boostOff')}
          </Badge>
        </div>
      </Card>
      <p className="mt-3 text-center text-[11px] text-ink3">{t('cycle.disclaimer')}</p>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <div className="text-[11px] text-ink2">{label}</div>
      <div className="num mt-1 font-bold">{value}</div>
    </Card>
  );
}

function Legend({ swatch, label }: { swatch: React.CSSProperties; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-md" style={swatch} />
      {label}
    </span>
  );
}
