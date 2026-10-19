import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';
import { ChevronLeft, Minus, Plus, X } from 'lucide-react';
import { parseNum } from '../utils/digits';
import { useL10n } from '../i18n';
import { closePage, useUI } from '../store/ui';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------- layout

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx('rounded-lg border border-line bg-surface p-4 shadow-card', onClick && 'cursor-pointer active:scale-[0.99] transition-transform', className)}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between px-1">
      <h2 className="text-[15px] font-bold">{children}</h2>
      {action}
    </div>
  );
}

/** Back arrow that points the right way in RTL and LTR. */
export const BackIcon = ({ size = 22 }: { size?: number }) => <ChevronLeft size={size} className="ltr:block rtl:-scale-x-100" />;
export const ForwardIcon = ({ size = 18, className }: { size?: number; className?: string }) => (
  <ChevronLeft size={size} className={cx('ltr:-scale-x-100', className)} />
);

/** A full-screen page stacked above the tab screens. */
export function Page({ title, children, footer, actions, onBack }: { title: ReactNode; children: ReactNode; footer?: ReactNode; actions?: ReactNode; onBack?: () => void }) {
  return (
    <div className="anim-page fixed inset-0 z-30 flex flex-col bg-bg">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden">
        <header className="pt-safe flex items-center gap-2 px-3 pb-2">
          <IconBtn label="back" onClick={onBack ?? closePage}>
            <BackIcon />
          </IconBtn>
          <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
          {actions}
        </header>
        <main className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6">{children}</main>
        {footer && <footer className="pb-safe border-t border-line bg-surface px-4 pt-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="anim-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="anim-sheet pb-safe relative max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-lg bg-surface px-4 pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold">{title}</h3>
            <IconBtn label="close" onClick={onClose}>
              <X size={20} />
            </IconBtn>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useUI((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="anim-fade pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),16px)] z-50 flex justify-center px-4">
      <div className="rounded-full bg-primary px-4 py-2 text-sm text-onPrimary shadow-card">{toast.text}</div>
    </div>
  );
}

// ---------------------------------------------------------------- controls

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'; size?: 'sm' | 'md' | 'lg'; block?: boolean };

export function Button({ variant = 'primary', size = 'md', block, className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.97] disabled:opacity-40',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-5',
        size === 'lg' && 'h-14 px-6 text-lg',
        variant === 'primary' && 'bg-primary text-onPrimary',
        variant === 'accent' && 'bg-accent text-white',
        variant === 'secondary' && 'border border-line bg-surface text-ink',
        variant === 'ghost' && 'text-ink2 hover:bg-surface2',
        variant === 'danger' && 'bg-bad/10 text-bad',
        block && 'w-full',
        className,
      )}
    />
  );
}

export function IconBtn({ label, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  const { t } = useL10n();
  return (
    <button
      aria-label={t(`a11y.${label}`, label)}
      {...p}
      className={cx('inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition hover:bg-surface2 active:scale-95', className)}
    />
  );
}

export function Segmented<T extends string>({ options, value, onChange, className }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx('flex rounded-full bg-surface2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx('flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition', value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink2')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition',
            value === o.value ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, format, compact }: { value: number; onChange: (v: number) => void; step?: number; min?: number; format?: (v: number) => ReactNode; compact?: boolean }) {
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const btn = cx('flex items-center justify-center rounded-full bg-surface shadow-card active:scale-90', compact ? 'h-7 w-7' : 'h-8 w-8');
  const label = format ? format(value) : value;
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface2 p-1">
      <button aria-label="−" className={btn} onClick={() => onChange(Math.max(min, round(value - step)))}>
        <Minus size={compact ? 14 : 16} />
      </button>
      {label !== '' && <span className={cx('num text-center text-sm font-bold', compact ? 'min-w-[1.75rem]' : 'min-w-[2.5rem]')}>{label}</span>}
      <button aria-label="+" className={btn} onClick={() => onChange(round(value + step))}>
        <Plus size={compact ? 14 : 16} />
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-2">
      {label && <span className="text-sm">{label}</span>}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-line')}
      >
        <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'start-6' : 'start-1')} />
      </button>
    </label>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block py-1.5">
      <span className="mb-1 block text-xs font-medium text-ink2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink3">{hint}</span>}
    </label>
  );
}

