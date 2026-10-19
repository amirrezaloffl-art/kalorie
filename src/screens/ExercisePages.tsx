import { useMemo, useState } from 'react';
import { Pencil, Play, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useL10n } from '../i18n';
import {
  deleteCustomExercise, deleteRoutine, findExercise, getDay, latestWeightKg, logRoutine, makeExerciseEntry, recentExerciseIds,
  removeExerciseEntry, saveCustomExercise, saveExerciseEntry, saveRoutine, toggleFavorite, useApp,
} from '../store/app';
import { closePage, closePages, openPage, replacePage, toast, useUI, type Page as PageT } from '../store/ui';
import { useExerciseIndex } from '../store/selectors';
import { availableIntensities, exerciseKcal, metFor, setsVolume } from '../domain/exercise';
import type { Exercise, ExerciseCategoryId, ExerciseRoutine, ExerciseTrack, Intensity, StrengthSet } from '../domain/types';
import { Button, Card, cx, Empty, Field, IconBtn, ListRow, NumInput, Page, Segmented, Select, Sheet, TextInput, Toggle } from '../components/ui';
import { ExerciseThumb } from '../components/icons';
import { uid } from '../utils/id';

const EX_CATS: ExerciseCategoryId[] = ['yoga', 'cardio', 'strength', 'sports', 'outdoor', 'home', 'other'];
const INTENSITIES: Intensity[] = ['light', 'moderate', 'vigorous'];

// ---------------------------------------------------------------- search / pick

