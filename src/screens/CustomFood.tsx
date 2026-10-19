import { useState } from 'react';
import { Camera, Plus, Trash2, X } from 'lucide-react';
import { useL10n } from '../i18n';
import { deleteFood, findFood, saveFood, saveImage, saveUnit, useApp } from '../store/app';
import { closePage, replacePage, toast, type Page as PageT } from '../store/ui';
import { perServingToPer100 } from '../domain/nutrition';
import type { CategoryId, Food, FoodUnit, Nutrients } from '../domain/types';
import { Button, Card, Field, IconBtn, NumInput, Page, Segmented, Select, Sheet, TextInput } from '../components/ui';
import { FoodThumb } from '../components/icons';
import { uid } from '../utils/id';

export const CATEGORIES: CategoryId[] = ['bread', 'rice', 'stew', 'soup', 'kebab', 'protein', 'dish', 'breakfast', 'dairy', 'legume', 'vegetable', 'fruit', 'nuts', 'sweets', 'drink', 'fastfood', 'snack', 'condiment', 'grain', 'other'];

type Basis = 'g' | 'ml' | 'serving';
type N = Partial<Record<keyof Omit<Nutrients, 'micros'>, number>>;

export function CustomFood({ page }: { page: Extract<PageT, { kind: 'customFood' }> }) {
  const L = useL10n();
  const { t } = L;
  const units = useApp((s) => s.units);
  const imageUrls = useApp((s) => s.imageUrls);
  const src = page.foodId ? findFood(page.foodId) : page.duplicateOf ? findFood(page.duplicateOf) : undefined;
  const editing = !!page.foodId && src?.source === 'custom';

  const [nameFa, setNameFa] = useState(src ? src.name.fa + (page.duplicateOf ? ` (${t('food.copy')})` : '') : L.lang === 'fa' ? page.name ?? '' : '');
  const [nameEn, setNameEn] = useState(src?.name.en ?? (L.lang === 'en' ? page.name ?? '' : ''));
  const [brand, setBrand] = useState(src?.brand ?? '');
  const [category, setCategory] = useState<CategoryId>(src?.category ?? 'snack');
  const [barcode, setBarcode] = useState(src?.barcode ?? page.barcode ?? '');
  const [imageId, setImageId] = useState(src?.imageId);
  const [basis, setBasis] = useState<Basis>(src?.basis ?? 'g');
  const [serving, setServing] = useState<{ unitId: string; grams?: number }>({ unitId: 'adad', grams: undefined });
  const [nut, setNut] = useState<N>(src ? { ...src.per100 } : {});
  const [density, setDensity] = useState<number | undefined>(src?.densityGPerMl);
  const [foodUnits, setFoodUnits] = useState<FoodUnit[]>(src ? src.units.filter((u) => u.unitId !== 'gram' && u.unitId !== 'ml') : []);
  const [newUnit, setNewUnit] = useState<{ fa: string; en: string } | null>(null);

  const required = ['kcal', 'protein', 'carbs', 'fat'] as const;
  const servingOk = basis !== 'serving' || (serving.grams ?? 0) > 0;
  const valid = (nameFa.trim() || nameEn.trim()) && required.every((k) => nut[k] != null) && servingOk;

  const setN = (k: keyof N) => (v: number | undefined) => setNut((x) => ({ ...x, [k]: v }));

  const save = () => {
    if (!valid) return;
    const raw: Nutrients = { kcal: nut.kcal!, protein: nut.protein!, carbs: nut.carbs!, fat: nut.fat! };
    for (const k of ['fiber', 'sugar', 'sodium', 'satFat'] as const) if (nut[k] != null) raw[k] = nut[k];
    const per100 = basis === 'serving' ? perServingToPer100(raw, serving.grams!) : raw;
    let unitsOut = foodUnits.filter((u) => u.grams > 0);
    if (basis === 'serving' && !unitsOut.some((u) => u.unitId === serving.unitId)) {
      unitsOut = [{ unitId: serving.unitId, grams: serving.grams!, isDefault: true }, ...unitsOut];
    }
    const baseUnit = basis === 'ml' ? 'ml' : 'gram';
    if (!unitsOut.some((u) => u.isDefault) && unitsOut[0]) unitsOut[0] = { ...unitsOut[0], isDefault: true };
    const food: Food = {
      id: editing ? src!.id : `custom:${uid()}`,
      source: 'custom',
      name: { fa: nameFa.trim(), en: nameEn.trim() },
      aliases: src?.aliases,
      brand: brand.trim() || undefined,
      category,
      basis: basis === 'ml' ? 'ml' : 'g',
      per100,
      units: [{ unitId: baseUnit, grams: 1 }, ...unitsOut.filter((u) => u.unitId !== baseUnit)],
      densityGPerMl: density,
      barcode: barcode.trim() || undefined,
      imageId,
      dataQuality: 'measured',
      createdAt: editing ? src!.createdAt : undefined,
    };
    saveFood(food);
    toast(t('custom.saved'));
    if (page.date && !editing) replacePage({ kind: 'food', foodId: food.id, date: page.date, mealId: page.mealId });
    else closePage();
  };

  const unitOptions = units.filter((u) => u.id !== 'gram' && u.id !== 'ml').map((u) => ({ value: u.id, label: L.name(u.name) }));
  const per = basis === 'serving' ? t('custom.perServing') : basis === 'ml' ? t('custom.per100ml') : t('custom.per100g');

  return (
    <Page
      title={editing ? t('custom.editTitle') : t('custom.title')}
      footer={
        <div className="flex gap-2">
          {editing && (
            <Button variant="danger" aria-label={t('common.delete')} onClick={() => { if (confirm(t('custom.confirmDelete'))) { deleteFood(src!.id); closePage(); } }}>
              <Trash2 size={18} />
            </Button>
          )}
          <Button block size="lg" disabled={!valid} onClick={save}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex items-center gap-3">
        <label className="relative cursor-pointer">
          {imageId && imageUrls[imageId] ? (
            <FoodThumb food={{ id: 'x', category, imageId }} size={72} />
          ) : (
            <div className="flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line text-[10px] text-ink3">
              <Camera size={20} /> {t('custom.photo')}
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 opacity-0"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setImageId(await saveImage(f));
            }}
          />
        </label>
        <div className="flex-1">
          <Field label={t('custom.nameFa')}>
            <TextInput dir="rtl" value={nameFa} onChange={(e) => setNameFa(e.target.value)} autoFocus={!src} />
          </Field>
        </div>
      </div>
      <Field label={t('custom.nameEn')}>
        <TextInput dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('custom.brand')}>
          <TextInput value={brand} onChange={(e) => setBrand(e.target.value)} />
        </Field>
        <Field label={t('custom.category')}>
          <Select value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: t(`cat.${c}`) }))} />
        </Field>
      </div>
      <Field label={t('custom.barcode')}>
        <TextInput inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
      </Field>

      <h3 className="mb-2 mt-4 font-bold">{t('custom.nutrition')}</h3>
      <Segmented
        value={basis}
        onChange={setBasis}
        options={[
          { value: 'g', label: t('custom.per100g') },
          { value: 'ml', label: t('custom.per100ml') },
          { value: 'serving', label: t('custom.perServing') },
        ]}
      />
      {basis === 'serving' && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Field label={t('custom.servingUnit')}>
            <Select value={serving.unitId} onChange={(u) => setServing((s) => ({ ...s, unitId: u }))} options={unitOptions} />
          </Field>
          <Field label={t('custom.servingGrams')}>
            <NumInput value={serving.grams} onChange={(g) => setServing((s) => ({ ...s, grams: g }))} placeholder="12" />
          </Field>
        </div>
      )}
      <Card className="mt-3">
        <div className="mb-1 text-xs text-ink2">{per}</div>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label={`${t('unit.kcal')} *`}><NumInput value={nut.kcal} onChange={setN('kcal')} /></Field>
          <Field label={`${t('macro.protein')} (${t('unit.g')}) *`}><NumInput value={nut.protein} onChange={setN('protein')} /></Field>
          <Field label={`${t('macro.carbs')} (${t('unit.g')}) *`}><NumInput value={nut.carbs} onChange={setN('carbs')} /></Field>
          <Field label={`${t('macro.fat')} (${t('unit.g')}) *`}><NumInput value={nut.fat} onChange={setN('fat')} /></Field>
          <Field label={`${t('macro.fiber')} (${t('unit.g')})`}><NumInput value={nut.fiber} onChange={setN('fiber')} /></Field>
          <Field label={`${t('macro.sugar')} (${t('unit.g')})`}><NumInput value={nut.sugar} onChange={setN('sugar')} /></Field>
          <Field label={`${t('macro.sodium')} (${t('unit.mg')})`}><NumInput value={nut.sodium} onChange={setN('sodium')} /></Field>
          <Field label={`${t('macro.satFat')} (${t('unit.g')})`}><NumInput value={nut.satFat} onChange={setN('satFat')} /></Field>
        </div>
      </Card>
      {basis !== 'serving' && (
        <Field label={t('custom.density')} hint={t('custom.densityHint')}>
          <NumInput value={density} onChange={setDensity} placeholder="1.0" />
        </Field>
      )}

      <h3 className="mb-1 mt-4 font-bold">{t('custom.units')}</h3>
      <p className="mb-2 text-xs text-ink2">{t('custom.unitsHint', { basis: basis === 'ml' ? t('unit.ml') : t('unit.g') })}</p>
      <div className="space-y-2">
        {foodUnits.map((u, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1">
              <Select value={u.unitId} onChange={(id) => setFoodUnits((l) => l.map((x, j) => (j === i ? { ...x, unitId: id } : x)))} options={unitOptions} />
            </div>
            <NumInput className="w-24" value={u.grams || undefined} placeholder={basis === 'ml' ? t('unit.ml') : t('unit.g')} onChange={(g) => setFoodUnits((l) => l.map((x, j) => (j === i ? { ...x, grams: g ?? 0 } : x)))} />
            <IconBtn label="remove" onClick={() => setFoodUnits((l) => l.filter((_, j) => j !== i))}>
              <X size={18} />
            </IconBtn>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => setFoodUnits((l) => [...l, { unitId: 'adad', grams: 0 }])}>
          <Plus size={16} /> {t('custom.addUnit')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setNewUnit({ fa: '', en: '' })}>
          {t('custom.newUnitType')}
        </Button>
      </div>

      <Sheet open={!!newUnit} onClose={() => setNewUnit(null)} title={t('custom.newUnitType')}>
        <Field label={t('custom.nameFa')}>
          <TextInput dir="rtl" value={newUnit?.fa ?? ''} onChange={(e) => setNewUnit((u) => ({ ...u!, fa: e.target.value }))} />
        </Field>
        <Field label={t('custom.nameEn')}>
          <TextInput dir="ltr" value={newUnit?.en ?? ''} onChange={(e) => setNewUnit((u) => ({ ...u!, en: e.target.value }))} />
        </Field>
        <Button
          block
          className="my-3"
          disabled={!newUnit?.fa.trim() && !newUnit?.en.trim()}
          onClick={() => {
            const id = `u_${uid().slice(0, 8)}`;
            saveUnit({ id, name: { fa: newUnit!.fa.trim(), en: newUnit!.en.trim() }, kind: 'piece' });
            setFoodUnits((l) => [...l, { unitId: id, grams: 0 }]);
            setNewUnit(null);
          }}
        >
          {t('common.save')}
        </Button>
      </Sheet>
    </Page>
  );
}
