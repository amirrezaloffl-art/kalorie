import { useEffect } from 'react';
import { Activity, BarChart3, Droplet, Home as HomeIcon, Plus, Scale, UtensilsCrossed, Utensils } from 'lucide-react';
import i18n, { useL10n } from '../i18n';
import { useApp, setWater, getDay } from '../store/app';
import { openPage, openSheet, setTab, toast, useUI, type Page, type Tab } from '../store/ui';
import { cx, Sheet, Toast } from '../components/ui';
import { Home } from '../screens/Home';
import { Meals } from '../screens/Meals';
import { ExerciseScreen } from '../screens/Exercise';
import { Charts } from '../screens/Charts';
import { AddFood } from '../screens/AddFood';
import { FoodDetail } from '../screens/FoodDetail';
import { CustomFood } from '../screens/CustomFood';
import { RecipeBuilder } from '../screens/RecipeBuilder';
import { AddExercise, ExerciseDetail, CustomExercise, Routines } from '../screens/ExercisePages';
import { WeightPage } from '../screens/Weight';
import { SettingsPage } from '../screens/Settings';
import { Calibrate } from '../screens/Calibrate';
import { Templates } from '../screens/Templates';
import { Onboarding } from '../screens/Onboarding';
import { CyclePage } from '../screens/Cycle';

export function App() {
  const ready = useApp((s) => s.ready);
  const settings = useApp((s) => s.settings);
  const pages = useUI((s) => s.pages);
  const tab = useUI((s) => s.tab);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = settings.lang;
    html.dir = settings.lang === 'fa' ? 'rtl' : 'ltr';
    html.dataset.theme = settings.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#0C0C10' : '#F4F5F8');
    if (i18n.language !== settings.lang) i18n.changeLanguage(settings.lang);
  }, [settings.lang, settings.theme]);

  if (!ready) return <div className="flex h-dvh items-center justify-center text-ink3">…</div>;
  if (!settings.onboarded) return <Onboarding />;

  return (
    <>
      <div className="app-bg fixed inset-0 -z-10" aria-hidden />
      <div className="mx-auto min-h-dvh w-full max-w-xl lg:max-w-6xl">
        <div className={cx(pages.length > 0 && 'hidden lg:block')}>
          {tab === 'home' && <Home />}
          {tab === 'meals' && <Meals />}
          {tab === 'exercise' && <ExerciseScreen />}
          {tab === 'charts' && <Charts />}
        </div>
      </div>
      <BottomNav />
      {pages.map((p, i) => (
        <div key={i} className={cx(i < pages.length - 1 && 'hidden')}>
          <PageView page={p} />
        </div>
      ))}
      <QuickAddSheet />
      <Toast />
    </>
  );
}

function PageView({ page }: { page: Page }) {
  switch (page.kind) {
    case 'addFood': return <AddFood page={page} />;
    case 'food': return <FoodDetail page={page} />;
    case 'customFood': return <CustomFood page={page} />;
    case 'recipe': return <RecipeBuilder page={page} />;
    case 'addExercise': return <AddExercise page={page} />;
    case 'exercise': return <ExerciseDetail page={page} />;
    case 'customExercise': return <CustomExercise page={page} />;
    case 'routines': return <Routines page={page} />;
    case 'weight': return <WeightPage />;
    case 'cycle': return <CyclePage />;
    case 'settings': return <SettingsPage />;
    case 'calibrate': return <Calibrate page={page} />;
    case 'templates': return <Templates page={page} />;
  }
}

function BottomNav() {
  const { t } = useL10n();
  const tab = useUI((s) => s.tab);
  const pages = useUI((s) => s.pages);
  if (pages.length) return null;
  const item = (id: Tab, Icon: typeof HomeIcon, label: string) => (
    <button
      onClick={() => {
        setTab(id);
        window.scrollTo({ top: 0 });
      }}
      className={cx('flex flex-1 flex-col items-center gap-0.5 rounded-full border py-1.5 text-[10px] font-medium transition', tab === id ? 'glass-pill text-accent' : 'border-transparent text-ink2')}
    >
      <Icon size={22} strokeWidth={tab === id ? 2.2 : 1.7} />
      {label}
    </button>
  );
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="glass-strong pointer-events-auto mx-auto flex max-w-md items-center gap-1 rounded-full p-1.5">
        {item('home', HomeIcon, t('nav.home'))}
        {item('meals', UtensilsCrossed, t('nav.meals'))}
        <div className="flex flex-1 justify-center">
          <button
            aria-label={t('nav.add')}
            onClick={() => openSheet('quickAdd')}
            className="glass-tint flex h-12 w-12 items-center justify-center rounded-full transition active:scale-95"
          >
            <Plus size={28} />
          </button>
        </div>
        {item('exercise', Activity, t('nav.exercise'))}
        {item('charts', BarChart3, t('nav.charts'))}
      </div>
    </nav>
  );
}

function QuickAddSheet() {
  const { t, n } = useL10n();
  const sheet = useUI((s) => s.sheet);
  const date = useUI((s) => s.date);
  const close = () => openSheet(null);
  const items = [
    { icon: Utensils, label: t('quick.food'), color: 'rgb(var(--accent))', go: () => openPage({ kind: 'addFood', date }) },
    { icon: Activity, label: t('quick.exercise'), color: 'rgb(var(--protein))', go: () => openPage({ kind: 'addExercise', date }) },
    {
      icon: Droplet,
      label: t('quick.water'),
      color: 'rgb(var(--water))',
      go: () => {
        const g = getDay(date).waterGlasses + 1;
        setWater(date, g);
        close();
        toast(t('water.added', { n: n(g) }));
      },
    },
    { icon: Scale, label: t('quick.weight'), color: 'rgb(var(--fat))', go: () => openPage({ kind: 'weight' }) },
  ];
  return (
    <Sheet open={sheet === 'quickAdd'} onClose={close} title={t('quick.title')}>
      <div className="grid grid-cols-2 gap-3 pb-2">
        {items.map((it) => (
          <button key={it.label} onClick={it.go} className="glass flex flex-col items-start gap-3 rounded-[26px] p-4 text-start active:scale-[0.98]">
            <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: it.color, color: 'white' }}>
              <it.icon size={20} />
            </span>
            <span className="font-medium">{it.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
