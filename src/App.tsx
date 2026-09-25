import React, { useState, useEffect } from 'react';
import { User, Student } from './types/database';
import { dbService } from './services/supabase';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { RegistrationPortal } from './components/RegistrationPortal';
import { LoginPage } from './components/LoginPage';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [activeView, setActiveView] = useState<'home' | 'portal' | 'login' | 'student-dashboard' | 'admin-dashboard'>('home');

  // Check persisted Supabase Auth session
  useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      try {
        const sessionData = await dbService.getCurrentSessionUser();
        if (isMounted && sessionData) {
          setCurrentUser(sessionData.user);
          if (sessionData.student) {
            setCurrentStudent(sessionData.student);
            setActiveView('student-dashboard');
          } else if (sessionData.user.role === 'admin') {
            setCurrentStudent(null);
            setActiveView('admin-dashboard');
          }
        }
      } catch (err) {
        console.warn('Session restore warning:', err);
      }
    };

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLoginSuccess = (user: User, student?: Student) => {
    setCurrentUser(user);
    if (student) {
      setCurrentStudent(student);
      setActiveView('student-dashboard');
    } else if (user.role === 'admin') {
      setCurrentStudent(null);
      setActiveView('admin-dashboard');
    } else {
      setActiveView('student-dashboard');
    }
  };

  const handleRegisterSuccess = (user: User, student: Student) => {
    setCurrentUser(user);
    setCurrentStudent(student);
    setActiveView('student-dashboard');
  };

  const handleLogout = async () => {
    await dbService.logout();
    setCurrentUser(null);
    setCurrentStudent(null);
    setActiveView('home');
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
        />
      )}

      {/* VIEW: HOME / LANDING PAGE */}
      {activeView === 'home' && (
        <LandingPage
          onRegisterClick={() => setActiveView('portal')}
          onLoginClick={() => setActiveView('login')}
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
    </div>
  );
}
