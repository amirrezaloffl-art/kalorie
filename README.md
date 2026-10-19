# Kalori — کالری

A personal, fully offline calorie, exercise and weight tracker. Bilingual Persian (RTL, Jalali dates) / English (LTR),
with a built-in Iranian food database and realistic household units (کفگیر، کاسه، ملاقه، کف دست، سیخ، عدد…).
It's a Progressive Web App: install it on an iPhone from Safari or as a desktop app from Chrome/Edge. No account, no server, no analytics.

## Features

- **Food logging** in each food's natural units, with fractions (¼ ½ 1½), a live kcal/macro preview, and the meal picked from the time of day.
- **404 built-in foods** (breads, polo, khoresh, ash, kebab, sweets, drinks, fast food…), each with per-food units. Search works in Persian or English and tolerates Arabic ي/ك, missing ZWNJ and typos.
- **Custom foods** entered per 100 g, per 100 ml or per serving (e.g. "1 biscuit = 12 g, 55 kcal"), with a photo, barcode, brand and your own units.
- **Recipe builder** for home-cooked dishes: enter the ingredients, weigh the pot, get per-100 g values plus پرس / کاسه / ملاقه units.
- **Unit calibration**: weigh your own کفگیر once and every log uses your number.
- **Meals**: yesterday / today / tomorrow tabs, swipe to delete, −/+ steppers, copy from yesterday, meal templates.
- **Exercise**: 50 activities with Compendium MET values (power yoga, walking, running, gym, zurkhaneh…), light / moderate / vigorous intensity, net or gross kcal, manual override, distance/steps/heart rate, strength sets × reps × kg, routines, and a weekly plan.
- **Water** in glasses (configurable size and goal); long-press to remove one.
- **Weight**: weekly weigh-ins, EWMA trend line, kg/week slope, projected goal date, and an in-app reminder.
- **Charts** for 7 / 30 / 90 days or a custom range: calories vs goal, intake vs burned, active minutes by category, weekly burn, exercise breakdown, macros, water and weight.
- **Goals**: Mifflin–St Jeor TDEE that updates after each weigh-in, a warning when the target drops below a safe floor, and macro targets in grams or percent.
- **Health score** (0–100) per food with a transparent breakdown.
- **Light and dark themes**; Persian or Latin digits, Jalali or Gregorian calendar, and a Saturday or Monday week start, each set independently.

## Data and storage

| Where | How |
|---|---|
| Live store (all devices) | IndexedDB (Dexie). `navigator.storage.persist()` is requested on start. |
| Desktop folder (Chrome/Edge) | Settings → Data → **Choose folder** (e.g. `D:\Kalori`). Every change is mirrored there as readable JSON. Each file write goes through the browser's atomic swap file. |
| Backup (iPhone and desktop) | Settings → **Export backup** creates a `.zip`. On iPhone it opens the share sheet, so you can save it to Files / iCloud Drive. A reminder appears on Home after 7 days without a backup. |
| Restore / sync | **Import backup** (or "Restore from a backup" on first run). To move data between iPhone and PC, export on one and import on the other. |

Folder / ZIP layout:

```
Kalori/
├── settings.json            ├── weights.json
├── foods.custom.json        ├── exercises.custom.json
├── recipes.json             ├── routines.json
├── units.library.json       ├── logs/2026-10.json   (one file per month)
├── units.overrides.json     └── images/<id>.jpg     (custom food photos)
├── favorites.json
└── templates.json
```

Every file carries `"version": 1`. Settings migrations live in `src/storage/migrations.ts`.
Log entries freeze their nutrient values when you log them, so later edits to a food don't rewrite past days.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 37 unit tests (nutrition, units, TDEE, trend, health score, search, dates, backup round-trip, seed validation)
npm run build      # rebuilds the food seed, type-checks, and writes the PWA to dist/
```

## Put it on the iPhone

1. Push this folder to a GitHub repository. In **Settings → Pages**, set the source to **GitHub Actions**. `.github/workflows/deploy.yml` then tests, builds and publishes on every push to `main`. (Cloudflare Pages also works: build command `npm run build`, output folder `dist`.)
2. On the iPhone, open the Pages URL in **Safari → Share → Add to Home Screen**.
3. Open it once while online; after that it works fully offline. Only the app code is hosted. Your data never leaves the device.

## Editing the food database

The source of truth is `seed/foods-*.csv` (UTF-8; it opens in Excel or LibreOffice). Columns:

```
id,fa,en,aliases,cat,basis,kcal,p,c,f,fiber,sugar,sodium,gi,units,q,density
```

- Values are per 100 g, or per 100 ml when `basis` is `ml`.
- `aliases` are separated with `|`.
- `units` look like `kafgir:70*|boshghab:300`. The `*` marks the default unit, and gram/ml is added automatically.
- `q` is the data quality: `t` = composition table, `e` = estimated from a standard recipe, `m` = measured.

`npm run seed` validates the rows (4P + 4C + 9F within ±25 % of kcal, unit ids that exist, unique ids) and writes `src/data/foods.base.json`.
Unit names live in `src/data/units.base.json`; exercise MET values live in `src/data/exercises.base.json`.

> ⚠️ The seed values come from USDA / standard tables and from recipe-based estimates (flagged "تخمینی / Estimated" in the app).
> Household portion weights (a کفگیر, a ملاقه…) are typical values. Check them against the Iranian Food Composition Table, and calibrate the portions you use most.

## Project structure

```
src/
  app/App.tsx          tabs, page stack, bottom nav, quick-add sheet
  screens/             Home, Meals, AddFood, FoodDetail, CustomFood, RecipeBuilder, Exercise(+Pages),
                       Weight, Charts, Settings, Calibrate, Templates, Onboarding
  components/          UI kit (Card, Sheet, Page, Ring, Stepper, Segmented, Swipeable…), icons, WeekStrip
  domain/              types, nutrition, units, tdee, trend, healthScore, exercise, defaults
  store/               Zustand app store (IndexedDB + folder mirror), UI/navigation store, selectors
  storage/             Dexie DB, JSON/ZIP backup format, File System Access folder, migrations
  search/              Persian normalizer + Fuse.js index with favorite/recent boosts
  i18n/                fa.json, en.json, useL10n() helpers (digits, dates, units)
  utils/               Jalali/Gregorian dates, Persian digits, ids
seed/                  food CSVs → scripts/build-seed.mjs
tests/                 Vitest
```

## Not included yet (see plan §16)

- Camera barcode scanning. Safari has no BarcodeDetector API, so for now barcodes are typed and looked up locally.
- Real push notifications. Reminders show inside the app instead.
- HealthKit (needs a native wrapper).
- Optional AI photo / voice logging.
