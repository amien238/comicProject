"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Eye, Zap, TrendingUp, Crown, Bot, X, Send, MessageCircle, Clock, Play, Heart, Flame } from 'lucide-react';
import Navbar from '../src/components/NavBar';
import AuthModal from '../src/components/AuthModal';
import { comicApi, tagApi, aiApi, historyApi, userApi } from '../src/services/api';
import { useAuth } from '../src/context/AuthContext';

// Hàm tính thời gian cập nhật
const timeAgo = (dateString: string) => {
  if (!dateString) return '';
  const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
  let interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " ngày trước";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " giờ trước";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " phút trước";
  return "Vừa xong";
};

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [comics, setComics] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  // State cho Banner Slider tự động
  const [currentTopIndex, setCurrentTopIndex] = useState(0);

  // AI State
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Chào bạn! Mình là Nexus Bot 🤖. Mình có thể gợi ý truyện hoặc giải đáp thắc mắc cho bạn.' }
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const comicsData = await comicApi.getAllComics().catch(() => []);
        const tagsData = await tagApi.getAllTags().catch(() => []);

        setComics(Array.isArray(comicsData) ? comicsData : []);
        setTags(Array.isArray(tagsData) ? tagsData : []);

        if (user) {
          try {
            const history = await historyApi.getMyHistory();
            const favoritesData = await userApi.getFavorites().catch(() => []);

            setRecentHistory(Array.isArray(history) ? history.slice(0, 4) : []);
            setFavorites(Array.isArray(favoritesData) ? favoritesData : []);
          } catch (err) {
            setRecentHistory([]);
            setFavorites([]);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isBotTyping]);

  const topComics = [...comics].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);

  // Logic tự động lướt Banner chậm lại: 5 giây (5000ms)
  useEffect(() => {
    if (topComics.length === 0) return;
    const timer = setInterval(() => {
      // Tăng index để tạo hiệu ứng cuộn danh sách (lấy 3 item liên tiếp)
      setCurrentTopIndex((prevIndex) => (prevIndex + 1) % topComics.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [topComics.length]);

  const displayComics = selectedTag
    ? comics.filter(c => c.tags?.some((t: any) => t.id === selectedTag))
    : comics;

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userText = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    setIsBotTyping(true);
    try {
      const formattedHistory = chatMessages.slice(1).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));
      const data = await aiApi.chat([...formattedHistory, { role: 'user', parts: [{ text: userText }] }]);
      setChatMessages(prev => [...prev, { sender: 'bot', text: data.reply }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { sender: 'bot', text: 'Hệ thống AI đang bận, bạn thử lại sau nhé!' }]);
    } finally {
      setIsBotTyping(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-800 pb-16 pt-24 relative overflow-hidden">

      {/* 🌟 NỀN TRANG (BACKGROUND BLOBS) THEO CONCEPT KÍNH MỜ 🌟 */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-400/20 blur-[120px] rounded-full mix-blend-multiply"></div>
        <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[60vw] bg-teal-300/20 blur-[120px] rounded-full mix-blend-multiply"></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[60vw] h-[50vw] bg-purple-400/20 blur-[120px] rounded-full mix-blend-multiply"></div>
      </div>

      <Navbar onGoHome={() => setSelectedTag(null)} onOpenAuthModal={() => setShowAuthModal(true)} />

      <main className="max-w-7xl mx-auto p-4 sm:p-6 relative z-10">

        {/* KHU VỰC: TIẾP TỤC ĐỌC (Lịch sử) */}
        {!selectedTag && recentHistory.length > 0 && (
          <div className="mb-12 animate-fade-in">
            <h2 className="text-xl font-medium mb-5 flex items-center text-blue-500 tracking-tight">
              <Clock size={25} className="mr-2 text-blue-500" /> Tiếp tục đọc
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentHistory.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => router.push(`/read/${item.chapterId}`)}
                  className="bg-white/60 backdrop-blur-xl border border-white/80 p-3 rounded-2xl flex items-center cursor-pointer hover:bg-white hover:shadow-[0_10px_30px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300 group shadow-sm"
                >
                  <img src={item.comic?.coverUrl || ''} className="w-12 h-16 object-cover rounded-xl mr-3 shadow-sm" alt="cover" />
                  <div className="flex-1 overflow-hidden">
                    <h4 className="font-bold text-sm truncate text-slate-800 group-hover:text-blue-600 transition-colors">{item.comic?.title || 'Đang tải'}</h4>
                    <p className="text-xs text-blue-500 font-semibold truncate mt-1">Đang đọc: {item.chapter?.title || 'Đang tải'}</p>
                  </div>
                  <div className="bg-blue-100 text-blue-600 p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all ml-2 group-hover:bg-blue-500 group-hover:text-white shadow-sm">
                    <Play size={12} className="fill-current" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🌟 BANNER CHIA ĐÔI: TEXT (Trái) & DANH SÁCH TOP TRUYỆN AUTO-SLIDE (Phải) 🌟 */}
        <div className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] p-8 sm:p-12 mb-14 flex flex-col md:flex-row items-center justify-between border border-white/60 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] relative overflow-hidden group">

          <div className="absolute top-0 right-1/4 w-80 h-80 bg-gradient-to-tr from-blue-300 to-teal-200 rounded-full blur-[80px] opacity-30 group-hover:opacity-50 transition-opacity duration-700"></div>

          {/* Nửa Trái: Tiêu đề */}
          <div className="z-10 relative md:w-5/12 w-full mb-16 md:mb-0">
            <div className="inline-block bg-white/70 backdrop-blur-sm border border-white/80 text-blue-600 font-bold text-xs px-3 py-1 rounded-full mb-4 shadow-sm">
              ✨ Nền tảng thế hệ mới
            </div>
            <h1 className="text-4xl sm:text-5xl font-black mb-5 leading-[1.15] text-slate-800 tracking-tight">
              Manga, Manhwa & <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500">
                Thế giới Nexus
              </span>
            </h1>
            <p className="text-slate-600 mb-8 max-w-md font-medium text-lg leading-relaxed">
              Khám phá hàng ngàn chương truyện bản quyền. Hỗ trợ tác giả yêu thích của bạn trực tiếp qua hệ thống điểm thưởng.
            </p>
            <button className="bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white px-8 py-3.5 rounded-full shadow-[0_10px_20px_rgba(59,130,246,0.3)] hover:shadow-[0_15px_30px_rgba(59,130,246,0.4)] hover:-translate-y-1 transition-all duration-300">
              <a href="#list-truyen">
                Khám phá ngay
              </a>
            </button>
          </div>

          {/* Nửa Phải: Danh sách Top 3 truyện (Poster bự & Chữ số Glassmorphism nổi lên trên) */}
          <div className="z-10 relative md:w-7/12 w-full flex flex-row gap-3 sm:gap-4 justify-center md:justify-end items-end h-full mt-6 md:mt-0">
            {topComics.length > 0 && Array.from({ length: Math.min(3, topComics.length) }).map((_, offset) => {
              const index = (currentTopIndex + offset) % topComics.length;
              const comic = topComics[index];
              if (!comic) return null;

              return (
                <div
                  key={`${comic.id}-${currentTopIndex}`} // Key đổi kích hoạt animate-fade-in
                  onClick={() => router.push(`/comic/${comic.id}`)}
                  className="animate-fade-in relative group cursor-pointer mt-8 sm:mt-12"
                >
                  {/* Poster Truyện - To hơn và dài hơn */}
                  <div className="relative z-10 w-36 h-56 sm:w-[13rem] sm:h-[19rem] rounded-[2rem] overflow-hidden shadow-[0_15px_35px_rgba(0,0,0,0.15)] border border-white/60 group-hover:shadow-[0_25px_50px_rgba(0,0,0,0.25)] group-hover:-translate-y-3 transition-all duration-500">
                    <img src={comic.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="cover" />

                    {/* Gradient Overlay mờ khi hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>

                  {/* Chữ số thứ tự siêu to nằm TRÊN poster (z-20) theo style Text Kính mờ */}
                  <div className="absolute -bottom-6 -left-6 sm:-bottom-10 sm:-left-10 z-20 flex items-center justify-center group-hover:-translate-y-3 transition-all duration-500 pointer-events-none">
                    {/* Text viền sắc nét, ruột mờ */}
                    <span className={`relative text-[75px] sm:text-[120px] font-black italic drop-shadow-[0_10px_20px_rgba(0,0,0,0.2)] leading-none tracking-tighter ${index === 0 ? 'text-purple-500/10 ' :
                      index === 1 ? 'text-teal-400/10 ' :
                        index === 2 ? 'text-slate-500/10 ' :
                          'text-slate-200/50'
                      }`}
                      style={{ WebkitTextStroke: '1px rgba(255,255,255,0.95)' }}>
                      {(index + 1).toString().padStart(2, '')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {/* Bộ lọc Thể Loại & Mô tả Thể Loại (Nếu có) */}
        <div className="mb-8 flex flex-col gap-4" id="list-truyen">
          <div className="flex flex-wrap gap-2.5 items-center">
            <span className="font-bold text-slate-700 mr-2">Khám phá:</span>
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm border ${!selectedTag
                ? 'bg-slate-800 text-white border-slate-800 shadow-slate-800/20'
                : 'bg-white/70 backdrop-blur-md text-slate-600 border-white/80 hover:bg-white'
                }`}
            >
              Tất cả
            </button>
            {tags.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTag(t.id)}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm border ${selectedTag === t.id
                  ? 'bg-slate-800 text-white border-slate-800 shadow-slate-800/20'
                  : 'bg-white/70 backdrop-blur-md text-slate-600 border-white/80 hover:bg-white'
                  }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          {/* Hiển thị mô tả của Tag (Nếu có) */}
          {selectedTag && tags.find(t => t.id === selectedTag)?.description && (
            <div className="animate-fade-in bg-white/60 backdrop-blur-xl border border-white/80 text-slate-700 text-sm font-medium p-4 rounded-2xl max-w-4xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex items-start">
              <span className="bg-blue-100 text-blue-600 font-extrabold px-2.5 py-0.5 rounded-lg mr-3 text-[13px] whitespace-nowrap">Thể loại</span>
              <p className="leading-relaxed">
                {tags.find(t => t.id === selectedTag)?.description}
              </p>
            </div>
          )}
        </div>

        {/* Danh Sách Truyện Chính */}
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-blue-500"></div></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5 sm:gap-6">
            {displayComics.map(comic => (
              <div
                key={comic.id}
                onClick={() => router.push(`/comic/${comic.id}`)}
                className="bg-white/60 backdrop-blur-xl border border-white/80 p-2.5 rounded-[1.5rem] shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 transition-all duration-300 group cursor-pointer flex flex-col relative"
              >
                <div className="aspect-[3/4] relative rounded-2xl overflow-hidden mb-3 bg-slate-100">
                  <img src={comic.coverUrl} className="w-full h-full object-cover" alt="cover" />

                  {/* Thay thế chữ Hot bằng Icon trái tim (nếu đã yêu thích) nằm ở góc trái */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10">
                    
                    {(comic.isFavorited || (user && comic.favorites?.some((f: any) => f.userId === user.id))) && (
                      <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-sm w-fit flex items-center justify-center">
                        <Heart size={14} className="fill-pink-500 text-pink-500" />
                      </div>
                    )}
                  </div>

                  {/* Nhãn Rating Góc phải */}
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md text-amber-500 text-[11px] font-extrabold px-2 py-1 rounded-lg flex items-center shadow-sm z-10">
                    <Star size={11} className="mr-1 fill-amber-500" /> {comic.averageRating || '5.0'}
                  </div>

                  {/* Hiện Số Chap đè lên góc dưới poster */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent p-3 pt-12 z-10">
                    <span className="bg-slate-100/60 px-2 py-1 rounded-lg border border-slate-200/50 text-xs">
                      {timeAgo(comic.updatedAt || comic.createdAt)}
                    </span>
                  </div>

                  {/* LỚP OVERLAY KHI HOVER */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 p-4 flex flex-col justify-center items-center text-center z-20" />
                </div>

                {/* Thông tin phụ nằm bên dưới poster */}
                <div className="px-1 flex-1 flex flex-col justify-between">
                  <h3 className="font-bold text-[15px] text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors mb-2">
                    {comic.title}
                  </h3>
                  <div className="flex justify-between items-center text-[11px] text-slate-500 font-semibold mt-auto">
                    <span className="bg-purple-400/10 px-2 py-1 rounded-lg border border-purple-500/50 text-purple-600">
                      Chap {comic.latestChapter?.chapterNumber ?? comic.chapters?.length ?? '0'}
                    </span>
                    <span className="flex items-center gap-1.5 text-blue-500">
                      <Eye size={13} className="text-blue-500" />
                      {comic.views || 0}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Chatbot */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {showChat && (
          <div className="bg-white/80 backdrop-blur-3xl border border-white/80 w-[320px] sm:w-[360px] h-[480px] rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] mb-4 flex flex-col overflow-hidden animate-fade-in origin-bottom-right">
            <div className="bg-gradient-to-r from-blue-600 to-teal-500 p-4 flex justify-between items-center text-white shadow-sm">
              <div className="flex items-center font-bold text-sm tracking-wide">
                <div className="bg-white/20 p-1.5 rounded-full mr-2 backdrop-blur-sm">
                  <Bot size={18} className="drop-shadow-sm" />
                </div>
                Nexus AI
              </div>
              <button onClick={() => setShowChat(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors"><X size={18} /></button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-slate-50/50 space-y-4 custom-scrollbar">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3.5 text-sm rounded-[1.25rem] shadow-sm leading-relaxed ${msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white border border-slate-200/80 text-slate-700 rounded-bl-sm font-medium'
                    }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isBotTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200/80 text-slate-500 p-3 rounded-[1.25rem] rounded-bl-sm text-xs font-semibold shadow-sm flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChat} className="p-3 bg-white/90 backdrop-blur-md border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                disabled={isBotTyping}
                placeholder="Hỏi Nexus Bot..."
                className="flex-1 bg-slate-100 border border-slate-200/50 rounded-full px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isBotTyping}
                className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 shadow-md transition-all flex items-center justify-center"
              >
                <Send size={16} className="ml-0.5" />
              </button>
            </form>
          </div>
        )}

        <button
          onClick={() => setShowChat(!showChat)}
          className="bg-blue-600 text-white p-4 rounded-full shadow-[0_10px_30px_rgba(37,99,235,0.4)] hover:shadow-[0_15px_40px_rgba(37,99,235,0.5)] hover:-translate-y-1 transition-all flex items-center justify-center"
        >
          {showChat ? <X size={26} /> : <MessageCircle size={26} />}
        </button>
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}