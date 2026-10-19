import { useState } from 'react';
import { FolderOpen, Upload } from 'lucide-react';
import { useL10n } from '../i18n';
import { flushMirror, refreshFolderState, replaceAllData, saveWeight, updateSettings, useApp } from '../store/app';
import { dailyGoal, kcalFloor } from '../domain/tdee';
import type { ActivityFactor, Settings } from '../domain/types';
import { Button, Card, Field, NumInput, Segmented, Select, TextInput } from '../components/ui';
import { folderSupported, pickFolder } from '../storage/folder';
import { importZip } from '../storage/files';
import { todayIso } from '../utils/dates';
import { uid } from '../utils/id';

const ACTIVITY: ActivityFactor[] = [1.2, 1.375, 1.55, 1.725, 1.9];

/** First run: language, profile, goal → daily kcal. */
export function Onboarding() {
  const L = useL10n();
  const { t, n } = L;
  const settings = useApp((s) => s.settings);
  const [step, setStep] = useState(0);
  const [s, setS] = useState<Settings>(settings);
  const [kg, setKg] = useState<number | undefined>(80);
  const g = dailyGoal(s, kg ?? 70);
  const steps = folderSupported() ? 4 : 3;

  const setLang = (lang: 'fa' | 'en') => {
    const patch = { lang, calendar: lang === 'fa' ? 'jalali' : 'gregorian', digits: lang === 'fa' ? 'fa' : 'latin', weekStart: lang === 'fa' ? 'sat' : 'mon' } as const;
    setS((x) => ({ ...x, ...patch }));
    updateSettings((x) => ({ ...x, ...patch }));
  };

  const finish = () => {
    updateSettings(() => ({ ...s, onboarded: true, goal: { ...s.goal, dailyKcal: g.kcal, manualKcal: false } }));
    if (kg) saveWeight({ id: uid(), date: todayIso(), kg });
  };

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col px-5">
      <div className="py-6 text-center">
        <img src="./icons/icon.svg" alt="" className="mx-auto mb-3 h-16 w-16" />
        <h1 className="text-2xl font-bold">{t('onboarding.welcome')}</h1>
        <p className="mt-1 text-sm text-ink2">{t('onboarding.subtitle')}</p>
      </div>
      <div className="mb-4 flex gap-1">
        {Array.from({ length: steps }, (_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-line'}`} />
        ))}
      </div>

      <div className="flex-1">
        {step === 0 && (
          <Card>
            <Field label="Language / زبان">
              <Segmented value={s.lang} onChange={setLang} options={[{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }]} />
            </Field>
            <Field label={t('settings.name')}>
              <TextInput value={s.userName} onChange={(e) => setS({ ...s, userName: e.target.value })} placeholder={t('onboarding.namePlaceholder')} />
            </Field>
            <Field label={t('settings.sex')}>
              <Segmented value={s.profile.sex} onChange={(v) => setS({ ...s, profile: { ...s.profile, sex: v } })} options={[{ value: 'male', label: t('settings.male') }, { value: 'female', label: t('settings.female') }]} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label={t('settings.birthYear')}>
                <NumInput value={s.profile.birthYear} onChange={(v) => v && setS({ ...s, profile: { ...s.profile, birthYear: v } })} />
              </Field>
              <Field label={`${t('settings.height')} (${t('unit.cm')})`}>
                <NumInput value={s.profile.heightCm} onChange={(v) => v && setS({ ...s, profile: { ...s.profile, heightCm: v } })} />
              </Field>
              <Field label={`${t('weight.kg')} (${t('unit.kg')})`}>
                <NumInput value={kg} onChange={setKg} />
              </Field>
            </div>
            <p className="mt-1 text-xs text-ink3">{t('onboarding.birthYearHint')}</p>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <Field label={t('settings.activity')}>
              <Select value={s.profile.activity} onChange={(v) => setS({ ...s, profile: { ...s.profile, activity: v } })} options={ACTIVITY.map((a) => ({ value: a, label: t(`activity.${String(a).replace('.', '_')}`) }))} />
            </Field>
            <Field label={t('settings.goal')}>
              <Segmented value={s.goal.type} onChange={(v) => setS({ ...s, goal: { ...s.goal, type: v } })} options={[{ value: 'lose', label: t('goal.lose') }, { value: 'maintain', label: t('goal.maintain') }, { value: 'gain', label: t('goal.gain') }]} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${t('settings.targetKg')} (${t('unit.kg')})`}>
                <NumInput value={s.goal.targetKg} onChange={(v) => v && setS({ ...s, goal: { ...s.goal, targetKg: v } })} />
              </Field>
              <Field label={t('settings.weeklyRate')}>
                <Select value={s.goal.weeklyRateKg} onChange={(v) => setS({ ...s, goal: { ...s.goal, weeklyRateKg: v } })} options={[0.25, 0.5, 0.75, 1].map((r) => ({ value: r, label: `${n(r, 2)} ${t('unit.kg')}` }))} />
              </Field>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="text-center">
            <div className="text-sm text-ink2">{t('onboarding.yourGoal')}</div>
            <div className="num my-2 text-5xl font-bold text-accent">{n(g.kcal)}</div>
            <div className="text-sm text-ink2">{t('unit.kcal')} / {t('day.today')}</div>
            <p className="mt-3 text-xs text-ink3">{t('settings.tdee', { tdee: n(g.tdee), kg: n(kg ?? 70, 1) })}</p>
            {g.kcal < kcalFloor(s.profile.sex) && <p className="mt-2 rounded-md bg-warn/15 p-2 text-xs text-warn">{t('settings.lowKcalWarning', { floor: n(kcalFloor(s.profile.sex)) })}</p>}
            <p className="mt-3 text-xs text-ink3">{t('onboarding.editLater')}</p>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <h3 className="mb-1 font-bold">{t('data.folder')}</h3>
            <p className="mb-3 text-sm text-ink2">{t('onboarding.folderIntro')}</p>
            <Button
              block
              variant="secondary"
              onClick={async () => {
                try {
                  if (await pickFolder()) {
                    await refreshFolderState();
                    finish();
                    await flushMirror(true);
                  }
                } catch {
                  /* cancelled */
                }
              }}
            >
              <FolderOpen size={18} /> {t('data.pickFolder')}
            </Button>
          </Card>
        )}
      </div>

      <div className="space-y-2 py-4">
        {step < steps - 1 ? (
          <Button block size="lg" onClick={() => setStep(step + 1)}>{t('common.next')}</Button>
        ) : (
          <Button block size="lg" onClick={finish}>{step === 3 ? t('onboarding.skipFolder') : t('onboarding.start')}</Button>
        )}
        {step > 0 && <Button block variant="ghost" onClick={() => setStep(step - 1)}>{t('common.back')}</Button>}
        {step === 0 && (
          <label className="flex cursor-pointer items-center justify-center gap-2 py-2 text-sm text-accent">
            <Upload size={16} /> {t('onboarding.restore')}
            <input
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const data = await importZip(f);
                  await replaceAllData({ ...data, settings: { ...data.settings, onboarded: true } });
                } catch (err) {
                  alert(t('data.importFailed') + '\n' + (err as Error).message);
                }
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
