// Builds src/data/foods.base.json from seed/foods-*.csv (editable in Excel / LibreOffice).
//
// Columns: id,fa,en,aliases,cat,basis,kcal,p,c,f,fiber,sugar,sodium,gi,units,q,density
//   aliases: "a|b|c"          units: "kafgir:70*|boshghab:300" (* marks the default unit)
//   basis:   g | ml           q: t = table, e = estimated (recipe-based), m = measured
// Values are per 100 g (or per 100 ml when basis = ml). The base unit (gram/ml) is added automatically.
//
// Validation: 4P + 4C + 9F must be within ±25 % of kcal (warn above ±15 %), using both the plain
// and the fiber-aware (fiber = 2 kcal/g) formula and keeping the better fit.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));

const units = JSON.parse(await readFile(path('src/data/units.base.json'), 'utf8')).units.map((u) => u.id);
const CATEGORIES = ['bread', 'rice', 'stew', 'soup', 'kebab', 'dish', 'breakfast', 'dairy', 'legume', 'vegetable', 'fruit', 'nuts', 'sweets', 'drink', 'fastfood', 'snack', 'condiment', 'protein', 'grain', 'other'];
const QUALITY = { t: 'table', e: 'estimated', m: 'measured' };

const normalize = (s) =>
  s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ً-ٰٟ]/g, '').replace(/\s+/g, ' ').trim();

const num = (s) => (s === '' || s == null ? undefined : Number(s));

const errors = [];
const warnings = [];
const foods = [];
const seen = new Set();

const files = (await readdir(path('seed'))).filter((f) => /^foods-.*\.csv$/.test(f)).sort();
for (const file of files) {
  const text = (await readFile(path(`seed/${file}`), 'utf8')).replace(/^﻿/, '');
  const [header, ...lines] = text.split(/\r?\n/).filter((l) => l.trim());
  const cols = header.split(',');
  lines.forEach((line, i) => {
    const where = `${file}:${i + 2}`;
    const cells = line.split(',');
    if (cells.length !== cols.length) {
      errors.push(`${where}: expected ${cols.length} columns, got ${cells.length}`);
      return;
    }
    const r = Object.fromEntries(cols.map((c, j) => [c, cells[j].trim()]));
    const id = `base:${r.id}`;
    if (seen.has(id)) errors.push(`${where}: duplicate id ${r.id}`);
    seen.add(id);
    if (!CATEGORIES.includes(r.cat)) errors.push(`${where}: unknown category ${r.cat}`);
    if (!['g', 'ml'].includes(r.basis)) errors.push(`${where}: basis must be g or ml`);
    if (!QUALITY[r.q]) errors.push(`${where}: unknown quality ${r.q}`);

    const per100 = { kcal: num(r.kcal), protein: num(r.p), carbs: num(r.c), fat: num(r.f) };
    for (const [k, v] of Object.entries(per100)) if (v == null || Number.isNaN(v)) errors.push(`${where}: missing ${k}`);
    for (const [k, col] of [['fiber', 'fiber'], ['sugar', 'sugar'], ['sodium', 'sodium']]) {
      const v = num(r[col]);
      if (v != null) per100[k] = v;
    }

    const plain = 4 * per100.protein + 4 * per100.carbs + 9 * per100.fat;
    const fib = per100.fiber ?? 0;
    const fiberAware = plain - 2 * fib;
    if (per100.kcal >= 25 || plain >= 30) {
      const err = Math.min(Math.abs(plain - per100.kcal), Math.abs(fiberAware - per100.kcal)) / Math.max(per100.kcal, 1);
      const msg = `${where}: ${r.id} kcal ${per100.kcal} vs macros ${Math.round(plain)} (${Math.round(err * 100)}%)`;
      if (err > 0.25) errors.push(msg);
      else if (err > 0.15) warnings.push(msg);
    }

    const foodUnits = [];
    for (const part of r.units.split('|').filter(Boolean)) {
      const m = part.match(/^([A-Za-z]+):([\d.]+)(\*)?$/);
      if (!m) {
        errors.push(`${where}: bad unit "${part}"`);
        continue;
      }
      if (!units.includes(m[1])) errors.push(`${where}: unknown unit ${m[1]}`);
      foodUnits.push({ unitId: m[1], grams: Number(m[2]), ...(m[3] ? { isDefault: true } : {}) });
    }
    if (!foodUnits.length) errors.push(`${where}: needs at least one household/piece unit`);
    const baseUnit = r.basis === 'ml' ? 'ml' : 'gram';
    if (!foodUnits.some((u) => u.unitId === baseUnit)) foodUnits.unshift({ unitId: baseUnit, grams: 1 });
    if (!foodUnits.some((u) => u.isDefault)) foodUnits.find((u) => u.unitId !== baseUnit) && (foodUnits.find((u) => u.unitId !== baseUnit).isDefault = true);

    const food = {
      id,
      source: 'base',
      name: { fa: normalize(r.fa), en: r.en },
      category: r.cat,
      basis: r.basis,
      per100,
      units: foodUnits,
      dataQuality: QUALITY[r.q],
    };
    if (r.aliases) food.aliases = r.aliases.split('|').map(normalize).filter(Boolean);
    if (num(r.gi) != null) food.glycemicIndex = num(r.gi);
    if (num(r.density) != null) food.densityGPerMl = num(r.density);
    foods.push(food);
  });
}

for (const w of warnings) console.warn('warn ', w);
if (errors.length) {
  for (const e of errors) console.error('error', e);
  console.error(`\n${errors.length} error(s); foods.base.json not written.`);
  process.exit(1);
}

await writeFile(path('src/data/foods.base.json'), JSON.stringify({ version: 1, generated: new Date().toISOString().slice(0, 10), foods }) + '\n');
console.log(`foods.base.json: ${foods.length} foods from ${files.length} files (${warnings.length} warnings)`);
