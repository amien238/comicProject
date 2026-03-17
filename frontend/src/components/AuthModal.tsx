"use client";
import React, { useState } from 'react';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const { login } = useAuth(); // Lấy hàm login từ Context
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Gọi API đăng nhập từ thư mục services
      const data = await authApi.login({ email, password });
      
      // Đăng nhập thành công -> Cập nhật vào AuthContext
      login(data.token, data.user);
      alert('Đăng nhập thành công!');
      onClose(); // Đóng Modal
    } catch (err: any) {
      setError(err.message || 'Lỗi đăng nhập! Kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-md relative border border-slate-700 shadow-2xl">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold"
        >
          ✕
        </button>
        <h2 className="text-2xl font-bold mb-6 text-center text-white">Đăng nhập AmienComic</h2>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded-xl mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-white" 
              placeholder="user@example.com" 
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Mật khẩu</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-white" 
              placeholder="••••••••" 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className={`font-bold p-3 rounded-xl transition-colors mt-4 text-white ${loading ? 'bg-blue-600/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
          >
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>
        <p className="text-center text-slate-400 text-sm mt-6">
          Chưa có tài khoản? <span className="text-blue-400 cursor-pointer hover:underline">Đăng ký ngay</span>
        </p>
      </div>
    </div>
  );
}