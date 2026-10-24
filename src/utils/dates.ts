import dayjs, { type Dayjs } from 'dayjs';
import jalaliday from 'jalaliday';
import 'dayjs/locale/fa';
import { toDigits } from './digits';

dayjs.extend(jalaliday);

export type CalendarKind = 'jalali' | 'gregorian';

export interface DateFmtOptions {
  calendar: CalendarKind;
  lang: 'fa' | 'en';
  digits: 'fa' | 'latin';
}

/** Local-date ISO string (YYYY-MM-DD). */
export const isoDate = (d: Date | Dayjs = new Date()) => dayjs(d).format('YYYY-MM-DD');
export const todayIso = () => isoDate(new Date());
export const addDays = (iso: string, n: number) => dayjs(iso).add(n, 'day').format('YYYY-MM-DD');
export const monthKey = (iso: string) => iso.slice(0, 7);

export function rangeDays(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  let d = dayjs(fromIso);
  const end = dayjs(toIso);
  while (!d.isAfter(end, 'day')) {
    out.push(d.format('YYYY-MM-DD'));
    d = d.add(1, 'day');
  }
  return out;
}

function localized(iso: string, o: DateFmtOptions): Dayjs {
  const d = dayjs(iso);
  if (o.calendar === 'jalali') return d.calendar('jalali').locale(o.lang === 'fa' ? 'fa' : 'en');
  return d.calendar('gregory').locale(o.lang === 'fa' ? 'fa' : 'en');
}

/** Formats an ISO date for display. Patterns are dayjs tokens. */
export function fmtDate(iso: string, pattern: string, o: DateFmtOptions): string {
  // Persian month abbreviations ("شهر", "بهم") read badly; always use full names.
  if (o.lang === 'fa') pattern = pattern.replace(/(?<!M)MMM(?!M)/g, 'MMMM');
  let s = localized(iso, o).format(pattern);
  // English month names for Jalali calendar when UI is English
  if (o.calendar === 'jalali' && o.lang === 'en' && /MMM/.test(pattern)) {
    const jm = localized(iso, o).month();
    s = localized(iso, o).format(pattern.replace(/MMMM|MMM/, `[${JALALI_EN[jm]}]`));
  }
  return toDigits(s, o.digits);
}

const JALALI_EN = ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'];

/** First and last ISO day of the (Jalali or Gregorian) month containing `iso`. */
export function monthBounds(iso: string, calendar: CalendarKind): { start: string; end: string } {
  if (calendar === 'jalali') {
    const j = dayjs(iso).calendar('jalali');
    return { start: j.startOf('month').calendar('gregory').format('YYYY-MM-DD'), end: j.endOf('month').calendar('gregory').format('YYYY-MM-DD') };
  }
  const d = dayjs(iso);
  return { start: d.startOf('month').format('YYYY-MM-DD'), end: d.endOf('month').format('YYYY-MM-DD') };
}

/** First day of the month `n` months away from the month containing `iso`. */
export function shiftMonth(iso: string, n: number, calendar: CalendarKind): string {
  if (calendar === 'jalali') return dayjs(iso).calendar('jalali').add(n, 'month').startOf('month').calendar('gregory').format('YYYY-MM-DD');
  return dayjs(iso).add(n, 'month').startOf('month').format('YYYY-MM-DD');
}

/** Day of week 0=Sunday … 6=Saturday */
export const weekday = (iso: string) => dayjs(iso).day();

/** Days of the week containing `iso`, starting on Saturday or Monday. */
export function weekOf(iso: string, start: 'sat' | 'mon'): string[] {
  const startDow = start === 'sat' ? 6 : 1;
  const d = dayjs(iso);
  const back = (d.day() - startDow + 7) % 7;
  const first = d.subtract(back, 'day');
  return Array.from({ length: 7 }, (_, i) => first.add(i, 'day').format('YYYY-MM-DD'));
}
