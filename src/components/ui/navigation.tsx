/*
 * NAVIGASI KEMBALI — geser ke kanan = halaman sebelumnya.
 *
 * Aplikasi ini memakai state (bukan URL) untuk berpindah halaman, sehingga
 * tombol/gestur "back" bawaan ponsel sebelumnya langsung keluar dari situs.
 * Berkas ini menyambungkan state tampilan ke History API (pushState/popstate)
 * TANPA mengubah logika autentikasi atau data:
 *   - useHistorySync : sinkronkan sepotong state UI dengan riwayat browser.
 *   - SwipeBackLayer : gestur geser ke kanan + indikator panah, memanggil onBack.
 */
import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Sinkronisasi state UI <-> history.state                              */
/* ------------------------------------------------------------------ */
export function useHistorySync<T>(key: string, value: T, apply: (v: T) => void) {
  const serialized = JSON.stringify(value);
  const current = useRef(serialized);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  // Saat mount: tanam nilai awal ke entri saat ini, atau pulihkan bila entri ini punya nilai tersimpan
  // (misalnya pengguna kembali ke dashboard lewat tombol back).
  useEffect(() => {
    const st = (window.history.state as Record<string, unknown> | null) || {};
    if (st[key] === undefined) {
      window.history.replaceState({ ...st, [key]: JSON.parse(serialized) }, '');
    } else if (JSON.stringify(st[key]) !== serialized) {
      current.current = JSON.stringify(st[key]);
      applyRef.current(st[key] as T);
    }

    const onPop = (e: PopStateEvent) => {
      const v = (e.state as Record<string, unknown> | null)?.[key];
      if (v === undefined) return;
      const s = JSON.stringify(v);
      if (s !== current.current) {
        current.current = s;
        applyRef.current(v as T);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Saat state berubah karena aksi pengguna: tambahkan entri riwayat baru.
  useEffect(() => {
    if (serialized === current.current) return; // sudah sinkron (berasal dari popstate)
    current.current = serialized;
    const st = (window.history.state as Record<string, unknown> | null) || {};
    const idx = typeof st.idx === 'number' ? st.idx : 0;
    window.history.pushState({ ...st, [key]: JSON.parse(serialized), idx: idx + 1 }, '');
  }, [serialized, key]);
}

/* ------------------------------------------------------------------ */
/* Gestur geser-kembali                                                */
/* ------------------------------------------------------------------ */
const THRESHOLD = 90; // px
const MAX_PULL = 150;

/** true bila sentuhan dimulai di elemen yang punya perilaku geser sendiri (input, tabel, tab yang bisa discroll) */
function startsInsideLockedArea(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  if (el?.closest('input, textarea, select, [contenteditable="true"], [data-no-swipe]')) return true;
  while (el && el !== document.body) {
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 2) {
      const ox = window.getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}

/** modal/dialog terbuka -> gestur dimatikan agar tidak menutup halaman di belakangnya */
function hasOpenDialog(): boolean {
  return !!document.querySelector('[role="dialog"], [data-swipe-lock]');
}

export const SwipeBackLayer: React.FC<{
  /** dipanggil saat runtime untuk mengetahui apakah ada halaman sebelumnya */
  canGoBack: () => boolean;
  onBack: () => void;
}> = ({ canGoBack, onBack }) => {
  const reduce = useReducedMotion();
  const pull = useMotionValue(0);
  const x = useTransform(pull, [0, MAX_PULL], [-64, 20]);
  const opacity = useTransform(pull, [0, 30, THRESHOLD], [0, 0.55, 1]);
  const scale = useTransform(pull, [0, THRESHOLD], [0.6, 1]);

  const canRef = useRef(canGoBack);
  const backRef = useRef(onBack);
  canRef.current = canGoBack;
  backRef.current = onBack;

  useEffect(() => {
    let mode: 'idle' | 'pending' | 'swiping' = 'idle';
    let sx = 0;
    let sy = 0;
    let st = 0;
    let dx = 0;
    let buzzed = false;

    const reset = () => {
      mode = 'idle';
      buzzed = false;
      animate(pull, 0, reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 });
    };

    const onStart = (e: TouchEvent) => {
      mode = 'idle';
      if (e.touches.length !== 1) return;
      if (!canRef.current() || hasOpenDialog() || startsInsideLockedArea(e.target)) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      st = e.timeStamp;
      dx = 0;
      mode = 'pending';
    };

    const onMove = (e: TouchEvent) => {
      if (mode === 'idle') return;
      const t = e.touches[0];
      dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (mode === 'pending') {
        if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
          mode = 'idle'; // pengguna menggulir vertikal
          return;
        }
        if (dx > 14 && dx > Math.abs(dy) * 1.5) mode = 'swiping';
        else return;
      }
      if (dx <= 0) {
        pull.set(0);
        return;
      }
      // makin jauh makin berat (efek karet)
      const eased = dx < THRESHOLD ? dx : THRESHOLD + (dx - THRESHOLD) * 0.35;
      pull.set(Math.min(eased, MAX_PULL));
      if (!buzzed && dx >= THRESHOLD) {
        buzzed = true;
        try {
          navigator.vibrate?.(8);
        } catch {
          /* perangkat tidak mendukung getar */
        }
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (mode !== 'swiping') {
        mode = 'idle';
        return;
      }
      const dt = Math.max(1, e.timeStamp - st);
      const fast = dx > 55 && dx / dt > 0.45; // kibasan cepat
      if (dx >= THRESHOLD || fast) {
        animate(pull, MAX_PULL, { duration: reduce ? 0 : 0.12, onComplete: reset });
        backRef.current();
      } else {
        reset();
      }
      mode = 'idle';
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', reset, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', reset);
    };
  }, [pull, reduce]);

  return (
    <motion.div
      aria-hidden
      style={{ x, opacity, scale }}
      className="pointer-events-none fixed left-0 top-1/2 z-[90] -mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_18px_30px_-10px_rgba(67,56,202,.75)] md:hidden"
    >
      <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
    </motion.div>
  );
};
