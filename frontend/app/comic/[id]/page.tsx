"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Heart, Star, Eye, Unlock, Lock, 
  MessageSquare, Send, BookOpen, Reply, Clock, AlertTriangle 
} from 'lucide-react';
import Navbar from '../../../src/components/NavBar';
import AuthModal from '../../../src/components/AuthModal';
import { comicApi, transactionApi, userApi, interactionApi } from '../../../src/services/api'; 
import { useAuth } from '../../../src/context/AuthContext';

// Logic tính cấp bậc (Tier System - Sprint 5)
const getUserBadge = (role: string, totalDeposited: number) => {
  if (role === 'ADMIN') return { name: 'QTV', style: 'bg-red-500 text-white shadow-red-500/50' };
  if (role === 'AUTHOR') return { name: 'Tác giả', style: 'bg-purple-500 text-white shadow-purple-500/50' };
  
  const total = totalDeposited || 0;
  if (total >= 5000000) return { name: 'Quý tộc', style: 'bg-gradient-to-r from-yellow-300 to-yellow-600 text-black font-black border border-yellow-200 shadow-yellow-500/50' };
  if (total >= 2000000) return { name: 'Cấp 5', style: 'bg-orange-500 text-white' };
  if (total >= 1000000) return { name: 'Cấp 4', style: 'bg-pink-500 text-white' };
  if (total >= 500000) return { name: 'Cấp 3', style: 'bg-blue-500 text-white' };
  if (total >= 200000) return { name: 'Cấp 2', style: 'bg-green-500 text-white' };
  if (total >= 50000) return { name: 'Cấp 1', style: 'bg-slate-500 text-white' };
  return null;
};

