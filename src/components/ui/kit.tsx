/*
 * UI KIT — komponen presentasi bersama (tanpa logika bisnis).
 * Dipakai oleh LoginPage, RegistrationPortal, AdminDashboard, StudentDashboard.
 * Semua data & handler tetap dikirim dari komponen induk lewat props.
 */
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, animate, useReducedMotion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { isViewTransitioning, supportsViewTransitions } from './transition';

export const LOGO_URL =
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgzWdtCjCcX2chJuhLX_26N5MmkVK-1SkyO7kgXznQQJPQa6_TB_EJzD1WWpztg7yX9RBRE7rGn0t2Z3FdG06mwwT6pQix8t6vnlcOBm_EgGl9z0jeJemJkppP0KIIjkXGksQvaCLh2dz-gOF6a2H213VQBL6Am8Elhmd76OOnphogk-EoTTbkYbg0TQJhv/s512/34690.png';

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const nf = new Intl.NumberFormat('id-ID');

/* ------------------------------------------------------------------ */
/* Angka yang menghitung naik saat muncul / berubah                    */
/* ------------------------------------------------------------------ */
export const CountUp: React.FC<{ value: number; duration?: number; className?: string }> = ({
  value,
  duration = 0.9,
  className,
}) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const shown = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const target = Number.isFinite(value) ? value : 0;
    if (reduce) {
      shown.current = target;
      node.textContent = nf.format(target);
      return;
    }
    const controls = animate(shown.current, target, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => {
        shown.current = v;
        node.textContent = nf.format(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {nf.format(Math.round(shown.current))}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* Varian stagger: satu rangkaian masuk saat halaman dibuka            */
/* ------------------------------------------------------------------ */
export const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};
export const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

/* Pembungkus stagger: anak-anak (StatCard, StatusTile, dst.) masuk berurutan */
export const Stagger: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={listVariants}
      initial={reduce || isViewTransitioning() ? false : 'hidden'}
      animate="show"
    >
      {children}
    </motion.div>
  );
};

/* Transisi halus saat berpindah menu/tab.
 * Browser modern: cross-fade ditangani View Transitions API (lihat transition.ts), komponen ini pasif.
 * Browser lama: fade-in singkat (hanya opacity, agar elemen fixed di dalamnya tidak ikut bergeser). */
