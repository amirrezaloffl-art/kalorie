const FA = '۰۱۲۳۴۵۶۷۸۹';

export function toDigits(s: string | number, digits: 'fa' | 'latin'): string {
  const str = String(s);
  if (digits === 'latin') return str.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)));
  return str.replace(/[0-9]/g, (d) => FA[+d]).replace(/\./g, '٫');
}

/** Parses user input that may contain Persian/Arabic digits and separators. */
export function parseNum(s: string): number {
  const latin = s
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,/]/g, '.')
    .replace(/[^\d.\-]/g, '');
  const n = parseFloat(latin);
  return Number.isFinite(n) ? n : NaN;
}

/** Number formatter honoring the digits setting. */
export function fmtNum(n: number, digits: 'fa' | 'latin', maxFrac = 1): string {
  if (!Number.isFinite(n)) return '–';
  const r = Math.round(n * 10 ** maxFrac) / 10 ** maxFrac;
  const s = r.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
  return toDigits(s, digits).replace(/,/g, digits === 'fa' ? '٬' : ',');
}

/** Formats amounts with common fractions (½, ¼, ¾, ⅓…). */
export function fmtAmount(n: number, digits: 'fa' | 'latin'): string {
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  const map: [number, string][] = [[0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1 / 3, '⅓'], [2 / 3, '⅔']];
  const hit = map.find(([v]) => Math.abs(v - frac) < 0.01);
  if (hit && frac > 0.01) return (whole ? toDigits(whole, digits) : '') + hit[1];
  return fmtNum(n, digits, 2);
}