export function AddExercise({ page }: { page: Extract<PageT, { kind: 'addExercise' }> }) {
  const L = useL10n();
  const { t } = L;
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'recent' | 'favorites' | 'mine' | 'all'>('all');
  const index = useExerciseIndex();
  const base = useApp((s) => s.baseExercises);
  const custom = useApp((s) => s.customExercises);
  const favorites = useApp((s) => s.favorites.exercises);
  const days = useApp((s) => s.days);
  const recent = useMemo(() => recentExerciseIds(), [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const list: Exercise[] = useMemo(() => {
    if (q.trim()) return index.search(q, { favorites: new Set(favorites), recent });
    if (tab === 'mine') return custom;
    if (tab === 'all') return [...custom, ...base];
    const ids = tab === 'recent' ? recent : favorites;
    return ids.map((id) => findExercise(id)).filter(Boolean) as Exercise[];
  }, [q, tab, index, favorites, recent, custom, base]);

  const grouped = useMemo(() => {
    if (q.trim()) return [{ cat: null as ExerciseCategoryId | null, items: list }];
    return EX_CATS.map((c) => ({ cat: c as ExerciseCategoryId | null, items: list.filter((e) => e.category === c) })).filter((g) => g.items.length);
  }, [list, q]);

  return (
    <Page
      title={t('exercise.addTitle')}
      actions={
        <IconBtn label="newExercise" onClick={() => openPage({ kind: 'customExercise' })}>
          <Plus size={20} />
        </IconBtn>
      }
    >
      <div className="sticky top-0 z-10 -mx-4 px-4 pb-2">
        <div className="relative">
          <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink3" />
          <TextInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('exercise.searchPlaceholder')} className="glass-strong h-12 rounded-full ps-10" />
        </div>
        {!q.trim() && (
          <Segmented
            className="mt-2"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'recent', label: t('addFood.recent') },
              { value: 'favorites', label: t('addFood.favorites') },
              { value: 'mine', label: t('exercise.mine') },
              { value: 'all', label: t('addFood.all') },
            ]}
          />
        )}
      </div>
      {grouped.map((g) => (
        <div key={g.cat ?? 'q'}>
          {g.cat && <div className="mb-1 mt-3 px-2 text-xs font-bold text-ink2">{t(`exCat.${g.cat}`)}</div>}
          {g.items.map((ex) => (
            <ListRow key={ex.id} onClick={() => openPage({ kind: 'exercise', exerciseId: ex.id, date: page.date })}>
              <ExerciseThumb category={ex.category} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {L.name(ex.name)}
                  {favorites.includes(ex.id) && <Star size={12} className="fill-warn text-warn" />}
                </div>
                <div className="text-xs text-ink2">MET {L.n(metFor(ex, ex.defaultIntensity), 1)} • {t(`exCat.${ex.category}`)}</div>
              </div>
            </ListRow>
          ))}
        </div>
      ))}
      {!list.length && <Empty text={q ? t('addFood.noResults') : tab === 'mine' ? t('exercise.noCustom') : t('addFood.noRecent')} />}
      {(q.trim() || tab === 'mine') && (
        <Button variant="secondary" block className="mt-4" onClick={() => openPage({ kind: 'customExercise' })}>
          <Plus size={18} /> {t('exercise.newCustom')}
        </Button>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------- log one session

export function ExerciseDetail({ page }: { page: Extract<PageT, { kind: 'exercise' }> }) {
  const L = useL10n();
  const { t, n } = L;
  useApp((s) => s.customExercises);
  const ex = findExercise(page.exerciseId);
  const mode = useApp((s) => s.settings.exercise.mode);
  const favorites = useApp((s) => s.favorites.exercises);
  const depth = useUI((s) => s.pages.length);
  const existing = page.entryId ? getDay(page.date).exercises.find((e) => e.id === page.entryId) : undefined;

  const [minutes, setMinutes] = useState<number | undefined>(existing?.minutes ?? 30);
  const [intensity, setIntensity] = useState<Intensity>(existing?.intensity ?? ex?.defaultIntensity ?? 'moderate');
  const [distance, setDistance] = useState<number | undefined>(existing?.distanceKm);
  const [steps, setSteps] = useState<number | undefined>(existing?.steps);
  const [hr, setHr] = useState<number | undefined>(existing?.avgHeartRate);
  const [note, setNote] = useState(existing?.note ?? '');
  const [sets, setSets] = useState<StrengthSet[]>(existing?.sets ?? []);
  const [manual, setManual] = useState(!!existing?.kcalManual);
  const [manualKcal, setManualKcal] = useState<number | undefined>(existing?.kcalManual ? existing.kcal : undefined);

  if (!ex) {
    return (
      <Page title={existing ? L.name(existing.exerciseName) : '—'}>
        <p className="text-sm text-ink2">{t('exercise.missing')}</p>
        {existing && <Button variant="danger" className="mt-3" onClick={() => { removeExerciseEntry(page.date, existing.id); closePage(); }}>{t('common.delete')}</Button>}
      </Page>
    );
  }

  const kg = existing?.weightKgUsed ?? latestWeightKg();
  const met = metFor(ex, intensity);
  const auto = exerciseKcal(met, kg, minutes ?? 0, mode);
  const kcal = manual && manualKcal != null ? Math.round(manualKcal) : auto;
  const tracks = new Set<ExerciseTrack>(ex.tracks ?? []);
  if (ex.category === 'strength') tracks.add('sets');
  const intensities = availableIntensities(ex);

  const save = () => {
    if (!minutes) return;
    const entry = {
      ...makeExerciseEntry(ex, minutes, intensity),
      ...(existing ? { id: existing.id, time: existing.time, weightKgUsed: existing.weightKgUsed } : {}),
      met,
      kcal,
      kcalManual: manual && manualKcal != null ? true : undefined,
      distanceKm: distance,
      steps,
      avgHeartRate: hr,
      note: note.trim() || undefined,
      sets: sets.length ? sets : undefined,
    };
    saveExerciseEntry(page.date, entry);
    toast(existing ? t('food.updated') : t('exercise.added'));
    if (existing) closePage();
    else closePages(useUI.getState().pages[depth - 2]?.kind === 'addExercise' ? 2 : 1);
  };

  return (
    <Page
      title={L.name(ex.name)}
      actions={
        <IconBtn label="favorite" onClick={() => toggleFavorite('exercises', ex.id)}>
          <Star size={20} className={cx(favorites.includes(ex.id) && 'fill-warn text-warn')} />
        </IconBtn>
      }
      footer={
        <div className="flex gap-2">
          {existing && <Button variant="danger" aria-label={t('common.delete')} onClick={() => { removeExerciseEntry(page.date, existing.id); closePage(); }}><Trash2 size={18} /></Button>}
          <Button block size="lg" disabled={!minutes} onClick={save}>
            {existing ? t('common.save') : t('common.add')} • <span className="num">{n(kcal)}</span> {t('unit.kcal')}
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <ExerciseThumb category={ex.category} size={56} />
        <div className="text-sm text-ink2">
          {t(`exCat.${ex.category}`)} • MET {n(met, 1)}
          {ex.source === 'custom' && (
            <button className="ms-2 text-accent" onClick={() => openPage({ kind: 'customExercise', exerciseId: ex.id })}><Pencil size={14} className="inline" /> {t('common.edit')}</button>
          )}
        </div>
      </div>

      <Card>
        <Field label={t('exercise.duration')}>
          <div className="flex items-center gap-3">
            <NumInput value={minutes} onChange={setMinutes} className="w-24 text-center text-lg font-bold" />
            <span className="text-sm text-ink2">{t('unit.min')}</span>
          </div>
        </Field>
        <div className="mt-2 flex flex-wrap gap-2">
          {[15, 30, 45, 60, 90].map((m) => (
            <button key={m} onClick={() => setMinutes(m)} className={cx('num rounded-full px-3 py-1 text-sm', minutes === m ? 'glass-tint' : 'glass-thin')}>
              {n(m)}
            </button>
          ))}
        </div>
        <Field label={t('exercise.intensity')}>
          <Segmented value={intensity} onChange={setIntensity} options={(intensities.length ? intensities : INTENSITIES).map((i) => ({ value: i, label: t(`intensity.${i}`) }))} />
        </Field>
      </Card>

      {(tracks.has('distance') || tracks.has('steps') || tracks.has('heartRate')) && (
        <Card className="mt-3 grid grid-cols-2 gap-x-3">
          {tracks.has('distance') && <Field label={`${t('exercise.distance')} (${t('unit.km')})`}><NumInput value={distance} onChange={setDistance} /></Field>}
          {tracks.has('steps') && <Field label={t('exercise.steps')}><NumInput value={steps} onChange={setSteps} /></Field>}
          {tracks.has('heartRate') && <Field label={t('exercise.heartRate')}><NumInput value={hr} onChange={setHr} /></Field>}
        </Card>
      )}

      {tracks.has('sets') && (
        <Card className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold">{t('exercise.sets')}</h3>
            {sets.length > 0 && <span className="num text-xs text-ink2">{t('exercise.volume')}: {n(setsVolume(sets))} {t('unit.kg')}</span>}
          </div>
          {sets.map((s, i) => (
            <div key={i} className="mb-2 flex items-center gap-2">
              <TextInput className="flex-1" value={s.name} placeholder={t('exercise.setName')} onChange={(e) => setSets((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <NumInput className="w-16" value={s.reps} placeholder={t('exercise.reps')} onChange={(v) => setSets((l) => l.map((x, j) => (j === i ? { ...x, reps: v ?? 0 } : x)))} />
              <NumInput className="w-16" value={s.kg} placeholder={t('unit.kg')} onChange={(v) => setSets((l) => l.map((x, j) => (j === i ? { ...x, kg: v } : x)))} />
              <IconBtn label="remove" onClick={() => setSets((l) => l.filter((_, j) => j !== i))}><X size={16} /></IconBtn>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setSets((l) => [...l, { name: l[l.length - 1]?.name ?? '', reps: l[l.length - 1]?.reps ?? 10, kg: l[l.length - 1]?.kg }])}>
            <Plus size={16} /> {t('exercise.addSet')}
          </Button>
        </Card>
      )}

      <Card className="mt-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="num text-3xl font-bold">{n(kcal)}</div>
            <div className="text-xs text-ink2">{t('unit.kcal')} • {t(mode === 'net' ? 'exercise.net' : 'exercise.gross')}</div>
          </div>
          <div className="text-end text-xs text-ink3">{t('exercise.formula', { met: n(met, 1), kg: n(kg, 1) })}</div>
        </div>
        <Toggle label={t('exercise.manual')} checked={manual} onChange={setManual} />
        {manual && <NumInput value={manualKcal} onChange={setManualKcal} placeholder={String(auto)} />}
      </Card>

      <Field label={t('exercise.note')}>
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Page>
  );
}

// ---------------------------------------------------------------- custom exercise

export function CustomExercise({ page }: { page: Extract<PageT, { kind: 'customExercise' }> }) {
  const { t } = useL10n();
  const src = page.exerciseId ? findExercise(page.exerciseId) : undefined;
  const [fa, setFa] = useState(src?.name.fa ?? '');
  const [en, setEn] = useState(src?.name.en ?? '');
  const [cat, setCat] = useState<ExerciseCategoryId>(src?.category ?? 'cardio');
  const [met, setMet] = useState<Partial<Record<Intensity, number>>>(src?.met ?? { light: 3, moderate: 5, vigorous: 7 });
  const [tracks, setTracks] = useState<ExerciseTrack[]>(src?.tracks ?? []);
  const valid = (fa.trim() || en.trim()) && Object.values(met).some((v) => v && v > 0);

  const save = () => {
    const clean = Object.fromEntries(Object.entries(met).filter(([, v]) => v && v > 0)) as Exercise['met'];
    const ex: Exercise = {
      id: src?.id ?? `custom:${uid()}`,
      source: 'custom',
      name: { fa: fa.trim(), en: en.trim() },
      category: cat,
      met: clean,
      defaultIntensity: clean.moderate ? 'moderate' : (Object.keys(clean)[0] as Intensity),
      tracks,
      dataQuality: 'estimated',
    };
    saveCustomExercise(ex);
    toast(t('custom.saved'));
    if (src) closePage();
    else replacePage({ kind: 'exercise', exerciseId: ex.id, date: useUI.getState().date });
  };

  return (
    <Page
      title={src ? t('exercise.editCustom') : t('exercise.newCustom')}
      footer={
        <div className="flex gap-2">
          {src && <Button variant="danger" aria-label={t('common.delete')} onClick={() => { if (confirm(t('custom.confirmDelete'))) { deleteCustomExercise(src.id); closePages(2); } }}><Trash2 size={18} /></Button>}
          <Button block size="lg" disabled={!valid} onClick={save}>{t('common.save')}</Button>
        </div>
      }
    >
      <Field label={t('custom.nameFa')}><TextInput dir="rtl" value={fa} onChange={(e) => setFa(e.target.value)} autoFocus /></Field>
      <Field label={t('custom.nameEn')}><TextInput dir="ltr" value={en} onChange={(e) => setEn(e.target.value)} /></Field>
      <Field label={t('custom.category')}>
        <Select value={cat} onChange={setCat} options={EX_CATS.map((c) => ({ value: c, label: t(`exCat.${c}`) }))} />
      </Field>
      <h3 className="mb-1 mt-4 font-bold">MET</h3>
      <p className="mb-2 text-xs text-ink2">{t('exercise.metHint')}</p>
      <div className="grid grid-cols-3 gap-2">
        {INTENSITIES.map((i) => (
          <Field key={i} label={t(`intensity.${i}`)}>
            <NumInput value={met[i]} onChange={(v) => setMet((m) => ({ ...m, [i]: v }))} />
          </Field>
        ))}
      </div>
      <h3 className="mb-2 mt-4 font-bold">{t('exercise.tracks')}</h3>
      {(['distance', 'steps', 'sets', 'heartRate'] as ExerciseTrack[]).map((k) => (
        <Toggle key={k} label={t(`exercise.track.${k}`)} checked={tracks.includes(k)} onChange={(on) => setTracks((l) => (on ? [...l, k] : l.filter((x) => x !== k)))} />
      ))}
    </Page>
  );
}

// ---------------------------------------------------------------- routines

export function Routines({ page }: { page: Extract<PageT, { kind: 'routines' }> }) {
  const L = useL10n();
  const { t, n } = L;
  const routines = useApp((s) => s.routines);
  const all = [...useApp((s) => s.customExercises), ...useApp((s) => s.baseExercises)];
  const [edit, setEdit] = useState<ExerciseRoutine | null>(null);

  return (
    <Page title={t('exercise.routines')} actions={<IconBtn label="newRoutine" onClick={() => setEdit({ id: uid(), name: { fa: '', en: '' }, items: [] })}><Plus size={20} /></IconBtn>}>
      <p className="mb-3 text-sm text-ink2">{t('exercise.routinesHint')}</p>
      <div className="space-y-2">
        {routines.map((r) => {
          const mins = r.items.reduce((a, i) => a + i.minutes, 0);
          return (
            <Card key={r.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1" onClick={() => setEdit(structuredClone(r))}>
                <div className="font-medium">{L.name(r.name)}</div>
                <div className="truncate text-xs text-ink2">
                  {r.items.map((i) => `${L.name(findExercise(i.exerciseId)?.name)} ${n(i.minutes)}′`).join(' + ')} • {n(mins)} {t('unit.min')}
                </div>
              </div>
              <Button size="sm" variant="accent" onClick={() => { const c = logRoutine(page.date, r); toast(t('exercise.routineLogged', { n: n(c) })); closePage(); }}>
                <Play size={14} /> {t('exercise.log')}
              </Button>
            </Card>
          );
        })}
        {!routines.length && <Empty text={t('exercise.noRoutines')} />}
      </div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={t('exercise.routine')}>
        {edit && (
          <div className="pb-3">
            <Field label={t('custom.name')}>
              <TextInput value={L.lang === 'fa' ? edit.name.fa : edit.name.en} placeholder={t('exercise.routinePlaceholder')} onChange={(e) => setEdit({ ...edit, name: { ...edit.name, [L.lang]: e.target.value } })} />
            </Field>
            {edit.items.map((it, i) => (
              <div key={i} className="mb-2 flex items-center gap-2">
                <div className="flex-1">
                  <Select value={it.exerciseId} onChange={(v) => setEdit({ ...edit, items: edit.items.map((x, j) => (j === i ? { ...x, exerciseId: v } : x)) })} options={all.map((e) => ({ value: e.id, label: L.name(e.name) }))} />
                </div>
                <NumInput className="w-16" value={it.minutes} onChange={(v) => setEdit({ ...edit, items: edit.items.map((x, j) => (j === i ? { ...x, minutes: v ?? 0 } : x)) })} />
                <div className="w-28">
                  <Select value={it.intensity} onChange={(v) => setEdit({ ...edit, items: edit.items.map((x, j) => (j === i ? { ...x, intensity: v } : x)) })} options={INTENSITIES.map((x) => ({ value: x, label: t(`intensity.${x}`) }))} />
                </div>
                <IconBtn label="remove" onClick={() => setEdit({ ...edit, items: edit.items.filter((_, j) => j !== i) })}><X size={16} /></IconBtn>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setEdit({ ...edit, items: [...edit.items, { exerciseId: 'base:power-yoga', minutes: 30, intensity: 'moderate' }] })}>
              <Plus size={16} /> {t('exercise.addToRoutine')}
            </Button>
            <div className="mt-4 flex gap-2">
              {routines.some((r) => r.id === edit.id) && (
                <Button variant="danger" onClick={() => { deleteRoutine(edit.id); setEdit(null); }}><Trash2 size={18} /></Button>
              )}
              <Button block disabled={!edit.items.length || !(edit.name.fa || edit.name.en).trim()} onClick={() => { saveRoutine(edit); setEdit(null); }}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </Page>
  );
}
