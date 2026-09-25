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

  // Check persisted session if any
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('smk_muhiba_session_user');
      const savedStudent = localStorage.getItem('smk_muhiba_session_student');
      if (savedUser) {
        const u = JSON.parse(savedUser) as User;
        setCurrentUser(u);
        if (savedStudent) {
          const s = JSON.parse(savedStudent) as Student;
          // Refresh from DB
          const latest = dbService.getStudentByNik(s.nik);
          setCurrentStudent(latest || s);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleLoginSuccess = (user: User, student?: Student) => {
    setCurrentUser(user);
    localStorage.setItem('smk_muhiba_session_user', JSON.stringify(user));
    
    if (student) {
      setCurrentStudent(student);
      localStorage.setItem('smk_muhiba_session_student', JSON.stringify(student));
      setActiveView('student-dashboard');
    } else if (user.role === 'admin') {
      setCurrentStudent(null);
      localStorage.removeItem('smk_muhiba_session_student');
      setActiveView('admin-dashboard');
    } else {
      // Look up student if available
      const found = dbService.getStudentByNik(user.nik);
      if (found) {
        setCurrentStudent(found);
        localStorage.setItem('smk_muhiba_session_student', JSON.stringify(found));
        setActiveView('student-dashboard');
      } else {
        setActiveView('home');
      }
    }
  };

  const handleRegisterSuccess = (user: User, student: Student) => {
    setCurrentUser(user);
    setCurrentStudent(student);
    localStorage.setItem('smk_muhiba_session_user', JSON.stringify(user));
    localStorage.setItem('smk_muhiba_session_student', JSON.stringify(student));
    setActiveView('student-dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentStudent(null);
    localStorage.removeItem('smk_muhiba_session_user');
    localStorage.removeItem('smk_muhiba_session_student');
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
