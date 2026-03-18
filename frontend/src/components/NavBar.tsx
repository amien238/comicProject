"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BookOpen, Coins, LogOut, Search, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../services/api';

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

  const panelRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications]);

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
    <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-md">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={onGoHome}>
          <div className="bg-blue-600 p-2 rounded-lg">
            <BookOpen size={24} />
          </div>
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            AmienComic
          </span>
        </div>

        <div className="hidden md:flex items-center bg-slate-800 rounded-full px-4 py-2 w-1/3 border border-slate-700 focus-within:border-blue-500 transition-colors">
          <Search size={18} className="text-slate-400 mr-2" />
          <input
            type="text"
            placeholder="Tim kiem truyen... (Nhan Enter)"
            className="bg-transparent border-none outline-none w-full text-sm text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>

        <div>
          {user ? (
            <div className="flex items-center space-x-3 sm:space-x-4">
              {(user.role === 'AUTHOR' || user.role === 'ADMIN') && (
                <button
                  onClick={() => router.push('/author')}
                  className="hidden sm:block bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-lg transition-all"
                >
                  Khu vuc Tac gia
                </button>
              )}

              <div className="relative" ref={panelRef}>
                <button
                  onClick={handleOpenNotification}
                  className="relative bg-slate-800 p-2 rounded-full border border-slate-700 hover:border-blue-500 transition-colors"
                  title="Thong bao"
                >
                  <Bell size={18} className="text-slate-200" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-red-500 text-white rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {openNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[60]">
                    <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                      <span className="font-bold text-sm">Thong bao</span>
                      <span className="text-xs text-slate-400">{notifications.length}</span>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {loadingNotifications ? (
                        <div className="p-4 text-sm text-slate-400">Dang tai...</div>
                      ) : notifications.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500">Chua co thong bao nao.</div>
                      ) : (
                        notifications.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleNotificationClick(item)}
                            className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-slate-800 transition-colors ${
                              item.isRead ? 'text-slate-400' : 'text-slate-100'
                            }`}
                          >
                            <div className="text-sm font-semibold mb-1">{item.title}</div>
                            <div className="text-xs line-clamp-2">{item.message}</div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              {new Date(item.createdAt).toLocaleString('vi-VN')}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center bg-slate-800 px-3 py-1.5 rounded-full border border-yellow-500/30">
                <Coins size={16} className="text-yellow-400 mr-1.5" />
                <span className="font-semibold text-yellow-400">{user.points || 0}</span>
              </div>

              <div
                className="flex items-center space-x-2 cursor-pointer hover:bg-slate-800 p-2 rounded-lg transition-colors"
                onClick={() => router.push('/profile')}
              >
                <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full flex items-center justify-center font-bold">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block font-medium">{user.name}</span>
              </div>

              <button
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="text-slate-400 hover:text-red-400 p-2"
                title="Dang xuat"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-full font-medium transition-colors"
            >
              <User size={18} />
              <span>Dang nhap</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}