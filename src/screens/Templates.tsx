import { Trash2 } from 'lucide-react';
import { useL10n } from '../i18n';
import { applyTemplate, deleteTemplate, findFood, useApp } from '../store/app';
import { closePage, toast, type Page as PageT } from '../store/ui';
import { entryNutrients, sumNutrients } from '../domain/nutrition';
import { unitGrams } from '../domain/units';
import { Button, Card, Empty, IconBtn, Page } from '../components/ui';

export function Templates({ page }: { page: Extract<PageT, { kind: 'templates' }> }) {
  const L = useL10n();
  const { t, n } = L;
  const templates = useApp((s) => s.templates);
  const overrides = useApp((s) => s.overrides);
  const meal = useApp((s) => s.settings.meals.find((m) => m.id === page.mealId));

  return (
    <Page title={t('meals.templates')}>
      <p className="mb-3 text-sm text-ink2">{t('meals.templatesHint', { meal: L.name(meal?.name) })}</p>
      <div className="space-y-2">
        {templates.map((tpl) => {
          const kcal = sumNutrients(
            tpl.items.flatMap((it) => {
              const f = findFood(it.foodId);
              return f ? [entryNutrients(f, unitGrams(f, it.unitId, overrides), it.amount)] : [];
            }),
          ).kcal;
          return (
            <Card key={tpl.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{tpl.name}</div>
                <div className="truncate text-xs text-ink2">
                  {tpl.items.map((it) => L.name(findFood(it.foodId)?.name)).filter(Boolean).join('، ')} • {n(kcal)} {t('unit.kcal')}
                </div>
              </div>
              <IconBtn label="delete" onClick={() => confirm(t('meals.confirmDeleteTemplate')) && deleteTemplate(tpl.id)}>
                <Trash2 size={16} />
              </IconBtn>
              <Button size="sm" variant="accent" onClick={() => { const c = applyTemplate(page.date, page.mealId, tpl); toast(t('meals.copied', { n: n(c) })); closePage(); }}>
                {t('common.add')}
              </Button>
            </Card>
          );
        })}
        {!templates.length && <Empty text={t('meals.noTemplates')} />}
      </div>
    </Page>
  );
}
