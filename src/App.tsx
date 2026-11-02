import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { User, Student } from './types/database';
import { dbService } from './services/supabase';
import { Navbar } from './components/Navbar';
import { DelayedViewSkeleton } from './components/ui/Skeletons';
import { runViewTransition, supportsViewTransitions } from './components/ui/transition';
import { SwipeBackLayer } from './components/ui/navigation';
import { LazyErrorBoundary } from './components/LazyErrorBoundary';
import { lazyWithPreload } from './Utils/lazyLoad';

import { LandingPage } from './components/LandingPage';

const RegistrationPortal = lazyWithPreload(() =>
  import('./components/RegistrationPortal').then((m) => ({ default: m.RegistrationPortal }))
);

const LoginPage = lazyWithPreload(() =>
  import('./components/LoginPage').then((m) => ({ default: m.LoginPage }))
);

const StudentDashboard = lazyWithPreload(() =>
  import('./components/StudentDashboard').then((m) => ({ default: m.StudentDashboard }))
);

const AdminDashboard = lazyWithPreload(() =>
  import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);

const ChangePasswordModal = lazyWithPreload(() =>
  import('./components/ChangePasswordModal').then((m) => ({ default: m.ChangePasswordModal }))
);

type View = 'home' | 'portal' | 'login' | 'student-dashboard' | 'admin-dashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [activeView, setActiveViewRaw] = useState<View>('home');
  const [navPending, setNavPending] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // ---------------------------------------------------------------------------
  // Riwayat browser (UI saja): tombol/gestur "back" & geser-kembali -> halaman sebelumnya.
  // Tidak mengubah alur autentikasi; dashboard tetap dijaga oleh pengecekan user di bawah.
  // ---------------------------------------------------------------------------
  const activeViewRef = useRef<View>(activeView);
  const userRef = useRef<User | null>(null);
  const studentRef = useRef<Student | null>(null);
  const prevViewRef = useRef<View | null>(null);
  const mountedAtRef = useRef(Date.now());
  activeViewRef.current = activeView;
  userRef.current = currentUser;
  studentRef.current = currentStudent;

  // ---------------------------------------------------------------------------
  // Perpindahan halaman yang mulus (UI saja):
  //  1) chunk halaman tujuan diunduh dulu (halaman lama tetap tampil, tanpa kedipan skeleton),
  //  2) lalu semua perubahan state digabung dalam SATU transisi cross-fade,
  //  3) posisi scroll direset tanpa animasi.
  // Alur data/autentikasi tidak berubah; hanya waktu & cara penggantian tampilan.
  // ---------------------------------------------------------------------------
  const pendingViewRef = useRef<View | null>(null);
  const loadedChunksRef = useRef<Set<View>>(new Set<View>(['home']));

  const preloadView = (v: View): Promise<unknown> | null => {
    if (loadedChunksRef.current.has(v)) return null;
    const p =
      v === 'portal'
        ? RegistrationPortal.preload()
        : v === 'login'
        ? LoginPage.preload()
        : v === 'student-dashboard'
        ? StudentDashboard.preload()
        : v === 'admin-dashboard'
        ? AdminDashboard.preload()
        : null;
    return p ? p.then(() => { loadedChunksRef.current.add(v); }) : null;
  };

  const navigateWith = useCallback((next: View, extra?: () => void) => {
    const base = pendingViewRef.current ?? activeViewRef.current;
    if (next === base) {
      extra?.();
      return;
    }
    pendingViewRef.current = next;
    const apply = () => {
      runViewTransition(
        () => {
          pendingViewRef.current = null;
          extra?.();
          setActiveViewRaw(next);
        },
        { scrollTop: true }
      );
    };
    const loading = preloadView(next);
    if (!loading) {
      apply();
      return;
    }
    // tampilkan bilah progres tipis hanya bila unduhan terasa lama (> 150 ms)
    const timer = window.setTimeout(() => setNavPending(true), 150);
    const guard = new Promise<void>((resolve) => window.setTimeout(resolve, 2500));
    Promise.race([loading, guard])
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(timer);
        setNavPending(false);
        apply();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveView = useCallback(
    (v: View | ((prev: View) => View)) => {
      const base = pendingViewRef.current ?? activeViewRef.current;
      navigateWith(typeof v === 'function' ? v(base) : v);
    },
    [navigateWith]
  );

  useEffect(() => {
    const st = (window.history.state as { view?: View; idx?: number } | null) || {};
    const prev = prevViewRef.current;
    prevViewRef.current = activeView;
    const isDash = (v: View) => v === 'student-dashboard' || v === 'admin-dashboard';

    if (prev === null) {
      // render pertama: tandai entri awal
      if (!st.view) window.history.replaceState({ ...st, view: activeView, idx: st.idx ?? 0 }, '');
      return;
    }
    if (st.view === activeView) return; // entri sudah sesuai (datang dari tombol back/forward)

    const idx = typeof st.idx === 'number' ? st.idx : 0;
    const restoredSession = prev === 'home' && isDash(activeView) && Date.now() - mountedAtRef.current < 4000;
    const afterAuth = (prev === 'login' || prev === 'portal') && isDash(activeView);
    const afterLogout = activeView === 'home' && isDash(prev) && !userRef.current;

    if (afterAuth || restoredSession || afterLogout) {
      // ganti entri (bukan tambah) agar tombol back tidak kembali ke form login / dashboard yang sudah keluar
      window.history.replaceState({ view: activeView, idx }, '');
    } else {
      window.history.pushState({ view: activeView, idx: idx + 1 }, '');
    }
  }, [activeView]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const target = (e.state as { view?: View } | null)?.view;
      if (!target) return;
      let next: View = target;
      if (target === 'student-dashboard' && !(userRef.current && studentRef.current)) next = 'home';
      if (target === 'admin-dashboard' && userRef.current?.role !== 'admin') next = 'home';
      if (next !== target) window.history.replaceState({ ...(e.state as object), view: next }, '');
      setActiveView(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const canGoBack = useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    return idx > 0 || activeViewRef.current !== 'home';
  }, []);

  const goBack = useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) window.history.back();
    else if (activeViewRef.current !== 'home') setActiveView('home');
  }, []);

  // Check persisted Supabase Auth session & listen to auth state changes
  useEffect(() => {
    let isMounted = true;

    // 1. Initial session check on mount
    const restoreSession = async () => {
      try {
        const sessionData = await dbService.getCurrentSessionUser();
        if (isMounted && sessionData) {
          setCurrentUser(sessionData.user);
          if (sessionData.student) {
            StudentDashboard.preload();
            setCurrentStudent(sessionData.student);
            setActiveView('student-dashboard');
          } else if (sessionData.user.role === 'admin') {
            AdminDashboard.preload();
            setCurrentStudent(null);
            setActiveView('admin-dashboard');
          }
        }
      } catch (err) {
        console.warn('Session restore warning:', err);
      }
    };
    restoreSession();

    // 2. Realtime listener for Auth changes (login, logout, token refresh)
    const unsubscribeAuth = dbService.onAuthStateChange((sessionData) => {
      if (!isMounted) return;
      if (sessionData) {
        setCurrentUser(sessionData.user);
        if (sessionData.student) {
          StudentDashboard.preload();
          setCurrentStudent(sessionData.student);
          setActiveView((prev) => (prev === 'login' || prev === 'portal' ? 'student-dashboard' : prev));
        } else if (sessionData.user.role === 'admin') {
          AdminDashboard.preload();
          setCurrentStudent(null);
          setActiveView((prev) => (prev === 'login' || prev === 'portal' ? 'admin-dashboard' : prev));
        }
      } else {
        const clearSession = () => {
          setCurrentUser(null);
          setCurrentStudent(null);
        };
        const v = pendingViewRef.current ?? activeViewRef.current;
        if (v === 'student-dashboard' || v === 'admin-dashboard') navigateWith('home', clearSession);
        else clearSession();
      }
    });

    // 3. Intelligent idle preloading for key guest conversion paths
    const scheduleIdlePreload = () => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(
          () => {
            RegistrationPortal.preload();
            LoginPage.preload();
          },
          { timeout: 2500 }
        );
      } else {
        setTimeout(() => {
          RegistrationPortal.preload();
          LoginPage.preload();
        }, 1500);
      }
    };
    scheduleIdlePreload();

    return () => {
      isMounted = false;
      unsubscribeAuth();
    };
  }, []);

  const handleLoginSuccess = (user: User, student?: Student) => {
    setCurrentUser(user);
    if (student) {
      StudentDashboard.preload();
      setCurrentStudent(student);
      setActiveView('student-dashboard');
    } else if (user.role === 'admin') {
      AdminDashboard.preload();
      setCurrentStudent(null);
      setActiveView('admin-dashboard');
    } else {
      setActiveView('student-dashboard');
    }
  };

  const handleRegisterSuccess = (user: User, student: Student) => {
    setCurrentUser(user);
    setCurrentStudent(student);
    StudentDashboard.preload();
    setActiveView('student-dashboard');
  };

  const handleLogout = async () => {
    await dbService.logout();
    navigateWith('home', () => {
      setCurrentUser(null);
      setCurrentStudent(null);
      setShowChangePassword(false);
    });
  };

  const handlePasswordChanged = () => {
    setShowChangePassword(false);
    setCurrentUser((u) => (u ? { ...u, must_change_password: false } : u));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <SwipeBackLayer canGoBack={canGoBack} onBack={goBack} />
      {navPending && <div className="ui-navprogress" role="progressbar" aria-label="Memuat halaman" />}
      {/* Show Navbar on Home, Portal, and Login */}
      {(activeView === 'home' || activeView === 'portal' || activeView === 'login') && (
        <Navbar
          currentUser={currentUser}
          currentStudent={currentStudent}
          activeView={activeView}
          setActiveView={setActiveView}
          onLogout={handleLogout}
          onPreloadPortal={() => RegistrationPortal.preload()}
          onPreloadLogin={() => LoginPage.preload()}
        />
      )}

      <LazyErrorBoundary>
        <Suspense fallback={<DelayedViewSkeleton view={activeView} />}>
          <div
            key={supportsViewTransitions() ? 'view' : activeView}
            className={`flex flex-1 flex-col ${supportsViewTransitions() ? '' : 'ui-view-in'}`}
          >
          {/* VIEW: HOME / LANDING PAGE */}
          {activeView === 'home' && (
            <LandingPage
              onRegisterClick={() => setActiveView('portal')}
              onLoginClick={() => setActiveView('login')}
              onPreloadRegister={() => RegistrationPortal.preload()}
              onPreloadLogin={() => LoginPage.preload()}
            />
          )}

          {/* VIEW: REGISTRATION PORTAL */}
          {activeView === 'portal' && (
            <RegistrationPortal
              onSuccessRegister={handleRegisterSuccess}
              onNavigateLogin={() => setActiveView('login')}
              onNavigateHome={() => setActiveView('home')}
            />
          )}

          {/* VIEW: LOGIN PAGE */}
          {activeView === 'login' && (
            <LoginPage
              onSuccessLogin={handleLoginSuccess}
              onNavigateRegister={() => setActiveView('portal')}
              onNavigateHome={() => setActiveView('home')}
            />
          )}

          {/* VIEW: STUDENT DASHBOARD */}
          {activeView === 'student-dashboard' && currentUser && currentStudent && (
            <StudentDashboard
              currentUser={currentUser}
              initialStudent={currentStudent}
              onLogout={handleLogout}
              onNavigateHome={() => setActiveView('home')}
              onRequestChangePassword={() => {
                ChangePasswordModal.preload();
                setShowChangePassword(true);
              }}
            />
          )}

          {/* VIEW: ADMIN DASHBOARD */}
          {activeView === 'admin-dashboard' && currentUser && currentUser.role === 'admin' && (
            <AdminDashboard
              currentUser={currentUser}
              onLogout={handleLogout}
              onNavigateHome={() => setActiveView('home')}
            />
          )}

          {/* GANTI PASSWORD (siswa): wajib setelah reset oleh panitia, atau dibuka lewat tombol di bilah sisi */}
          {activeView === 'student-dashboard' && currentUser && currentUser.role === 'student' && (
            (currentUser.must_change_password || showChangePassword) && (
              <Suspense fallback={null}>
                <ChangePasswordModal
                  forced={!!currentUser.must_change_password}
                  nik={currentUser.nik}
                  onChanged={handlePasswordChanged}
                  onClose={() => setShowChangePassword(false)}
                  onLogout={handleLogout}
                />
              </Suspense>
            )
          )}
          </div>
        </Suspense>
      </LazyErrorBoundary>
    </div>
  );
}
