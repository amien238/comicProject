'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BookOpen, Coins, LogOut, Search, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../services/api';
import { resolveUserTier } from '../utils/userTier';

interface NavbarProps {
  onGoHome: () => void;
  onOpenAuthModal: () => void;
}

export default function Navbar({ onGoHome, onOpenAuthModal }: NavbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications]);
  const tier = useMemo(() => resolveUserTier(user?.role, user?.totalDeposited), [user?.role, user?.totalDeposited]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    setLoadingNotifications(true);
    notificationApi
      .getMyNotifications()
      .then((items) => setNotifications(Array.isArray(items) ? items : []))
      .catch(() => setNotifications([]))
      .finally(() => setLoadingNotifications(false));
  }, [user]);

  //scroll page navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        setOpenNotifications(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  const handleOpenNotification = async () => {
    setOpenNotifications((prev) => !prev);

    if (unreadCount > 0) {
      try {
        await notificationApi.markAsRead();
      } catch (_error) {
        // no-op
      }
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    }
  };

  const handleNotificationClick = async (item: any) => {
    if (!item?.isRead) {
      try {
        await notificationApi.markAsRead(item.id);
      } catch (_error) {
        // no-op
      }
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
    }

    setOpenNotifications(false);
    if (item?.link) router.push(item.link);
  };

  return (
    <div className={`fixed w-full z-50 top-0 transition-all duration-300 ${scrolled ? 'p-2' : 'p-4'}`}>
      {/* Tăng độ mờ (blur) và làm mỏng nền trắng (white/50) cho Navbar tổng */}
      <nav className="max-w-7xl mx-auto bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] px-6 py-3 flex justify-between items-center rounded-full">

        {/* Logo */}
        <div className="flex items-center space-x-2 cursor-pointer group" onClick={onGoHome}>
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-teal-400 rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform duration-300">
            <BookOpen size={20} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">
            AmienComic
          </span>
        </div>

        {/* Search Bar - Kính mờ chìm */}
        <div className="hidden md:flex items-center bg-slate-900/5 backdrop-blur-xl rounded-full px-4 py-2 w-1/3 border border-white/60 focus-within:bg-white/60 focus-within:border-blue-400/50 focus-within:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
          <Search size={18} className="text-slate-500 mr-2" />
          <input
            type="text"
            placeholder="Tìm kiếm truyện... (Nhấn Enter)"
            className="bg-transparent border-none outline-none w-full text-sm text-slate-800 placeholder-slate-500 font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>

        {/* Right Section */}
        <div>
          {user ? (
            <div className="flex items-center space-x-3 sm:space-x-4">

              {/* Nút Role: Kính mờ pha màu (Tinted Frosted Glass) thay vì Gradient đặc */}
              {(user.role === 'AUTHOR' || user.role === 'ADMIN') && (
                <button
                  onClick={() => router.push('/author')}
                  className="hidden sm:block bg-purple-500/10 backdrop-blur-xl border border-purple-500/20 text-purple-700 px-4 py-2 rounded-full font-bold text-xs shadow-[0_4px_15px_rgba(168,85,247,0.05)] hover:bg-purple-500/20 hover:shadow-[0_4px_20px_rgba(168,85,247,0.15)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  Truyện
                </button>
              )}

              {(user.role === 'ACCOUNTER' || user.role === 'ADMIN') && (
                <button
                  onClick={() => router.push('/accounting')}
                  className="hidden sm:block bg-sky-500/10 backdrop-blur-xl border border-sky-500/20 text-sky-700 px-4 py-2 rounded-full font-bold text-xs shadow-[0_4px_15px_rgba(14,165,233,0.05)] hover:bg-sky-500/20 hover:shadow-[0_4px_20px_rgba(14,165,233,0.15)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  Doanh Thu
                </button>
              )}

              {user.role === 'ADMIN' && (
                <button
                  onClick={() => router.push('/admin')}
                  className="hidden sm:block bg-rose-500/10 backdrop-blur-xl border border-rose-500/20 text-rose-700 px-4 py-2 rounded-full font-bold text-xs shadow-[0_4px_15px_rgba(244,63,113,0.05)] hover:bg-rose-500/20 hover:shadow-[0_4px_20px_rgba(244,63,113,0.15)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  Dashboard
                </button>
              )}

              {/* Notifications - Kính mờ nhô lên */}
              <div className="relative" ref={panelRef}>
                <button
                  onClick={handleOpenNotification}
                  className="relative bg-slate-900/5 backdrop-blur-xl p-2.5 rounded-full border border-white/60 hover:bg-white/60 hover:text-blue-600 text-slate-600 shadow-[0_4px_15px_rgba(0,0,0,0.02)] transition-all"
                  title="Thông báo"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow-sm border border-white/50">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {openNotifications && (
                  <div className="absolute right-0 mt-3 w-80 bg-white/70 backdrop-blur-3xl border border-white/80 rounded-3xl shadow-[0_20px_60px_rgb(0,0,0,0.08)] overflow-hidden z-[60] px-2 py-2 ">
                    <div className="px-4 py-3 border-b border-white/40 flex items-center justify-between bg-slate-50/30">
                      <span className="font-bold text-sm text-slate-800">Thông báo</span>
                      <span className="text-xs font-semibold bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full border border-blue-500/20">{notifications.length}</span>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {loadingNotifications ? (
                        <div className="p-4 text-sm text-slate-500 text-center">Đang tải...</div>
                      ) : notifications.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500 text-center">Chưa có thông báo nào.</div>
                      ) : (
                        notifications.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleNotificationClick(item)}
                            className={`w-full border text-left px-4 py-3 border-white/40 hover:bg-white/90 hover:border-white transition-colors rounded-3xl ${item.isRead ? 'opacity-60 bg-transparent' : 'bg-white/40'
                              }`}
                          >
                            <div className={`text-sm mb-1 ${item.isRead ? 'font-medium text-slate-900' : 'font-bold text-slate-800'}`}>
                              {item.title}
                            </div>
                            <div className="text-xs text-slate-900 line-clamp-2">{item.message}</div>
                            <div className="text-[10px] text-slate-400 mt-1.5 font-medium">
                              {new Date(item.createdAt).toLocaleString('vi-VN')}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Coins/Points - Kính mờ vàng */}
              <div className="flex items-center bg-amber-500/10 backdrop-blur-xl px-3 py-1.5 rounded-full border border-amber-500/20 shadow-[0_4px_15px_rgba(245,158,11,0.05)]">
                <Coins size={16} className="text-amber-500 mr-1.5 drop-shadow-sm" />
                <span className="font-bold text-sm text-amber-600">{user.points || 0}</span>
              </div>

              {/* User Profile - Kính mờ bọc Avatar */}
              <div
                className="flex items-center space-x-2 cursor-pointer bg-slate-900/5 hover:bg-white/60 backdrop-blur-xl p-1 pr-3 rounded-full border border-white/60 transition-all shadow-[0_4px_15px_rgba(0,0,0,0.02)]"
                onClick={() => router.push('/profile')}
              >
                <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-teal-400 rounded-full flex items-center justify-center font-bold text-white shadow-inner">
                  {user.avatar ?
                    (
                      <img src={user.avatar} className="w-full h-full object-cover rounded-full" alt="avatar" />
                    ) : (user.name?.charAt(0).toUpperCase())}
                </div>
                <div className="hidden sm:flex flex-col leading-tight justify-center">
                  <span className="font-bold text-sm text-slate-700">{user.name}</span>
                  {tier && <span className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded-full shadow-sm w-fit ${tier.className}`}>{tier.label}</span>}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="bg-slate-900/5 backdrop-blur-xl border border-white/60 text-slate-500 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20 p-2 rounded-full transition-all shadow-[0_4px_15px_rgba(0,0,0,0.02)]"
                title="Đăng xuất"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 bg-white/70 backdrop-blur-xl border border-white/80 text-blue-600 px-5 py-2.5 rounded-full font-bold transition-all shadow-[0_8px_20px_rgba(0,0,0,0.05)] hover:bg-white hover:shadow-[0_8px_25px_rgba(0,0,0,0.08)] hover:-translate-y-0.5"
            >
              <User size={18} />
              <span className="text-sm">Đăng nhập</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}