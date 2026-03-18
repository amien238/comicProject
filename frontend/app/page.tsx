"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Eye, Zap, TrendingUp, Crown, Bot, X, Send, MessageCircle, Clock, Play, Heart } from 'lucide-react';
import Navbar from '../src/components/NavBar';
import AuthModal from '../src/components/AuthModal';
import { comicApi, tagApi, aiApi, historyApi } from '../src/services/api';
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
  
  const [loading, setLoading] = useState(true);

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
            setRecentHistory(Array.isArray(history) ? history.slice(0, 4) : []); 
          } catch (err) {
            setRecentHistory([]);
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

  const topComics = [...comics].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
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
    <div className="min-h-screen animate-fade-in bg-[#0f172a] text-slate-100 pb-10 relative">
      <Navbar onGoHome={() => setSelectedTag(null)} onOpenAuthModal={() => setShowAuthModal(true)} />
      
      <main className="max-w-6xl mx-auto p-4 sm:p-6 mt-4">
        
        {/* KHU VỰC: TIẾP TỤC ĐỌC */}
        {!selectedTag && recentHistory.length > 0 && (
          <div className="mb-10 animate-fade-in">
            <h2 className="text-xl font-bold mb-4 flex items-center text-indigo-400">
              <Clock size={20} className="mr-2" /> Tiếp tục đọc
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentHistory.map((item, idx) => (
                <div 
                  key={idx} 
                  onClick={() => router.push(`/read/${item.chapterId}`)}
                  className="bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/50 p-3 rounded-2xl flex items-center cursor-pointer transition-all group"
                >
                  <img src={item.comic?.coverUrl || ''} className="w-12 h-16 object-cover rounded-lg mr-3 shadow-lg" alt="cover" />
                  <div className="flex-1 overflow-hidden">
                    <h4 className="font-bold text-sm truncate text-white group-hover:text-indigo-300">{item.comic?.title || 'Đang tải'}</h4>
                    <p className="text-xs text-indigo-400 font-medium truncate">Đang đọc: {item.chapter?.title || 'Đang tải'}</p>
                  </div>
                  <div className="bg-indigo-500 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <Play size={12} fill="white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Banner */}
        <div className="bg-slate-800/80 rounded-3xl p-6 sm:p-10 mb-10 flex flex-col md:flex-row items-center justify-between border border-slate-700/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 opacity-10 rounded-full blur-3xl"></div>
          <div className="z-10">
            <h1 className="text-3xl sm:text-4xl font-black mb-4 leading-tight">Manga, Manhwa & <br/><span className="text-blue-400">Thế giới Nexus</span></h1>
            <p className="text-slate-400 mb-6 max-w-lg">Khám phá hàng ngàn chương truyện bản quyền. Ủng hộ tác giả trực tiếp qua hệ thống điểm.</p>
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-bold flex items-center shadow-lg transition-all">
              <Zap size={18} className="mr-2 fill-yellow-400 text-yellow-400" /> ĐỌC NGAY
            </button>
          </div>
        </div>

        {/* Bảng Xếp Hạng */}
        {!loading && topComics.length > 0 && !selectedTag && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center border-l-4 border-yellow-500 pl-3">
              <TrendingUp className="mr-2 text-yellow-500" /> Bảng Xếp Hạng View
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {topComics.map((comic, index) => (
                <div key={comic.id} onClick={() => router.push(`/comic/${comic.id}`)} className="bg-slate-800 rounded-xl overflow-hidden cursor-pointer group relative border border-slate-700 hover:border-yellow-500/50">
                  <div className={`absolute top-0 left-0 z-10 w-8 h-8 flex justify-center items-center font-bold rounded-br-lg ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-white'}`}>
                    {index === 0 ? <Crown size={16} /> : index + 1}
                  </div>
                  <img src={comic.coverUrl} className="w-full h-48 object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="cover" />
                  <div className="p-3">
                    <h3 className="font-bold text-sm line-clamp-1 group-hover:text-yellow-400">{comic.title}</h3>
                    <p className="text-xs text-slate-400 flex items-center mt-1"><Eye size={12} className="mr-1 text-blue-400"/> {comic.views}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bộ lọc Thể Loại */}
        <div className="mb-8 flex flex-wrap gap-2">
           <button onClick={() => setSelectedTag(null)} className={`px-4 py-1.5 rounded-full text-sm font-medium ${!selectedTag ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Tất cả</button>
           {tags.map(t => (
             <button key={t.id} onClick={() => setSelectedTag(t.id)} className={`px-4 py-1.5 rounded-full text-sm font-medium ${selectedTag === t.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{t.name}</button>
           ))}
        </div>

        {/* Danh Sách Truyện Đã Sửa Lại Lớp Hiển Thị Mới */}
        {loading ? (
          <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {displayComics.map(comic => (
              <div key={comic.id} onClick={() => router.push(`/comic/${comic.id}`)} className="group cursor-pointer relative">
                <div className="aspect-[2/3] relative rounded-xl overflow-hidden border border-slate-700 mb-2 bg-slate-800">
                  <img src={comic.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="cover" />
                  
                  {/* Nhãn Đánh giá & Yêu thích */}
                  <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                    <div className="bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-bold text-yellow-400 flex items-center">
                      <Star size={10} className="mr-1 fill-yellow-400"/> {comic.averageRating || '5.0'}
                    </div>
                  </div>

                  {/* Nhãn thời gian & thông số */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pt-8 pb-2 px-2">
                     <p className="text-[10px] text-white flex justify-between items-center font-bold">
                       <span>{timeAgo(comic.updatedAt || comic.createdAt)}</span>
                       <span className="flex items-center gap-2">
                         <span className="flex items-center text-blue-300"><Eye size={10} className="mr-1"/>{comic.views || 0}</span>
                         <span className="flex items-center text-pink-400"><Heart size={10} className="mr-1 fill-current"/>{comic.favoriteCount || comic._count?.favorites || 0}</span>
                       </span>
                     </p>
                  </div>
                </div>
                <h3 className="font-bold text-sm line-clamp-2 group-hover:text-blue-400 transition-colors leading-tight">{comic.title}</h3>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Chatbot */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {showChat && (
          <div className="bg-slate-800 border border-slate-700 w-[320px] sm:w-[360px] h-[450px] rounded-2xl shadow-2xl mb-4 flex flex-col overflow-hidden animate-fade-in origin-bottom-right">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white">
              <div className="flex items-center font-bold"><Bot size={20} className="mr-2" /> Nexus AI</div>
              <button onClick={() => setShowChat(false)}><X size={18} /></button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-slate-900/80 space-y-4 custom-scrollbar">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 text-sm rounded-2xl ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-700 text-slate-200 rounded-bl-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isBotTyping && <div className="text-slate-400 text-xs italic ml-2">Nexus Bot đang gõ...</div>}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendChat} className="p-3 bg-slate-800 border-t border-slate-700 flex gap-2">
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={isBotTyping} placeholder="Hỏi Nexus Bot..." className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2 text-sm text-white outline-none" />
              <button type="submit" disabled={!chatInput.trim() || isBotTyping} className="bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-500 disabled:opacity-50"><Send size={16} /></button>
            </form>
          </div>
        )}
        <button onClick={() => setShowChat(!showChat)} className="bg-blue-600 text-white p-4 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:scale-110 transition-all">
          {showChat ? <X size={28} /> : <MessageCircle size={28} />}
        </button>
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}
