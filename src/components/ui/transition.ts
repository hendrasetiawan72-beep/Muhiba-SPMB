/*
 * TRANSISI ANTAR HALAMAN (UI saja)
 *
 * Memakai View Transitions API bila tersedia: browser mengambil "foto" tampilan lama,
 * kita ganti state, lalu browser melakukan cross-fade ke tampilan baru dengan GPU.
 * Hasilnya mulus tanpa kedipan/loncatan. Bila tidak tersedia (atau pengguna memilih
 * "kurangi gerakan"), perubahan state dilakukan langsung seperti biasa.
 */
import { flushSync } from 'react-dom';

type VTHandle = {
  finished: Promise<void>;
  ready?: Promise<void>;
  updateCallbackDone?: Promise<void>;
};
type VTDocument = Document & { startViewTransition?: (cb: () => void | Promise<void>) => VTHandle };

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const supportsViewTransitions = (): boolean =>
  typeof document !== 'undefined' &&
  typeof (document as VTDocument).startViewTransition === 'function' &&
  !reducedMotion();

let activeTransitions = 0;
/** true selama transisi berjalan -> komponen yang baru muncul tidak perlu memainkan animasi masuk sendiri (agar tidak dobel) */
export const isViewTransitioning = (): boolean => activeTransitions > 0;

/** Scroll ke atas TANPA animasi (html memakai scroll-behavior: smooth, yang akan terlihat sebagai gerakan menyentak) */
export const jumpToTop = () => {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const prev = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);
  root.style.scrollBehavior = prev;
};

export function runViewTransition(update: () => void, opts: { scrollTop?: boolean } = {}): void {
  const finish = () => {
    update();
    if (opts.scrollTop) jumpToTop();
  };

  if (!supportsViewTransitions()) {
    finish();
    return;
  }

  activeTransitions++;
  const done = () => {
    activeTransitions = Math.max(0, activeTransitions - 1);
  };

  try {
    const t = (document as VTDocument).startViewTransition!(() => {
      flushSync(update);
      if (opts.scrollTop) jumpToTop();
    });
    t.ready?.catch(() => undefined);
    t.updateCallbackDone?.catch(() => undefined);
    t.finished.catch(() => undefined).finally(done);
  } catch {
    done();
    finish();
  }
}
