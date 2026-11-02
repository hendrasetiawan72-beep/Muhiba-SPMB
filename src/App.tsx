import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { User, Student } from './types/database';
import { dbService } from './services/supabase';
import { Navbar } from './components/Navbar';
import { ViewSkeleton } from './components/ui/Skeletons';
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

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [activeView, setActiveView] = useState<'home' | 'portal' | 'login' | 'student-dashboard' | 'admin-dashboard'>('home');
  const [showChangePassword, setShowChangePassword] = useState(false);

  // ---------------------------------------------------------------------------
  // Riwayat browser (UI saja): tombol/gestur "back" & geser-kembali -> halaman sebelumnya.
  // Tidak mengubah alur autentikasi; dashboard tetap dijaga oleh pengecekan user di bawah.
  // ---------------------------------------------------------------------------
  type View = 'home' | 'portal' | 'login' | 'student-dashboard' | 'admin-dashboard';
  const activeViewRef = useRef<View>(activeView);
  const userRef = useRef<User | null>(null);
  const studentRef = useRef<Student | null>(null);
  const prevViewRef = useRef<View | null>(null);
  const mountedAtRef = useRef(Date.now());
  activeViewRef.current = activeView;
  userRef.current = currentUser;
  studentRef.current = currentStudent;

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
        setCurrentUser(null);
        setCurrentStudent(null);
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
    setCurrentUser(null);
    setCurrentStudent(null);
    setShowChangePassword(false);
    setActiveView('home');
  };

  const handlePasswordChanged = () => {
    setShowChangePassword(false);
    setCurrentUser((u) => (u ? { ...u, must_change_password: false } : u));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <SwipeBackLayer canGoBack={canGoBack} onBack={goBack} />
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
        <Suspense fallback={<ViewSkeleton view={activeView} />}>
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
              <ChangePasswordModal
                forced={!!currentUser.must_change_password}
                nik={currentUser.nik}
                onChanged={handlePasswordChanged}
                onClose={() => setShowChangePassword(false)}
                onLogout={handleLogout}
              />
            )
          )}
        </Suspense>
      </LazyErrorBoundary>
    </div>
  );
}
