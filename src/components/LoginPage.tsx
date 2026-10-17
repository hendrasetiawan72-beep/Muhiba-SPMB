import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/supabase';
import { User, Student } from '../types/database';
import { AlertCircle, Lock, User as UserIcon, Phone, ArrowLeft, ShieldAlert } from 'lucide-react';

interface LoginPageProps {
  onSuccessLogin: (user: User, student?: Student) => void;
  onNavigateRegister: () => void;
  onNavigateHome: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccessLogin,
  onNavigateRegister,
  onNavigateHome,
}) => {
  const [usernameNik, setUsernameNik] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Cloudflare Turnstile: wajib karena CAPTCHA Supabase Auth aktif (token sekali pakai)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tryRender = () => {
      if (cancelled || !turnstileContainerRef.current) return;
      const ts = (window as any).turnstile;
      if (!ts) {
        // Script api.js (async defer) mungkin belum selesai dimuat
        if (tries++ < 50) timer = setTimeout(tryRender, 200);
        return;
      }
      try {
        turnstileWidgetIdRef.current = ts.render(turnstileContainerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
        });
      } catch (e) {
        console.warn('Turnstile render warning:', e);
      }
    };
    tryRender();
