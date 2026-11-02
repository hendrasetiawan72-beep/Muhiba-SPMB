/*
 * SKELETON LAZY LOADING — pengganti spinner saat halaman (lazy chunk) dimuat.
 * Bentuknya meniru tata letak halaman asli supaya transisi terasa mulus.
 * Murni presentasi, tanpa logika.
 */
import React, { useEffect, useState } from 'react';

export type SkeletonView = 'home' | 'portal' | 'login' | 'student-dashboard' | 'admin-dashboard';

const Bar: React.FC<{ className?: string; glass?: boolean }> = ({ className = '', glass }) => (
  <div className={`ui-skel ${glass ? 'ui-skel--glass' : ''} ${className}`} aria-hidden />
);

const HeaderSkeleton: React.FC<{ withMenu?: boolean }> = ({ withMenu }) => (
  <div className="ui-header" aria-hidden>
    <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {withMenu && <Bar glass className="h-10 w-10 !rounded-2xl" />}
        <Bar glass className="h-10 w-10 !rounded-full" />
        <div className="space-y-2">
          <Bar glass className="h-3.5 w-28 !rounded-full" />
          <Bar glass className="hidden h-2.5 w-36 !rounded-full sm:block" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Bar glass className="hidden h-10 w-40 !rounded-2xl md:block" />
        <Bar glass className="h-10 w-10 !rounded-full" />
        <Bar glass className="h-10 w-10 !rounded-2xl" />
      </div>
    </div>
  </div>
);

const HeroSkeleton: React.FC<{ ring?: boolean }> = ({ ring }) => (
  <div className="ui-hero" aria-hidden>
    <span className="ui-hero__orb ui-hero__orb--a" />
    <span className="ui-hero__orb ui-hero__orb--b" />
    <div className="flex items-center justify-between gap-5">
      <div className="min-w-0 flex-1 space-y-3">
        <Bar glass className="h-7 w-44 !rounded-full" />
        <Bar glass className="h-8 w-[85%] max-w-md !rounded-xl" />
        <Bar glass className="h-4 w-[60%] max-w-xs !rounded-full" />
      </div>
      {ring ? <Bar glass className="h-[5.25rem] w-[5.25rem] shrink-0 !rounded-full" /> : <Bar glass className="hidden h-14 w-48 !rounded-3xl md:block" />}
    </div>
  </div>
);

const StatSkeleton: React.FC<{ tone?: string }> = ({ tone = '#c9d3f3' }) => (
  <div className="relative min-h-[10.5rem] overflow-hidden rounded-[1.9rem] p-5" style={{ background: tone }} aria-hidden>
    <div className="flex items-start justify-between">
      <Bar glass className="h-4 w-24 !rounded-full" />
      <Bar glass className="h-11 w-11 !rounded-full" />
    </div>
    <Bar glass className="mt-8 h-10 w-20 !rounded-xl" />
    <Bar glass className="mt-3 h-3.5 w-32 !rounded-full" />
  </div>
);

const PanelSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="ui-panel space-y-4 p-5 sm:p-7" aria-hidden>
    <div className="flex items-center gap-3">
      <span className="ui-panel__bar" />
      <Bar className="h-5 w-48 !rounded-full" />
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Bar key={i} className={`h-[5.5rem] !rounded-3xl ${i === 4 ? 'col-span-2 sm:col-span-1' : ''}`} />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <Bar key={i} className="h-16 !rounded-3xl" />
    ))}
  </div>
);

const Wrap: React.FC<{ children: React.ReactNode; label?: string }> = ({ children, label = 'Memuat halaman...' }) => (
  <div role="status" aria-busy="true" aria-live="polite" className="ui-scope ui-page">
    <span className="sr-only">{label}</span>
    {children}
  </div>
);

/* Login & Pendaftaran */
export const FormSkeleton: React.FC = () => (
  <Wrap>
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      <HeroSkeleton />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="ui-panel space-y-5 p-5 sm:p-8 lg:col-span-7">
          <div className="flex items-center gap-3.5">
            <Bar className="h-12 w-12 !rounded-2xl" />
            <div className="space-y-2">
              <Bar className="h-4 w-48 !rounded-full" />
              <Bar className="h-3 w-32 !rounded-full" />
            </div>
          </div>
          <Bar className="h-14 !rounded-2xl" />
          <Bar className="h-14 !rounded-2xl" />
          <Bar className="h-20 !rounded-2xl" />
          <Bar className="h-14 !rounded-2xl" />
        </div>
        <div className="ui-panel hidden space-y-4 p-7 lg:col-span-5 lg:block">
          <Bar className="h-5 w-44 !rounded-full" />
          <Bar className="h-28 !rounded-3xl" />
          <Bar className="h-28 !rounded-3xl" />
        </div>
      </div>
    </div>
  </Wrap>
);

/* Dashboard admin */
export const AdminSkeleton: React.FC = () => (
  <Wrap>
    <HeaderSkeleton />
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-8">
      <Bar className="h-12 w-72 max-w-full !rounded-[1.2rem]" />
      <HeroSkeleton />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatSkeleton tone="#b7c8fb" />
        <StatSkeleton tone="#fadf9d" />
        <StatSkeleton tone="#b4dac8" />
        <StatSkeleton tone="#f1b4be" />
      </div>
      <PanelSkeleton rows={2} />
    </div>
  </Wrap>
);

/* Dashboard siswa (mobile-first, lengkap dengan navigasi bawah) */
export const StudentSkeleton: React.FC = () => (
  <Wrap>
    <HeaderSkeleton />
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-32 pt-5 sm:px-6 sm:py-8">
      <HeroSkeleton ring />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatSkeleton tone="#b7c8fb" />
        <StatSkeleton tone="#fadf9d" />
        <StatSkeleton tone="#b4dac8" />
        <StatSkeleton tone="#f1b4be" />
      </div>
      <div className="ui-panel space-y-3 p-5" aria-hidden>
        <Bar className="h-5 w-52 !rounded-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Bar key={i} className="h-20 !rounded-3xl" />
          ))}
        </div>
      </div>
    </div>
    <div className="ui-bottomnav md:hidden" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex min-h-[3.5rem] flex-col items-center justify-center gap-1.5">
          <Bar className="h-5 w-5 !rounded-full" />
          <Bar className="h-2.5 w-10 !rounded-full" />
        </div>
      ))}
    </div>
  </Wrap>
);

/* Halaman publik umum */
export const PageSkeleton: React.FC = () => (
  <Wrap>
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <HeroSkeleton />
      <div className="grid grid-cols-2 gap-3">
        <StatSkeleton tone="#b7c8fb" />
        <StatSkeleton tone="#fadf9d" />
      </div>
    </div>
  </Wrap>
);

export const ViewSkeleton: React.FC<{ view: SkeletonView }> = ({ view }) => {
  if (view === 'student-dashboard') return <StudentSkeleton />;
  if (view === 'admin-dashboard') return <AdminSkeleton />;
  if (view === 'login' || view === 'portal') return <FormSkeleton />;
  return <PageSkeleton />;
};

/** Skeleton yang baru tampil setelah jeda singkat: bila chunk cepat tiba, tidak ada kedipan skeleton sama sekali. */
export const DelayedViewSkeleton: React.FC<{ view: SkeletonView; delay?: number }> = ({ view, delay = 140 }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShow(true), delay);
    return () => window.clearTimeout(t);
  }, [delay]);
  if (!show) return null;
  return (
    <div className="ui-fade-in">
      <ViewSkeleton view={view} />
    </div>
  );
};
