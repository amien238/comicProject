"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, CreditCard, BookOpen, Heart, Clock, ChevronRight, LogOut } from 'lucide-react';
import Navbar from '../../src/components/NavBar';
import { useAuth } from '../../src/context/AuthContext';
import { transactionApi, userApi, historyApi } from '../../src/services/api';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'unlocked' | 'favorites' | 'history'>('unlocked');
  const [unlockedChapters, setUnlockedChapters] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [readingHistory, setReadingHistory] = useState<any[]>([]);
  const [isDepositing, setIsDepositing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const loadAllData = async () => {
        setLoading(true);
        try {
          const [unlocked, favs, history] = await Promise.all([
            userApi.getUnlockedChapters().catch(() => []),
            userApi.getFavorites().catch(() => []),
            historyApi.getMyHistory().catch(() => [])
          ]);
          setUnlockedChapters(unlocked);
          setFavorites(favs);
          setReadingHistory(history);
        } catch (error) {
          console.error("Lỗi tải dữ liệu", error);
        } finally {
          setLoading(false);
        }
      };
      loadAllData();
    }
  }, [user]);

  const handleDeposit = async () => {
    if (isDepositing) return;
    setIsDepositing(true);
    try {
      await transactionApi.deposit(10000); 
      alert("🎉 Nạp 10,000 điểm thành công!");
      if (refreshUser) await refreshUser();
    } catch (error: any) {
      alert(error.message || "Lỗi nạp điểm");
    } finally {
      setIsDepositing(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">
        <div className="bg-slate-800 p-8 rounded-3xl text-center border border-slate-700 shadow-xl">
          <h2 className="text-2xl font-bold mb-4">Vui lòng đăng nhập</h2>
          <button onClick={() => router.push('/')} className="bg-blue-600 px-6 py-2 rounded-xl">Về Trang Chủ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 pb-10">
      <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => {}} />

      <main className="max-w-5xl mx-auto p-4 sm:p-6 mt-4 animate-fade-in">
        <button onClick={() => router.back()} className="flex items-center text-slate-400 hover:text-white mb-6">
          <ArrowLeft size={20} className="mr-2" /> Quay lại
        </button>

        <h1 className="text-3xl font-bold text-white mb-8">Trang Cá Nhân</h1>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Cột trái */}
          <div className="col-span-1 space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl text-center">
              <div className="w-24 h-24 mx-auto bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-4xl font-bold text-white mb-4">
                {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="avatar" /> : user.name?.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold">{user.name}</h2>
              <p className="text-slate-400 text-sm mb-4">{user.email}</p>
              
              <div className="bg-slate-900/50 p-3 rounded-xl mb-4 text-blue-400 font-bold text-sm">Chức vụ: {user.role}</div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
                <p className="text-yellow-500 text-xs font-bold mb-1">Số dư</p>
                <p className="text-3xl font-black text-yellow-400 flex justify-center items-center"><Coins size={24} className="mr-2"/> {user.points}</p>
              </div>

              <button onClick={handleDeposit} disabled={isDepositing} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl mb-3 transition-colors flex justify-center items-center">
                <CreditCard size={18} className="mr-2" /> {isDepositing ? 'Đang xử lý...' : 'Nạp 10K Điểm'}
              </button>
              <button onClick={handleLogout} className="w-full text-slate-500 hover:text-red-400 font-medium py-2 flex justify-center items-center">
                <LogOut size={16} className="mr-2"/> Đăng xuất
              </button>
            </div>
          </div>

          {/* Cột phải */}
          <div className="col-span-2">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl h-full flex flex-col min-h-[500px]">
              
              {/* Tabs */}
              <div className="flex space-x-2 mb-6 border-b border-slate-700 pb-4 overflow-x-auto scrollbar-hide">
                <button onClick={() => setActiveTab('unlocked')} className={`px-4 py-2 rounded-xl font-bold flex items-center whitespace-nowrap transition-all ${activeTab === 'unlocked' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                  <BookOpen size={18} className="mr-2" /> Đã Mua
                </button>
                <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-xl font-bold flex items-center whitespace-nowrap transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                  <Clock size={18} className="mr-2" /> Lịch Sử
                </button>
                <button onClick={() => setActiveTab('favorites')} className={`px-4 py-2 rounded-xl font-bold flex items-center whitespace-nowrap transition-all ${activeTab === 'favorites' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                  <Heart size={18} className="mr-2" /> Yêu Thích
                </button>
              </div>

              {/* Danh sách */}
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                {loading ? <p className="text-center text-slate-500 py-10">Đang tải...</p> : (
                  <>
                    {activeTab === 'unlocked' && (
                      unlockedChapters.length === 0 ? <p className="text-center text-slate-500 py-10">Chưa có chương nào được mua.</p> :
                      unlockedChapters.map((item, i) => (
                        <div key={i} onClick={() => router.push(`/read/${item.chapterId}`)} className="flex items-center p-3 bg-slate-900 rounded-xl hover:border-blue-500/50 border border-slate-700 cursor-pointer group">
                          <img src={item.comicCover} className="w-12 h-16 object-cover rounded mr-4" alt="cover" />
                          <div className="flex-1"><h4 className="font-bold group-hover:text-blue-400">{item.comicTitle}</h4><p className="text-blue-500 text-sm">{item.chapterTitle}</p></div>
                          <ChevronRight className="text-slate-600" />
                        </div>
                      ))
                    )}
                    
                    {activeTab === 'history' && (
                      readingHistory.length === 0 ? <p className="text-center text-slate-500 py-10">Bạn chưa đọc truyện nào gần đây.</p> :
                      readingHistory.map((item, i) => (
                        <div key={i} onClick={() => router.push(`/read/${item.chapterId}`)} className="flex items-center p-3 bg-slate-900 rounded-xl hover:border-indigo-500/50 border border-slate-700 cursor-pointer group">
                          <img src={item.comic.coverUrl} className="w-12 h-16 object-cover rounded mr-4" alt="cover" />
                          <div className="flex-1">
                            <h4 className="font-bold group-hover:text-indigo-400 line-clamp-1">{item.comic.title}</h4>
                            <p className="text-slate-400 text-sm">Đang đọc: <span className="text-indigo-400">{item.chapter.title}</span></p>
                            <p className="text-slate-600 text-[10px] mt-1">Cập nhật: {new Date(item.updatedAt).toLocaleString('vi-VN')}</p>
                          </div>
                          <ChevronRight className="text-slate-600" />
                        </div>
                      ))
                    )}
                    
                    {activeTab === 'favorites' && (
                      favorites.length === 0 ? <p className="text-center text-slate-500 py-10">Chưa có truyện yêu thích.</p> :
                      favorites.map((item, i) => (
                        <div key={i} onClick={() => router.push(`/comic/${item.comicId}`)} className="flex items-center p-3 bg-slate-900 rounded-xl hover:border-pink-500/50 border border-slate-700 cursor-pointer group">
                          <img src={item.coverUrl} className="w-12 h-16 object-cover rounded mr-4" alt="cover" />
                          <div className="flex-1"><h4 className="font-bold group-hover:text-pink-400">{item.title}</h4><p className="text-slate-500 text-sm">{item.authorName}</p></div>
                          <ChevronRight className="text-slate-600" />
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}} />
    </div>
  );
}