const inputCls = 'h-11 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-accent';

export function TextInput(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}

/** Numeric input that accepts Persian/Arabic digits and shows an empty box for undefined. */
export function NumInput({ value, onChange, placeholder, className, autoFocus, step }: { value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string; className?: string; autoFocus?: boolean; step?: string }) {
  const [text, setText] = useState(value == null || Number.isNaN(value) ? '' : String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      if (parseNum(text) !== value) setText(value == null || Number.isNaN(value) ? '' : String(value));
    }
  }, [value, text]);
  return (
    <input
      inputMode="decimal"
      autoFocus={autoFocus}
      step={step}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseNum(e.target.value);
        const v = e.target.value.trim() === '' || Number.isNaN(n) ? undefined : n;
        last.current = v;
        onChange(v);
      }}
      className={cx(inputCls, 'num', className)}
    />
  );
}

export function Select<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const o = options.find((x) => String(x.value) === e.target.value);
        if (o) onChange(o.value);
      }}
      className={cx(inputCls, 'appearance-none')}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------- data display

export function ProgressBar({ value, max, color = 'rgb(var(--accent))', className }: { value: number; max: number; color?: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-accentSoft', className)}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** Circular progress ring. */
export function Ring({ value, max, size = 180, stroke = 14, color = 'rgb(var(--accent))', track = 'rgb(var(--accent-soft))', children }: { value: number; max: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Empty({ text, icon, action }: { text: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line px-4 py-6 text-center text-sm text-ink3">
      {icon}
      <span>{text}</span>
      {action}
    </div>
  );
}

export function Badge({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'good' | 'warn' | 'bad' | 'muted' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'accent' && 'bg-accentSoft text-accent',
        tone === 'good' && 'bg-good/15 text-good',
        tone === 'warn' && 'bg-warn/15 text-warn',
        tone === 'bad' && 'bg-bad/15 text-bad',
        tone === 'muted' && 'bg-surface2 text-ink2',
      )}
    >
      {children}
    </span>
  );
}

export function MacroChips({ p, c, f, fiber }: { p: number; c: number; f: number; fiber?: number }) {
  const { n, t } = useL10n();
  return (
    <div className="flex flex-wrap gap-1.5 text-[11px] text-ink2">
      <span><b className="text-protein">{n(p)}</b> {t('macro.pShort')}</span>
      <span><b className="text-carbs">{n(c)}</b> {t('macro.cShort')}</span>
      <span><b className="text-fat">{n(f)}</b> {t('macro.fShort')}</span>
      {fiber != null && fiber > 0 && <span><b className="text-fiber">{n(fiber)}</b> {t('macro.fiberShort')}</span>}
    </div>
  );
}

export function ListRow({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={cx('flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-start transition hover:bg-surface2 active:bg-surface2', className)}>
      {children}
    </button>
  );
}

/** Swipe toward the reading-end to reveal a delete action. */
export function Swipeable({ children, onDelete, deleteLabel }: { children: ReactNode; onDelete: () => void; deleteLabel: string }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const rtl = document.documentElement.dir === 'rtl';
  const sign = rtl ? 1 : -1; // swipe left in LTR, right in RTL
  const open = Math.abs(dx) > 60;
  return (
    <div className="relative overflow-hidden rounded-md">
      {dx !== 0 && (
        <button onClick={onDelete} className={cx('absolute inset-y-0 flex w-20 items-center justify-center bg-bad text-sm font-medium text-white', rtl ? 'left-0' : 'right-0')}>
          {deleteLabel}
        </button>
      )}
      <div
        className="relative bg-surface transition-transform"
        style={{ transform: `translateX(${dx}px)`, transitionDuration: start.current ? '0ms' : '200ms' }}
        onTouchStart={(e) => (start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchMove={(e) => {
          if (!start.current) return;
          const mx = e.touches[0].clientX - start.current.x;
          const my = e.touches[0].clientY - start.current.y;
          if (Math.abs(my) > Math.abs(mx)) return;
          const v = mx * sign;
          setDx(v > 0 ? Math.min(v, 90) * sign : 0);
        }}
        onTouchEnd={() => {
          start.current = null;
          setDx(open ? 80 * sign : 0);
        }}
      >
        {children}
      </div>
    </div>
  );
}