export const ViewTransition: React.FC<{ viewKey: string; className?: string; children: React.ReactNode }> = ({
  viewKey,
  className,
  children,
}) => {
  const reduce = useReducedMotion();
  if (supportsViewTransitions()) return <div className={className}>{children}</div>;
  return (
    <motion.div
      key={viewKey}
      className={className}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* Hero ungu-indigo dengan orb yang bergerak pelan                     */
/* ------------------------------------------------------------------ */
export const Hero: React.FC<{
  chip?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}> = ({ chip, title, subtitle, actions, children, className = '' }) => {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce || isViewTransitioning() ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
      className={`ui-hero ${className}`}
    >
      <span className="ui-hero__orb ui-hero__orb--a" aria-hidden />
      <span className="ui-hero__orb ui-hero__orb--b" aria-hidden />
      <span className="ui-hero__dots" aria-hidden />

      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="min-w-0 space-y-3">
          {chip && (
            <span className="ui-chip">
              <span className="ui-dot" />
              {chip}
            </span>
          )}
          <h1 className="text-[1.65rem] leading-[1.15] font-extrabold tracking-tight sm:text-4xl md:text-[2.5rem]">
            {title}
          </h1>
          {subtitle && <p className="text-sm leading-relaxed text-indigo-100 sm:text-base">{subtitle}</p>}
          {children}
        </div>
        {actions && <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">{actions}</div>}
      </div>
    </motion.section>
  );
};

/* ------------------------------------------------------------------ */
/* Kartu statistik berwarna                                            */
/* ------------------------------------------------------------------ */
export type StatTone = 'blue' | 'amber' | 'green' | 'rose' | 'violet' | 'teal';

export const StatCard: React.FC<{
  tone: StatTone;
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  caption?: React.ReactNode;
  icon: LucideIcon;
  ghost?: LucideIcon;
  action?: { label: string; onClick: () => void };
  onClick?: () => void;
  locked?: boolean;
  ariaLabel?: string;
  /** indeks untuk jeda animasi float ikon latar */
  index?: number;
  className?: string;
}> = ({ tone, label, value, unit, caption, icon: Icon, ghost: Ghost, action, onClick, locked, ariaLabel, index = 0, className = '' }) => {
  const reduce = useReducedMotion();
  const interactive = !!onClick && !locked;
  const GhostIcon = Ghost || Icon;

  const handleKey = (e: React.KeyboardEvent) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <motion.div
      variants={itemVariants}
      whileHover={reduce || !interactive ? undefined : { y: -5 }}
      whileTap={reduce || !onClick ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      aria-disabled={onClick && locked ? true : undefined}
      onClick={onClick}
      onKeyDown={onClick ? handleKey : undefined}
      data-tone={tone}
      data-interactive={interactive}
      data-locked={locked ? 'true' : 'false'}
      className={`ui-stat select-none ${className} ${interactive ? 'cursor-pointer' : onClick ? 'cursor-not-allowed' : ''} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="pt-1 text-[0.9rem] font-medium leading-tight opacity-95">{label}</span>
        <span className="ui-stat__icon">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[2.5rem] font-extrabold leading-none tracking-tight sm:text-5xl">{value}</span>
          {unit && <span className="text-sm font-medium opacity-90">{unit}</span>}
        </div>
        {caption && <p className="text-[0.8125rem] leading-snug opacity-90">{caption}</p>}
        {action && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
            className="ui-stat__pill"
          >
            <span>{action.label}</span>
            <span aria-hidden>→</span>
          </button>
        )}
      </div>

      <GhostIcon
        className="ui-stat__ghost"
        strokeWidth={1.5}
        aria-hidden
        style={{ animationDelay: `${index * -1.3}s` }}
      />
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* Ubin status dengan garis bawah tebal                                */
/* ------------------------------------------------------------------ */
export type TileTone = 'blue' | 'amber' | 'violet' | 'cyan' | 'green' | 'rose' | 'slate';

export const StatusTile: React.FC<{
  tone: TileTone;
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}> = ({ tone, label, value, className = '' }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={itemVariants}
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      data-tone={tone === 'blue' ? undefined : tone}
      className={`ui-tile ${className}`}
    >
      <div className="text-[0.8125rem] font-medium leading-tight">{label}</div>
      <div className="mt-1 text-3xl font-extrabold leading-none tracking-tight">{value}</div>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* Judul panel: bar vertikal + judul + (opsional) chip Live            */
/* ------------------------------------------------------------------ */
export const PanelTitle: React.FC<{
  title: React.ReactNode;
  live?: boolean;
  right?: React.ReactNode;
}> = ({ title, live, right }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <span className="ui-panel__bar" aria-hidden />
      <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{title}</h2>
      {live && (
        <span className="ui-live">
          <span className="ui-dot" />
          Live
        </span>
      )}
    </div>
    {right}
  </div>
);

/* ------------------------------------------------------------------ */
/* Segmented tabs dengan pil yang meluncur (layoutId)                  */
/* ------------------------------------------------------------------ */
export const SegTabs: React.FC<{
  id: string;
  items: { key: string; label: React.ReactNode; icon?: LucideIcon; disabled?: boolean }[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
  ariaLabel?: string;
}> = ({ id, items, active, onChange, className = '', ariaLabel }) => (
  <div role="tablist" aria-label={ariaLabel} className={`ui-seg ${className}`}>
    {items.map((it) => {
      const selected = it.key === active;
      const Icon = it.icon;
      return (
        <button
          key={it.key}
          type="button"
          role="tab"
          aria-selected={selected}
          onClick={() => onChange(it.key)}
          className={`ui-seg__btn ${it.disabled ? 'opacity-60' : ''}`}
        >
          {selected && (
            <motion.span
              layoutId={`seg-${id}`}
              className="ui-seg__pill"
              transition={{ type: 'spring', stiffness: 460, damping: 36 }}
            />
          )}
          {Icon && <Icon className="h-4 w-4" />}
          <span>{it.label}</span>
        </button>
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ */
/* Cincin progres animasi                                              */
/* ------------------------------------------------------------------ */
export const ProgressRing: React.FC<{ percent: number; size?: number; stroke?: number; label?: string }> = ({
  percent,
  size = 84,
  stroke = 9,
  label,
}) => {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = size / 2;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label || `${p}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgb(255 255 255 / .22)" strokeWidth={stroke} />
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: p / 100 }}
          transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.25 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-lg font-extrabold text-white">
        <CountUp value={p} />
        <span className="text-xs font-bold opacity-80">%</span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Navigasi bawah ponsel dengan pil yang meluncur                      */
/* ------------------------------------------------------------------ */
export const BottomNav: React.FC<{
  label: string;
  items: { key: string; label: string; icon: LucideIcon; onClick: () => void; active: boolean; dot?: boolean }[];
}> = ({ label, items }) => (
  <nav
    aria-label={label}
    className="ui-bottomnav md:hidden"
    style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
  >
    {items.map((it) => {
      const Icon = it.icon;
      return (
        <motion.button
          key={it.key}
          type="button"
          onClick={it.onClick}
          aria-current={it.active ? 'page' : undefined}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          className="ui-bottomnav__item"
        >
          {it.active && (
            <motion.span
              layoutId="bottomnav-pill"
              className="ui-bottomnav__pill"
              transition={{ type: 'spring', stiffness: 460, damping: 34 }}
            />
          )}
          <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={it.active ? 2.4 : 2} />
          <span>{it.label}</span>
          {it.dot && !it.active && (
            <span className="absolute right-[28%] top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
          )}
        </motion.button>
      );
    })}
  </nav>
);

/* ------------------------------------------------------------------ */
/* Bottom sheet (tarik ke bawah untuk menutup)                         */
/* ------------------------------------------------------------------ */
export const Sheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-white px-5 pt-3 shadow-2xl"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-300" aria-hidden />
            <h2 className="mb-3 text-base font-bold text-slate-900">{title}</h2>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
