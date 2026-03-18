"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useAuth } from '../../../src/context/AuthContext';
import { authApi } from '../../../src/services/api';

const providerLabel: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  apple: 'Apple ID',
};

const errorLabel: Record<string, string> = {
  provider_not_configured: 'Nha cung cap OAuth chua duoc cau hinh.',
  oauth_auth_failed: 'Dang nhap OAuth that bai.',
  oauth_server_error: 'He thong dang gap loi khi xu ly OAuth.',
};

export default function OAuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const hasHandled = useRef(false);

  const [message, setMessage] = useState('Dang xu ly dang nhap OAuth...');

  const provider = useMemo(() => params.get('provider') || 'social', [params]);
  const token = useMemo(() => params.get('token') || '', [params]);
  const error = useMemo(() => params.get('error') || '', [params]);

  useEffect(() => {
    if (hasHandled.current) return;
    hasHandled.current = true;

    const label = providerLabel[provider] || provider;

    if (error) {
      const detail = errorLabel[error] || `Loi OAuth: ${error}`;
      setMessage(`${label}: ${detail}`);
      return;
    }

    if (!token) {
      setMessage(`${label}: Khong nhan duoc token dang nhap.`);
      return;
    }

    localStorage.setItem('token', token);
    setMessage(`${label}: Dang xac thuc tai khoan...`);

    authApi
      .getMe()
      .then((userData) => {
        login(token, userData);
        router.replace('/');
      })
      .catch(() => {
        localStorage.removeItem('token');
        setMessage(`${label}: Khong the tai thong tin nguoi dung.`);
      });
  }, [error, login, provider, router, token]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-center shadow-2xl">
        <h1 className="text-xl font-bold mb-3">Dang nhap OAuth</h1>
        <p className="text-sm text-slate-300">{message}</p>
        {(error || !token) && (
          <button
            onClick={() => router.replace('/')}
            className="mt-5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors font-semibold"
          >
            Quay ve trang chu
          </button>
        )}
      </section>
    </main>
  );
}
