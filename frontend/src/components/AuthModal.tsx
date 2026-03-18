"use client";
import React, { useState } from 'react';

import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  onClose: () => void;
}

type AuthMode = 'login' | 'register';

export default function AuthModal({ onClose }: AuthModalProps) {
  const { login } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetError = () => setError('');

  const handleLoginSuccess = (data: any) => {
    login(data.token, data.user);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await authApi.login({ email, password });
        handleLoginSuccess(data);
      } else {
        await authApi.register({ email, password, name });
        const data = await authApi.login({ email, password });
        handleLoginSuccess(data);
      }
    } catch (err: any) {
      setError(err.message || 'Loi xac thuc');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = (provider: 'google' | 'facebook' | 'apple') => {
    resetError();
    setLoading(true);
    window.location.href = authApi.getOAuthStartUrl(provider);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-md relative border border-slate-700 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold"
        >
          x
        </button>

        <h2 className="text-2xl font-bold mb-2 text-center text-white">
          {mode === 'login' ? 'Dang nhap AmienComic' : 'Dang ky tai khoan'}
        </h2>

        <p className="text-center text-xs text-slate-400 mb-6">
          Ban co the dang nhap thu cong hoac social OAuth.
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded-xl mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Ho ten</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  resetError();
                }}
                required={mode === 'register'}
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-blue-500 outline-none transition-all text-white"
                placeholder="Nguyen Van A"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                resetError();
              }}
              required
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-blue-500 outline-none transition-all text-white"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Mat khau</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                resetError();
              }}
              required
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-blue-500 outline-none transition-all text-white"
              placeholder="********"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`font-bold p-3 rounded-xl transition-colors mt-2 text-white ${
              loading ? 'bg-blue-600/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {loading ? 'Dang xu ly...' : mode === 'login' ? 'Dang nhap' : 'Dang ky'}
          </button>
        </form>

        <div className="mt-5 grid grid-cols-1 gap-2">
          <button
            disabled={loading}
            onClick={() => handleSocialAuth('google')}
            className="w-full bg-white text-slate-900 py-2 rounded-lg font-semibold hover:bg-slate-100"
          >
            Tiep tuc voi Google
          </button>
          <button
            disabled={loading}
            onClick={() => handleSocialAuth('facebook')}
            className="w-full bg-blue-700 text-white py-2 rounded-lg font-semibold hover:bg-blue-600"
          >
            Tiep tuc voi Facebook
          </button>
          <button
            disabled={loading}
            onClick={() => handleSocialAuth('apple')}
            className="w-full bg-black text-white py-2 rounded-lg font-semibold hover:bg-slate-900"
          >
            Tiep tuc voi Apple ID
          </button>
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          {mode === 'login' ? 'Chua co tai khoan?' : 'Da co tai khoan?'}{' '}
          <button
            type="button"
            className="text-blue-400 hover:underline"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {mode === 'login' ? 'Dang ky ngay' : 'Dang nhap'}
          </button>
        </p>
      </div>
    </div>
  );
}
