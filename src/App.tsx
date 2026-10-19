import React, { useState, useEffect, Suspense } from 'react';
import { User, Student } from './types/database';
import { dbService } from './services/supabase';
import { Navbar } from './components/Navbar';
import { LoadingFallback } from './components/LoadingFallback';
import { LazyErrorBoundary } from './components/LazyErrorBoundary';
import { lazyWithPreload } from './Utils/lazyLoad';

// Route-level code-splitting with preloading capabilities
const LandingPage = lazyWithPreload(() =>
  import('./components/LandingPage').then((m) => ({ default: m.LandingPage }))
);

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
        <Suspense fallback={<LoadingFallback />}>
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
