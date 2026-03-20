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
      setError(err.message || 'Lỗi xác thực');
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
    // Lớp phủ nền: Thay vì màu đen đục, dùng nền cực nhạt (slate-900/10) và tăng blur-md để tạo hiệu ứng kính mờ sâu của iOS
    <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in">
      
      {/* Khối Modal: Tăng độ mờ (blur-3xl), viền trắng rõ hơn và nền trắng trong suốt (white/60) */}
      <div className="bg-white/60 backdrop-blur-3xl p-8 rounded-[2rem] w-full max-w-md relative border border-white/80 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)]">
        
        {/* Nút Close tròn trĩnh nổi bật trên nền kính */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/50 border border-white/60 hover:bg-white text-slate-500 hover:text-slate-800 font-bold transition-all shadow-sm"
        >
          ✕
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-center text-slate-800 tracking-tight">
            {mode === 'login' ? 'Đăng nhập AmienComic' : 'Tạo tài khoản mới'}
          </h2>
          <p className="text-center text-sm text-slate-500 mt-1.5 font-medium">
            Mở khóa đầy đủ tính năng ngay hôm nay.
          </p>
        </div>

        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-600 p-3.5 rounded-2xl mb-5 text-sm text-center font-medium shadow-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Họ tên</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  resetError();
                }}
                required={mode === 'register'}
                className="w-full p-3.5 bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl focus:border-blue-400 focus:bg-white/80 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-800 placeholder-slate-400 font-medium shadow-sm"
                placeholder="Nguyễn Văn A"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                resetError();
              }}
              required
              className="w-full p-3.5 bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl focus:border-blue-400 focus:bg-white/80 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-800 placeholder-slate-400 font-medium shadow-sm"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                resetError();
              }}
              required
              className="w-full p-3.5 bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl focus:border-blue-400 focus:bg-white/80 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-800 placeholder-slate-400 font-medium shadow-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`font-bold p-3.5 rounded-2xl transition-all mt-4 text-white shadow-lg flex items-center justify-center ${
              loading 
                ? 'bg-blue-400 cursor-not-allowed shadow-none' 
                : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Đang xử lý...
              </span>
            ) : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center py-6">
          <div className="flex-grow border-t border-slate-300/50"></div>
          <span className="flex-shrink-0 mx-4 text-slate-400/80 text-xs font-semibold uppercase tracking-wider">Hoặc tiếp tục với</span>
          <div className="flex-grow border-t border-slate-300/50"></div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button
            disabled={loading}
            onClick={() => handleSocialAuth('google')}
            className="w-full bg-white/60 backdrop-blur-md border border-white/80 text-slate-700 p-3 rounded-2xl font-bold hover:bg-white transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            Google
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={loading}
              onClick={() => handleSocialAuth('facebook')}
              className="w-full bg-[#1877F2]/90 backdrop-blur-md text-white border border-[#1877F2]/50 p-3 rounded-2xl font-bold hover:bg-[#1864D9] transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" alt="Facebook" className="w-5 h-5 brightness-0 invert" />
              Facebook
            </button>
            <button
              disabled={loading}
              onClick={() => handleSocialAuth('apple')}
              className="w-full bg-black/90 backdrop-blur-md text-white border border-slate-800 p-3 rounded-2xl font-bold hover:bg-black transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <img src="https://www.svgrepo.com/show/511330/apple-173.svg" alt="Apple" className="w-5 h-5 brightness-0 invert" />
              Apple
            </button>
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-8 font-medium">
          {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
          <button
            type="button"
            className="text-blue-500 font-bold hover:text-blue-600 transition-colors"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </p>
      </div>
    </div>
  );
}