export default function ComicDetail() {
  const params = useParams();
  const router = useRouter();
  const comicId = params?.id as string;
  
  const { user, refreshUser } = useAuth();
  const [comic, setComic] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [viewCount, setViewCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!comicId) return;
      
      try {
        setLoading(true);
        setErrorMsg(null);

        // 1. Lấy thông tin truyện (Sẽ bị catch nếu API trả về lỗi hoặc 404)
        const comicData = await comicApi.getComicById(comicId);
        
        if (!comicData || comicData.error) {
          throw new Error(comicData?.error || "Truyện không tồn tại.");
        }

        setComic(comicData);
        setViewCount(comicData.views || 0);
        
        // 2. Lấy dữ liệu chương & bình luận (Bọc catch phụ để không làm sập trang chính)
        const [chaps, cmts] = await Promise.all([
          comicApi.getChapters(comicId).catch(() => []),
          interactionApi.getComments(comicId).catch(() => [])
        ]);
        
        setChapters(Array.isArray(chaps) ? chaps : []);
        setComments(Array.isArray(cmts) ? cmts : []);

        if (user) {
          const unlocked = await userApi.getUnlockedChapters().catch(() => []);
          setUnlockedIds(Array.isArray(unlocked) ? unlocked.map((u: any) => u.chapterId) : []);
        }

      } catch (error: any) {
        console.error("Lỗi tải chi tiết truyện:", error);
        setErrorMsg(error.message || "Đã xảy ra lỗi khi tải dữ liệu.");
        setComic(null); 
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    if (comicId) interactionApi.incrementView(comicId).catch(() => {});
  }, [comicId, user]);

  const handlePostComment = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    if (!user) return setShowAuthModal(true);
    const text = parentId ? replyText : commentText;
    if (!text.trim()) return;

    setSubmitting(true);
    try {
      const result = await interactionApi.addComment(comicId, text, parentId);
      if (parentId) {
        setComments(comments.map(c => 
          c.id === parentId ? { ...c, replies: [...(c.replies || []), result.comment] } : c
        ));
        setReplyText('');
        setReplyingTo(null);
      } else {
        setComments([{ ...result.comment, replies: [] }, ...comments]);
        setCommentText('');
      }
    } catch (err: any) {
      alert(err.message || "Lỗi khi gửi bình luận");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuyChapter = async (chapterId: string, price: number) => {
    if (!user) return setShowAuthModal(true);
    if (!confirm(`Mua chương này với ${price} điểm?`)) return;

    try {
      await transactionApi.buyChapter(chapterId);
      alert("Mở khóa thành công!");
      setUnlockedIds(prev => [...prev, chapterId]);
      if (refreshUser) refreshUser();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- TRẠM KIỂM SOÁT 1: BẢO VỆ GIAO DIỆN KHI LOADING ---
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="animate-spin h-10 w-10 border-t-2 border-blue-500 rounded-full"></div>
    </div>
  );

  // --- TRẠM KIỂM SOÁT 2: BẢO VỆ GIAO DIỆN CHỐNG LỖI NULL (CRASH) ---
  if (errorMsg || !comic) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a] text-white p-4">
      <div className="bg-slate-800/80 p-8 rounded-3xl border border-slate-700 text-center max-w-md shadow-2xl backdrop-blur-sm">
        <AlertTriangle size={64} className="text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Không Khả Dụng</h2>
        <p className="text-slate-400 mb-6">{errorMsg || "Không thể tải thông tin truyện. Có thể truyện đã bị xóa hoặc xảy ra lỗi kết nối."}</p>
        <button onClick={() => router.push('/')} className="bg-blue-600 hover:bg-blue-500 px-8 py-2 rounded-xl font-bold transition-all">Về Trang Chủ</button>
      </div>
    </div>
  );

  // --- GIAO DIỆN CHÍNH ---
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans pb-10">
      <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => setShowAuthModal(true)} />

      <main className="max-w-6xl mx-auto p-4 sm:p-6 mt-4 animate-fade-in">
        <button onClick={() => router.push('/')} className="flex items-center text-slate-400 hover:text-white mb-6 group">
          <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Quay lại Trang chủ
        </button>

        <div className="bg-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-8 shadow-xl border border-slate-700/50">
          <div className="relative shrink-0">
             <img src={comic.coverUrl || 'https://via.placeholder.com/300x450?text=No+Image'} className="w-full md:w-64 aspect-[2/3] object-cover rounded-2xl shadow-lg border border-slate-700" alt="cover" />
             <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-yellow-400 flex items-center border border-white/10">
                <Star size={14} className="mr-1 fill-yellow-400" /> {comic.averageRating || '5.0'}
             </div>
          </div>
          
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 leading-tight">{comic.title}</h1>
            <p className="text-blue-400 font-bold mb-6">Tác giả: {comic.author?.name || 'Ẩn danh'}</p>
            
            <div className="flex space-x-6 mb-8 bg-slate-900/40 p-4 rounded-2xl border border-slate-700/30 w-fit">
              <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-black mb-1">Lượt xem</span><b className="text-xl flex items-center"><Eye size={16} className="mr-1.5 text-blue-400"/> {viewCount.toLocaleString()}</b></div>
              <div className="w-px bg-slate-700 h-10 self-center"></div>
              <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-black mb-1">Đánh giá</span><b className="text-xl text-yellow-400 flex items-center"><Star size={16} className="mr-1.5 fill-yellow-400"/> {comic.averageRating || '5.0'}</b></div>
            </div>

            <p className="text-slate-400 leading-relaxed mb-8 text-sm sm:text-base line-clamp-6">{comic.description}</p>
            
            <div className="flex gap-4">
               <button onClick={() => chapters[0] && router.push(`/read/${chapters[0].id}`)} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-2xl font-black shadow-lg transition-all">ĐỌC NGAY</button>
               <button className="bg-slate-700 hover:bg-slate-600 text-pink-400 px-6 py-3.5 rounded-2xl font-bold border border-slate-600"><Heart size={20}/></button>
            </div>
          </div>
        </div>

        {/* DANH SÁCH CHƯƠNG */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center"><Clock className="mr-2 text-indigo-400" /> Danh sách chương</h2>
            <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700 font-bold">{chapters.length} Chương</span>
          </div>

          <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {chapters.length === 0 ? (
               <div className="bg-slate-800/40 p-16 rounded-3xl text-center border border-dashed border-slate-700 text-slate-500 italic">
                 Dữ liệu chương chưa được đồng bộ hoặc chưa có chương nào được tải lên.
               </div>
            ) : (
              chapters.map((ch) => {
                const isUnlocked = unlockedIds.includes(ch.id) || ch.price === 0;
                return (
                  <div 
                    key={ch.id} 
                    onClick={() => isUnlocked ? router.push(`/read/${ch.id}`) : handleBuyChapter(ch.id, ch.price)} 
                    className="bg-slate-800/60 hover:bg-slate-700 rounded-2xl p-4 flex justify-between items-center transition-all border border-slate-700/50 cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center font-bold text-slate-600 group-hover:text-blue-400 transition-colors">
                        {ch.orderNumber}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-200 group-hover:text-white transition-colors">{ch.title}</h4>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {isUnlocked ? (
                         <span className="text-green-500 text-[10px] font-black uppercase tracking-widest bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20 flex items-center">
                           <Unlock size={12} className="mr-1.5" /> Đã mở
                         </span>
                      ) : (
                         <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-4 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5">
                           <Lock size={12} /> {ch.price} ĐIỂM
                         </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* KHU VỰC BÌNH LUẬN ĐA TẦNG */}
        <div className="mt-16 bg-slate-800/50 rounded-3xl p-6 sm:p-8 border border-slate-700/50 shadow-xl backdrop-blur-sm">
          <h2 className="text-2xl font-bold mb-8 flex items-center">
            <MessageSquare className="mr-3 text-blue-500" /> Thảo luận cộng đồng
          </h2>

          <form onSubmit={(e) => handlePostComment(e)} className="mb-12 flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white shadow-lg shrink-0">
              {(user?.name || 'U').charAt(0)}
            </div>
            <div className="flex-1 flex gap-2">
              <input 
                type="text" 
                value={commentText} 
                onChange={e => setCommentText(e.target.value)}
                placeholder={user ? "Cảm nghĩ của bạn về bộ truyện này..." : "Đăng nhập để bình luận"} 
                disabled={!user || submitting}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-5 py-3 text-sm text-white outline-none focus:border-blue-500 transition-all placeholder:text-slate-600"
              />
              <button 
                type="submit" 
                disabled={!user || submitting || !commentText.trim()} 
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-2xl font-bold transition-all disabled:opacity-50 active:scale-95"
              >
                Gửi
              </button>
            </div>
          </form>

          <div className="space-y-8">
            {comments.length === 0 ? (
               <div className="text-center py-10 text-slate-500 italic">Hiện chưa có bình luận nào.</div>
            ) : (
              comments.map((cmt: any) => {
                const badge = getUserBadge(cmt.user?.role, cmt.user?.totalDeposited);
                return (
                  <div key={cmt.id} className="group/comment">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center font-bold text-white shrink-0 group-hover/comment:bg-slate-600 transition-colors">
                        {(cmt.user?.name || 'U').charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="bg-slate-900/40 border border-slate-700/50 p-4 rounded-2xl rounded-tl-none shadow-sm group-hover/comment:border-slate-600 transition-all">
                          <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-blue-400">{cmt.user?.name || 'Độc giả'}</span>
                                {badge && (
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${badge.style}`}>
                                    {badge.name}
                                  </span>
                                )}
                             </div>
                             <span className="text-[10px] text-slate-600 font-medium">
                               {new Date(cmt.createdAt).toLocaleDateString('vi-VN')}
                             </span>
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed">{cmt.content}</p>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-2 ml-2">
                           <button 
                             onClick={() => setReplyingTo(replyingTo === cmt.id ? null : cmt.id)} 
                             className="text-[11px] font-black text-slate-600 hover:text-blue-400 flex items-center gap-1.5 transition-colors"
                           >
                              <Reply size={12} /> TRẢ LỜI
                           </button>
                        </div>

                        {/* Ô NHẬP REPLY */}
                        {replyingTo === cmt.id && (
                          <div className="mt-4 ml-6 flex gap-2 animate-in slide-in-from-top-2 duration-300">
                             <input 
                               autoFocus
                               type="text" 
                               value={replyText} 
                               onChange={e => setReplyText(e.target.value)}
                               placeholder={`Trả lời ${cmt.user?.name || 'thành viên này'}...`}
                               className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-blue-500"
                             />
                             <button 
                               onClick={(e) => handlePostComment(e, cmt.id)} 
                               disabled={!replyText.trim() || submitting}
                               className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
                             >
                               Gửi
                             </button>
                          </div>
                        )}

                        {/* REPLIES LIST */}
                        {(cmt.replies || []).length > 0 && (
                          <div className="mt-4 ml-6 sm:ml-10 border-l-2 border-slate-800 pl-4 space-y-4">
                             {cmt.replies.map((reply: any) => {
                               const rBadge = getUserBadge(reply.user?.role, reply.user?.totalDeposited);
                               return (
                                 <div key={reply.id} className="flex gap-3 group/reply">
                                    <div className="w-8 h-8 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                                      {(reply.user?.name || 'U').charAt(0)}
                                    </div>
                                    <div className="flex-1 bg-slate-900/20 p-3 rounded-xl border border-slate-800/50 group-hover/reply:border-slate-700 transition-all">
                                       <div className="flex items-center gap-2 mb-1">
                                          <span className="font-bold text-xs text-slate-400">{reply.user?.name || 'Độc giả'}</span>
                                          {rBadge && <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${rBadge.style}`}>{rBadge.name}</span>}
                                       </div>
                                       <p className="text-slate-400 text-xs">{reply.content}</p>
                                    </div>
                                 </div>
                               );
                             })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}} />
    </div>
  );
}