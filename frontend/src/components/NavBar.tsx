"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, User, Coins, LogOut, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onGoHome: () => void;
  onOpenAuthModal: () => void;
}

export default function Navbar({ onGoHome, onOpenAuthModal }: NavbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter(); // Khởi tạo router

  // THÊM MỚI: State lưu từ khóa tìm kiếm
  const [searchTerm, setSearchTerm] = React.useState('');
  
  // THÊM MỚI: Hàm xử lý khi nhấn Enter
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim() !== '') {
      router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-md">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center space-x-2 cursor-pointer" onClick={onGoHome}>
          <div className="bg-blue-600 p-2 rounded-lg">
            <BookOpen size={24} />
          </div>
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            AmienComic
          </span>
        </div>
        
        {/* Thanh tìm kiếm */}
        <div className="hidden md:flex items-center bg-slate-800 rounded-full px-4 py-2 w-1/3 border border-slate-700 focus-within:border-blue-500 transition-colors">
          <Search size={18} className="text-slate-400 mr-2" />
          <input 
            type="text" 
            placeholder="Tìm kiếm truyện... (Nhấn Enter)" 
            className="bg-transparent border-none outline-none w-full text-sm text-white" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>

        {/* User Menu */}
        <div>
          {user ? (
            <div className="flex items-center space-x-4">
              
              {/* NÚT KHU VỰC TÁC GIẢ (Chỉ hiện khi là AUTHOR hoặc ADMIN) */}
              {(user.role === 'AUTHOR' || user.role === 'ADMIN') && (
                <button 
                  onClick={() => router.push('/author')} 
                  className="hidden sm:block bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-lg transition-all"
                >
                  Khu vực Tác Giả
                </button>
              )}

              {/* Số điểm của User */}
              <div className="flex items-center bg-slate-800 px-3 py-1.5 rounded-full border border-yellow-500/30">
                <Coins size={16} className="text-yellow-400 mr-1.5" />
                <span className="font-semibold text-yellow-400">{user.points || 0}</span>
              </div>
              
              {/* Click vào Avatar để vào Profile */}
              <div 
                className="flex items-center space-x-2 cursor-pointer hover:bg-slate-800 p-2 rounded-lg transition-colors" 
                onClick={() => router.push('/profile')}
              >
                <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full flex items-center justify-center font-bold">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block font-medium">{user.name}</span>
              </div>

              {/* Nút Đăng xuất riêng */}
              <button onClick={() => { logout(); router.push('/'); }} className="text-slate-400 hover:text-red-400 p-2" title="Đăng xuất">
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button 
              onClick={onOpenAuthModal} 
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-full font-medium transition-colors"
            >
              <User size={18} />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}