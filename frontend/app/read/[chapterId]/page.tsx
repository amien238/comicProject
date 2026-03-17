"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { comicApi, historyApi } from '../../../src/services/api';

export default function ReadChapter() {
  const params = useParams();
  const router = useRouter();
  const chapterId = params.chapterId as string;

  const [chapterData, setChapterData] = useState<any>(null);
  const [chapterList, setChapterList] = useState<any[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // UX States
  const [showUI, setShowUI] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  // 1. TẢI DỮ LIỆU CHƯƠNG VÀ DANH SÁCH CHƯƠNG
  useEffect(() => {
    const fetchChapterAndList = async () => {
      try {
        setLoading(true);
        // Lấy chi tiết chương hiện tại
        const data = await comicApi.getChapterDetail(chapterId);
        setChapterData(data);

        // Lưu lịch sử đọc ngay khi load xong
        if (data.chapter?.comicId) {
          historyApi.updateHistory(data.chapter.comicId, chapterId).catch(console.error);
          const localHistory = JSON.parse(localStorage.getItem('comicHistory') || '{}');
          localHistory[data.chapter.comicId] = chapterId;
          localStorage.setItem('comicHistory', JSON.stringify(localHistory));

          // Lấy danh sách toàn bộ chương để làm nút Next/Prev
          const list = await comicApi.getChapters(data.chapter.comicId);
          setChapterList(list);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchChapterAndList();
  }, [chapterId]);

  // 2. TÍNH TOÁN THANH TIẾN TRÌNH CUỘN (SCROLL PROGRESS)
  const handleScroll = useCallback(() => {
    const totalScroll = document.documentElement.scrollTop;
    const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scroll = `${totalScroll / windowHeight}`;
    
    setScrollProgress(Number(scroll) * 100);

    // Tùy chọn: Tự động ẩn UI khi cuộn xuống
    if (totalScroll > 100 && showUI) {
      setShowUI(false);
    }
  }, [showUI]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // 3. TÌM CHƯƠNG TRƯỚC / SAU
  const currentIndex = chapterList.findIndex(c => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? chapterList[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapterList.length - 1 ? chapterList[currentIndex + 1] : null;

  const handleNavigate = (targetChapterId: string) => {
    router.push(`/read/${targetChapterId}`);
  };

  // --- RENDER TRẠNG THÁI LỖI / ĐANG TẢI ---
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0f172a]"><div className="animate-spin h-10 w-10 border-t-2 border-blue-500 rounded-full"></div></div>;

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-white bg-[#0f172a]">
        <div className="bg-slate-800 p-8 rounded-2xl max-w-md text-center border border-slate-700 shadow-2xl">
          <div className="text-red-400 text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2">Chương bị khóa</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button onClick={() => router.back()} className="bg-blue-600 px-6 py-2 rounded-xl font-bold hover:bg-blue-500 transition-all">Quay lại</button>
        </div>
      </div>
    );
  }

  // --- RENDER GIAO DIỆN ĐỌC CHÍNH ---
  return (
    <div className="bg-[#0b1120] min-h-screen relative font-sans selection:bg-blue-500/30">
      
      {/* THANH TIẾN TRÌNH (Luôn hiện ở sát mép trên cùng) */}
      <div className="fixed top-0 left-0 h-1 bg-slate-800 z-[60] w-full">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-150 ease-out" 
          style={{ width: `${scrollProgress}%` }}
        ></div>
      </div>

      {/* HEADER (Thanh điều hướng trên - Ẩn/Hiện theo showUI) */}
      <div className={`fixed top-0 left-0 w-full z-50 transition-transform duration-300 ease-in-out ${showUI ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 p-3 sm:p-4 flex items-center justify-between shadow-lg">
          <button onClick={() => router.push(`/comic/${chapterData?.chapter?.comicId}`)} className="flex items-center text-slate-300 hover:text-white transition-colors bg-slate-800/80 p-2 sm:px-4 sm:py-2 rounded-xl">
            <ArrowLeft size={20} className="sm:mr-2" />
            <span className="hidden sm:block font-bold text-sm">Về Truyện</span>
          </button>
          
          <div className="flex-1 px-4 text-center overflow-hidden">
            <h1 className="text-sm sm:text-base font-bold text-white truncate">
              {chapterData?.comic?.title || 'Đang đọc truyện'}
            </h1>
            <p className="text-xs text-blue-400 truncate font-medium">
              {chapterData?.chapter?.title}
            </p>
          </div>

          <button className="text-slate-300 hover:text-white bg-slate-800/80 p-2 rounded-xl transition-colors">
            <MessageCircle size={20} />
          </button>
        </div>
      </div>

      {/* KHU VỰC ẢNH TRUYỆN (Click vào đây để ẩn/hiện UI) */}
      <div 
        className="flex flex-col items-center w-full max-w-3xl mx-auto cursor-pointer min-h-screen pt-4 pb-24"
        onClick={() => setShowUI(!showUI)}
      >
        {chapterData?.images?.length > 0 ? (
          chapterData.images.map((img: any, idx: number) => (
            <img 
              key={idx} 
              src={img.url} 
              alt={`Trang ${img.pageNumber}`} 
              loading="lazy" // Quan trọng: Lazy load giúp cuộn mượt hơn
              className="w-full h-auto block select-none" 
            />
          ))
        ) : (
          <div className="py-32 text-slate-500 italic flex flex-col items-center">
            <span className="text-4xl mb-4">📭</span>
            Chương này hiện chưa có nội dung.
          </div>
        )}
      </div>

      {/* FOOTER (Thanh điều hướng dưới - Ẩn/Hiện theo showUI) */}
      <div className={`fixed bottom-0 left-0 w-full z-50 transition-transform duration-300 ease-in-out ${showUI ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
            
            <button 
              onClick={() => prevChapter && handleNavigate(prevChapter.id)}
              disabled={!prevChapter}
              className={`flex-1 flex items-center justify-center p-3 rounded-xl font-bold transition-all ${prevChapter ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'}`}
            >
              <ChevronLeft size={20} className="mr-1" />
              <span className="hidden sm:block">Chương trước</span>
            </button>

            {/* Menu Chọn Chương Nhanh */}
            <div className="relative flex-1 group">
              <select 
                value={chapterId}
                onChange={(e) => handleNavigate(e.target.value)}
                className="w-full appearance-none bg-slate-800 border border-slate-700 text-white text-center font-bold p-3 rounded-xl outline-none cursor-pointer focus:border-blue-500 hover:bg-slate-700 transition-colors"
              >
                {chapterList.map(c => (
                  <option key={c.id} value={c.id}>{c.title} {c.price > 0 ? `(💎 ${c.price})` : ''}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <List size={18} />
              </div>
            </div>

            <button 
              onClick={() => nextChapter && handleNavigate(nextChapter.id)}
              disabled={!nextChapter}
              className={`flex-1 flex items-center justify-center p-3 rounded-xl font-bold transition-all ${nextChapter ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20' : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'}`}
            >
              <span className="hidden sm:block">Chương sau</span>
              <ChevronRight size={20} className="ml-1" />
            </button>

          </div>
        </div>
      </div>

    </div>
  );
}