import { useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Download, FolderOpen, RefreshCw, Ruler, Trash2, Upload } from 'lucide-react';
import { useL10n } from '../i18n';
import { flushMirror, latestWeightKg, markBackedUp, reconnectFolder, refreshFolderState, replaceAllData, resetAll, saveWeight, snapshot, updateSettings, useApp } from '../store/app';
import { closePage, openPage, toast } from '../store/ui';
import { dailyGoal, kcalFloor, macroTargets } from '../domain/tdee';
import type { ActivityFactor, Settings } from '../domain/types';
import { Button, Card, Field, IconBtn, NumInput, Page, Segmented, Select, TextInput, Toggle } from '../components/ui';
import { exportZip, importZip, shareOrDownload } from '../storage/files';
import { folderSupported, forgetFolder, getFolder, pickFolder, readFolder } from '../storage/folder';
import { todayIso } from '../utils/dates';
import { uid } from '../utils/id';

const ACTIVITY: ActivityFactor[] = [1.2, 1.375, 1.55, 1.725, 1.9];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h2 className="mb-2 mt-5 px-1 text-sm font-bold text-ink2">{title}</h2>
      <Card>{children}</Card>
    </>
  );
}

export function SettingsPage() {
  const L = useL10n();
  const { t, n } = L;
  const s = useApp((x) => x.settings);
  const folder = useApp((x) => x.folder);
  const folderName = useApp((x) => x.folderName);
  const lastMirrorAt = useApp((x) => x.lastMirrorAt);
  const dayCount = useApp((x) => Object.keys(x.days).length);
  const customCount = useApp((x) => x.customFoods.length);
  const baseCount = useApp((x) => x.baseFoods.length);
  const weights = useApp((x) => x.weights);
  const currentKg = weights.length ? weights[weights.length - 1].kg : undefined;
  const thisYear = new Date().getFullYear();

  /** Typing a weight here records (or corrects) today's weigh-in, which also refreshes the goal. */
  const setCurrentWeight = (kg: number | undefined) => {
    if (kg == null || kg < 20 || kg > 400) return;
    const today = todayIso();
    const existing = weights.find((w) => w.date === today);
    saveWeight({ ...(existing ?? { id: uid(), date: today }), kg: Math.round(kg * 10) / 10 });
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const set = (fn: (s: Settings) => Settings, recalc = false) => {
    updateSettings((x) => {
      const next = fn(x);
      if (recalc && !next.goal.manualKcal) next.goal.dailyKcal = dailyGoal(next, latestWeightKg()).kcal;
      return next;
    });
  };
  const g = dailyGoal(s, latestWeightKg());
  const targets = macroTargets(s);
  const lowKcal = s.goal.dailyKcal < kcalFloor(s.profile.sex);

  const doExport = async () => {
    setBusy(true);
    try {
      const blob = await exportZip(await snapshot());
      await shareOrDownload(blob, `kalori-backup-${todayIso()}.zip`);
      markBackedUp();
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File) => {
    if (!confirm(t('data.confirmImport'))) return;
    setBusy(true);
    try {
      await replaceAllData(await importZip(file));
      toast(t('data.imported'));
    } catch (e) {
      alert(t('data.importFailed') + '\n' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t('settings.title')}>
      <Section title={t('settings.profile')}>
        <Field label={t('settings.name')}>
          <TextInput value={s.userName} onChange={(e) => set((x) => ({ ...x, userName: e.target.value }))} />
        </Field>
        <Field label={t('settings.sex')}>
          <Segmented value={s.profile.sex} onChange={(v) => set((x) => ({ ...x, profile: { ...x.profile, sex: v } }), true)} options={[{ value: 'male', label: t('settings.male') }, { value: 'female', label: t('settings.female') }]} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label={t('settings.birthYear')}>
            <NumInput
              value={s.profile.birthYear}
              onChange={(v) => v && ((v >= 1300 && v <= 1500) || (v >= 1920 && v <= thisYear)) && set((x) => ({ ...x, profile: { ...x.profile, birthYear: Math.round(v) } }), true)}
            />
          </Field>
          <Field label={`${t('settings.height')} (${t('unit.cm')})`}>
            <NumInput value={s.profile.heightCm} onChange={(v) => v && v >= 80 && v <= 250 && set((x) => ({ ...x, profile: { ...x.profile, heightCm: v } }), true)} />
          </Field>
          <Field label={`${t('settings.currentWeight')} (${t('unit.kg')})`}>
            <NumInput value={currentKg} placeholder="—" onChange={setCurrentWeight} />
          </Field>
        </div>
        <p className="mt-1 text-xs text-ink3">{t('settings.currentWeightHint')}</p>
        <Field label={t('settings.activity')}>
          <Select value={s.profile.activity} onChange={(v) => set((x) => ({ ...x, profile: { ...x.profile, activity: v } }), true)} options={ACTIVITY.map((a) => ({ value: a, label: t(`activity.${String(a).replace('.', '_')}`) }))} />
        </Field>
        <p className="mt-1 text-xs text-ink2">{t('settings.tdee', { tdee: n(g.tdee), kg: n(latestWeightKg(), 1) })}</p>
      </Section>

      <Section title={t('settings.goal')}>
        <Segmented
          value={s.goal.type}
          onChange={(v) => set((x) => ({ ...x, goal: { ...x.goal, type: v } }), true)}
          options={[{ value: 'lose', label: t('goal.lose') }, { value: 'maintain', label: t('goal.maintain') }, { value: 'gain', label: t('goal.gain') }]}
        />
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Field label={`${t('settings.targetKg')} (${t('unit.kg')})`}>
            <NumInput value={s.goal.targetKg} onChange={(v) => v && v >= 20 && v <= 400 && set((x) => ({ ...x, goal: { ...x.goal, targetKg: v } }))} />
          </Field>
          <Field label={t('settings.weeklyRate')}>
            <Select
              value={s.goal.weeklyRateKg}
              onChange={(v) => set((x) => ({ ...x, goal: { ...x.goal, weeklyRateKg: v } }), true)}
              options={[0.25, 0.5, 0.75, 1].map((r) => ({ value: r, label: `${n(r, 2)} ${t('unit.kg')} / ${t('settings.week')}` }))}
            />
          </Field>
        </div>
        <Toggle label={t('settings.manualKcal')} checked={s.goal.manualKcal} onChange={(v) => set((x) => ({ ...x, goal: { ...x.goal, manualKcal: v } }), true)} />
        <Field label={t('settings.dailyKcal')} hint={!s.goal.manualKcal ? t('settings.autoKcal') : undefined}>
          <NumInput
            value={s.goal.dailyKcal}
            onChange={(v) => v && v >= 500 && v <= 10000 && set((x) => ({ ...x, goal: { ...x.goal, dailyKcal: Math.round(v), manualKcal: true } }))}
          />
        </Field>
        {lowKcal && <p className="mt-1 rounded-2xl bg-warn/15 p-2 text-xs text-warn">{t('settings.lowKcalWarning', { floor: n(kcalFloor(s.profile.sex)) })}</p>}
      </Section>

      <Section title={t('settings.macros')}>
        <Segmented value={s.macros.mode} onChange={(v) => set((x) => ({ ...x, macros: { ...x.macros, mode: v } }))} options={[{ value: 'percent', label: t('settings.percent') }, { value: 'grams', label: t('settings.grams') }]} />
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(['protein', 'carbs', 'fat'] as const).map((k) => {
            const key = s.macros.mode === 'percent' ? (`${k}Pct` as const) : (`${k}G` as const);
            return (
              <Field key={k} label={`${t(`macro.${k}`)} ${s.macros.mode === 'percent' ? t('unit.pct') : `(${t('unit.g')})`}`}>
                <NumInput value={s.macros[key]} onChange={(v) => v != null && set((x) => ({ ...x, macros: { ...x.macros, [key]: v } }))} />
              </Field>
            );
          })}
        </div>
        {s.macros.mode === 'percent' && (
          <p className={`mt-1 text-xs ${s.macros.proteinPct + s.macros.carbsPct + s.macros.fatPct === 100 ? 'text-ink2' : 'text-bad'}`}>
            {t('settings.macroSum', { sum: n(s.macros.proteinPct + s.macros.carbsPct + s.macros.fatPct), p: n(targets.proteinG), c: n(targets.carbsG), f: n(targets.fatG) })}
          </p>
        )}
      </Section>

      <Section title={t('water.title')}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${t('settings.glassSize')} (${t('unit.ml')})`}>
            <NumInput value={s.water.glassMl} onChange={(v) => v && set((x) => ({ ...x, water: { ...x.water, glassMl: v } }))} />
          </Field>
          <Field label={t('settings.glassGoal')}>
            <NumInput value={s.water.goalGlasses} onChange={(v) => v && set((x) => ({ ...x, water: { ...x.water, goalGlasses: Math.round(v) } }))} />
          </Field>
        </div>
      </Section>

      <Section title={t('exercise.title')}>
        <Toggle label={t('settings.addBack')} checked={s.exercise.addBackToBudget} onChange={(v) => set((x) => ({ ...x, exercise: { ...x.exercise, addBackToBudget: v } }))} />
        <Field label={t('settings.exerciseMode')} hint={t('settings.exerciseModeHint')}>
          <Segmented value={s.exercise.mode} onChange={(v) => set((x) => ({ ...x, exercise: { ...x.exercise, mode: v } }))} options={[{ value: 'net', label: t('exercise.net') }, { value: 'gross', label: t('exercise.gross') }]} />
        </Field>
        <Field label={`${t('settings.weeklyMinutes')} (${t('unit.min')})`}>
          <NumInput value={s.exercise.weeklyMinutesGoal} onChange={(v) => v && set((x) => ({ ...x, exercise: { ...x.exercise, weeklyMinutesGoal: Math.round(v) } }))} />
        </Field>
      </Section>

      <Section title={t('settings.meals')}>
        {s.meals.map((m, i) => (
          <div key={m.id} className="flex items-center gap-2 py-1">
            <TextInput
              className="flex-1"
              value={m.name[L.lang]}
              placeholder={L.name(m.name)}
              onChange={(e) => set((x) => ({ ...x, meals: x.meals.map((y) => (y.id === m.id ? { ...y, name: { ...y.name, [L.lang]: e.target.value } } : y)) }))}
            />
            <IconBtn label="up" disabled={i === 0} onClick={() => set((x) => { const a = [...x.meals]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return { ...x, meals: a }; })}><ArrowUp size={16} /></IconBtn>
            <IconBtn label="down" disabled={i === s.meals.length - 1} onClick={() => set((x) => { const a = [...x.meals]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; return { ...x, meals: a }; })}><ArrowDown size={16} /></IconBtn>
            <Toggle checked={m.visible} onChange={(v) => set((x) => ({ ...x, meals: x.meals.map((y) => (y.id === m.id ? { ...y, visible: v } : y)) }))} />
          </div>
        ))}
      </Section>

      <Section title={t('settings.units')}>
        <p className="mb-2 text-sm text-ink2">{t('settings.unitsHint')}</p>
        <Button variant="secondary" block onClick={() => openPage({ kind: 'calibrate' })}><Ruler size={18} /> {t('calibrate.title')}</Button>
      </Section>

      <Section title={t('settings.appearance')}>
        <Field label={t('settings.language')}>
          <Segmented
            value={s.lang}
            onChange={(v) => set((x) => ({ ...x, lang: v, calendar: v === 'fa' ? 'jalali' : 'gregorian', digits: v === 'fa' ? 'fa' : 'latin', weekStart: v === 'fa' ? 'sat' : 'mon' }))}
            options={[{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }]}
          />
        </Field>
        <Field label={t('settings.theme')}>
          <Segmented value={s.theme} onChange={(v) => set((x) => ({ ...x, theme: v }))} options={[{ value: 'light', label: t('settings.light') }, { value: 'dark', label: t('settings.dark') }]} />
        </Field>
        <Field label={t('settings.calendar')}>
          <Segmented value={s.calendar} onChange={(v) => set((x) => ({ ...x, calendar: v }))} options={[{ value: 'jalali', label: t('settings.jalali') }, { value: 'gregorian', label: t('settings.gregorian') }]} />
        </Field>
        <Field label={t('settings.digits')}>
          <Segmented value={s.digits} onChange={(v) => set((x) => ({ ...x, digits: v }))} options={[{ value: 'fa', label: '۱۲۳' }, { value: 'latin', label: '123' }]} />
        </Field>
        <Field label={t('settings.weekStart')}>
          <Segmented value={s.weekStart} onChange={(v) => set((x) => ({ ...x, weekStart: v }))} options={[{ value: 'sat', label: t('settings.saturday') }, { value: 'mon', label: t('settings.monday') }]} />
        </Field>
        <Field label={t('settings.weighInDay')}>
          <Select value={s.weighInWeekday} onChange={(v) => set((x) => ({ ...x, weighInWeekday: v }))} options={[6, 0, 1, 2, 3, 4, 5].map((d) => ({ value: d, label: t(`weekday.${d}`) }))} />
        </Field>
      </Section>

      <Section title={t('settings.data')}>
        <div className="space-y-2">
          <Button block variant="secondary" disabled={busy} onClick={doExport}><Download size={18} /> {t('data.export')}</Button>
          <Button block variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={18} /> {t('data.import')}</Button>
          <input ref={fileRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) doImport(f); }} />
          <p className="text-xs text-ink3">{s.lastBackupAt ? t('data.lastBackup', { date: L.date(s.lastBackupAt, 'D MMMM YYYY') }) : t('data.neverBackedUp')}</p>
        </div>

        <div className="mt-4 border-t border-ink/10 pt-3">
          <div className="mb-1 font-medium">{t('data.folder')}</div>
          {folder === 'unsupported' ? (
            <p className="text-xs text-ink2">{t('data.folderUnsupported')}</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-ink2">
                {folder === 'connected' && t('data.folderConnected', { name: folderName })}
                {folder === 'needsPermission' && t('data.folderNeedsPermission', { name: folderName })}
                {folder === 'none' && t('data.folderNone')}
                {folder === 'error' && t('data.folderError')}
                {lastMirrorAt && folder === 'connected' && ` • ${t('data.lastSync', { time: L.d(new Date(lastMirrorAt).toLocaleTimeString(L.lang === 'fa' ? 'fa-IR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })) })}`}
              </p>
              <div className="flex flex-wrap gap-2">
                {(folder === 'none' || folder === 'error') && (
                  <Button size="sm" variant="secondary" onClick={async () => { try { if (await pickFolder()) { await refreshFolderState(); await flushMirror(true); toast(t('data.folderSaved')); } } catch { /* cancelled */ } }}>
                    <FolderOpen size={16} /> {t('data.pickFolder')}
                  </Button>
                )}
                {folder === 'needsPermission' && <Button size="sm" variant="accent" onClick={reconnectFolder}><RefreshCw size={16} /> {t('data.reconnect')}</Button>}
                {folder === 'connected' && (
                  <>
                    <Button size="sm" variant="secondary" onClick={async () => { await flushMirror(true); toast(t('data.folderSaved')); }}><RefreshCw size={16} /> {t('data.syncNow')}</Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        const h = await getFolder();
                        if (!h || !confirm(t('data.confirmImport'))) return;
                        try { await replaceAllData(await readFolder(h)); toast(t('data.imported')); } catch (e) { alert(t('data.importFailed') + '\n' + (e as Error).message); }
                      }}
                    >
                      <Upload size={16} /> {t('data.loadFromFolder')}
                    </Button>
                  </>
                )}
                {folder !== 'none' && <Button size="sm" variant="ghost" onClick={async () => { await forgetFolder(); await refreshFolderState(); }}>{t('data.forgetFolder')}</Button>}
              </div>
            </>
          )}
        </div>

        <div className="mt-4 border-t border-ink/10 pt-3">
          <Button
            variant="danger"
            block
            onClick={async () => {
              if (!confirm(t('data.confirmReset')) || !confirm(t('data.confirmReset2'))) return;
              await resetAll();
              closePage();
            }}
          >
            <Trash2 size={18} /> {t('data.reset')}
          </Button>
        </div>
      </Section>

      <p className="mt-6 text-center text-xs text-ink3">
        Kalori v1.0 • {t('settings.stats', { days: n(dayCount), foods: n(customCount), base: n(baseCount) })}
        <br />
        {t('settings.offline')}
        {!folderSupported() && <><br />{t('settings.iosInstall')}</>}
      </p>
    </Page>
  );
}
