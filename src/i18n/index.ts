import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import fa from './fa.json';
import en from './en.json';
import { useApp } from '../store/app';
import type { LocalizedText } from '../domain/types';
import { fmtAmount, fmtNum, toDigits } from '../utils/digits';
import { fmtDate } from '../utils/dates';

i18n.use(initReactI18next).init({
  resources: { fa: { translation: fa }, en: { translation: en } },
  lng: 'fa',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;

/** Localization helpers bound to the current settings. */
export function useL10n() {
  const { t } = useTranslation();
  const lang = useApp((s) => s.settings.lang);
  const digits = useApp((s) => s.settings.digits);
  const calendar = useApp((s) => s.settings.calendar);
  const units = useApp((s) => s.units);
  const other = lang === 'fa' ? 'en' : 'fa';
  const name = (lt?: LocalizedText) => (lt ? lt[lang] || lt[other] : '');
  return {
    t,
    lang,
    digits,
    dir: lang === 'fa' ? 'rtl' : 'ltr',
    name,
    n: (v: number, frac = 0) => fmtNum(v, digits, frac),
    amt: (v: number) => fmtAmount(v, digits),
    /** Signed number, isolated left-to-right so the sign stays in front in RTL text. */
    signed: (v: number, frac = 1) => `⁦${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtNum(Math.abs(v), digits, frac)}⁩`,
    d: (s: string | number) => toDigits(s, digits),
    date: (iso: string, pattern: string) => fmtDate(iso, pattern, { calendar, lang, digits }),
    unit: (unitId: string) => name(units.find((u) => u.id === unitId)?.name) || unitId,
  };
}

export type L10n = ReturnType<typeof useL10n>;
