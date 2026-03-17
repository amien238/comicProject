"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Star, Eye, Unlock, Lock, MessageSquare, Send, BookOpen, Bookmark, Reply } from 'lucide-react';
import Navbar from '../../../src/components/NavBar';
import AuthModal from '../../../src/components/AuthModal';
import { comicApi, transactionApi, userApi, interactionApi } from '../../../src/services/api';
import { useAuth } from '../../../src/context/AuthContext';

// HÀM TIỆN ÍCH TÍNH TOÁN CẤP BẬC TỪ TỔNG NẠP (CHUẨN SPRINT 5)
const getUserBadge = (role: string, totalDeposited: number) => {
    if (role === 'ADMIN') return { name: 'QTV', style: 'bg-red-500 text-white shadow-red-500/50' };
    if (role === 'AUTHOR') return { name: 'Tác giả', style: 'bg-purple-500 text-white shadow-purple-500/50' };
    if (role === 'ACCOUNTER') return { name: 'Kế toán', style: 'bg-teal-500 text-white shadow-teal-500/50' };

    const total = totalDeposited || 0;
    if (total >= 5000000) return { name: 'Quý tộc', style: 'bg-gradient-to-r from-yellow-300 to-yellow-600 text-black font-black shadow-yellow-500/50 border border-yellow-200' };
    if (total >= 2000000) return { name: 'Cấp 5', style: 'bg-orange-500 text-white shadow-orange-500/50' };
    if (total >= 1000000) return { name: 'Cấp 4', style: 'bg-pink-500 text-white shadow-pink-500/50' };
    if (total >= 500000) return { name: 'Cấp 3', style: 'bg-blue-500 text-white shadow-blue-500/50' };
    if (total >= 200000) return { name: 'Cấp 2', style: 'bg-green-500 text-white shadow-green-500/50' };
    if (total >= 50000) return { name: 'Cấp 1', style: 'bg-slate-500 text-white shadow-slate-500/50' };
    return null; // Dưới 50k không hiển thị cấp
};

export default function ComicDetail() {
    const params = useParams();
    const router = useRouter();
    const comicId = params.id as string;

    const { user, refreshUser } = useAuth();
    const [comic, setComic] = useState<any>(null);
    const [chapters, setChapters] = useState<any[]>([]);
    const [unlockedChapterIds, setUnlockedChapterIds] = useState<string[]>([]);
    const [isFavorite, setIsFavorite] = useState(false);
    const [viewCount, setViewCount] = useState(0);
    const [lastReadChapter, setLastReadChapter] = useState<any>(null);

    // COMMENT STATES
    const [comments, setComments] = useState<any[]>([]);
    const [commentText, setCommentText] = useState('');
    const [replyText, setReplyText] = useState('');
    const [replyingToId, setReplyingToId] = useState<string | null>(null); // Lưu ID của comment đang được reply
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [loading, setLoading] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true); // Bắt đầu load
                const comicData = await comicApi.getComicById(comicId);

                // KIỂM TRA AN TOÀN: Nếu không có dữ liệu, dừng lại
                if (!comicData) {
                    console.error("Comic không tồn tại:", comicId);
                    setComic(null);
                    return;
                }

                setComic(comicData);
                setViewCount(comicData.views || 0); // Đã an toàn hơn

                const chaptersData = await comicApi.getChapters(comicId);

                setChapters(
                    Array.isArray(chaptersData)
                        ? chaptersData
                        : chaptersData.chapters || []
                );

                if (typeof window !== 'undefined') {
                    const history = JSON.parse(localStorage.getItem('comicHistory') || '{}');
                    if (history[comicId]) {
                        const lastRead = chaptersData.find((c: any) => c.id === history[comicId]);
                        if (lastRead) setLastReadChapter(lastRead);
                    }
                }

                interactionApi.getComments(comicId).then(setComments).catch(console.error);

                if (user) {
                    userApi.getUnlockedChapters().then((unlockedData: any) => {
                        setUnlockedChapterIds(unlockedData.map((item: any) => item.chapterId));
                    }).catch(console.error);
                }
            } catch (error) {
                console.error("Lỗi lấy dữ liệu truyện:", error);
                setComic(null); // Đánh dấu là lỗi dữ liệu
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        interactionApi.incrementView(comicId).then(() => setViewCount(prev => prev + 1));
    }, [comicId, user]);

    // --- HÀNH ĐỘNG GỬI BÌNH LUẬN GỐC ---
    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return setShowAuthModal(true);
        if (!commentText.trim()) return;
        setIsSubmitting(true);
        try {
            const result = await interactionApi.addComment(comicId, commentText);
            // Gắn thêm mảng replies rỗng để giao diện không bị lỗi
            setComments([{ ...result.comment, replies: [] }, ...comments]);
            setCommentText('');
        } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
    };

    // --- HÀNH ĐỘNG GỬI TRẢ LỜI (REPLY) ---
    const handleReplySubmit = async (parentId: string) => {
        if (!user) return setShowAuthModal(true);
        if (!replyText.trim()) return;
        setIsSubmitting(true);
        try {
            const result = await interactionApi.addComment(comicId, replyText, parentId);

            // Chèn reply vừa đăng vào đúng bình luận cha trong state
            setComments(comments.map(c => {
                if (c.id === parentId) {
                    return { ...c, replies: [...(c.replies || []), result.comment] };
                }
                return c;
            }));
            setReplyText('');
            setReplyingToId(null);
        } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
    };

    const handleRate = async (score: number) => {
        if (!user) { alert("Vui lòng đăng nhập để đánh giá!"); return setShowAuthModal(true); }
        try {
            const result = await interactionApi.rateComic(comicId, score);
            setComic({ ...comic, averageRating: result.averageRating });
            alert(`Đánh giá ${score} sao thành công! Cảm ơn bạn.`);
        } catch (error: any) { alert(error.message); }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="animate-spin h-10 w-10 border-t-2 border-blue-500 rounded-full"></div></div>;

    return (
        <div className="min-h-screen animate-fade-in bg-[#0f172a] text-slate-100 font-sans pb-10">
            <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => setShowAuthModal(true)} />

            <main className="max-w-6xl mx-auto p-4 sm:p-6 mt-4">
                <button onClick={() => router.push('/')} className="flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
                    <ArrowLeft size={20} className="mr-2" /> Quay lại Trang chủ
                </button>

                {/* THÔNG TIN TRUYỆN */}
                <div className="bg-slate-800 rounded-2xl p-6 flex flex-col md:flex-row gap-8 shadow-xl border border-slate-700/50">
                    {comic && (
                        <img
                            src={comic.coverUrl}
                            className="w-full md:w-64 object-cover rounded-xl shadow-lg border border-slate-700"
                            alt="cover"
                        />
                    )}                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-white mb-2">{comic.title}</h1>
                        <p className="text-blue-400 font-medium mb-4">Tác giả: {comic.author?.name || 'Đang cập nhật'}</p>

                        <div className="flex space-x-6 mb-6">
                            <div className="flex items-center"><Star className="text-yellow-400 mr-2" /> <b>{comic.averageRating}</b></div>
                            <div className="flex items-center"><Eye className="text-blue-400 mr-2" /> <b>{viewCount}</b></div>
                        </div>

                        <div className="mb-6 flex items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700/30 w-fit">
                            <span className="text-sm font-bold text-slate-400 mr-3">Đánh giá của bạn:</span>
                            <div className="flex space-x-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <Star key={star} size={22} onClick={() => handleRate(star)} className={`cursor-pointer hover:scale-110 ${comic.averageRating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'}`} />
                                ))}
                            </div>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed">{comic.description}</p>
                    </div>
                </div>

                {/* KHU VỰC BÌNH LUẬN & TRẢ LỜI */}
                <div className="mt-10 bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-700/50 shadow-xl">
                    <h2 className="text-2xl font-bold mb-6 flex items-center border-b border-slate-700 pb-4">
                        <MessageSquare className="mr-3 text-blue-400" /> Thảo Luận ({comments.length + comments.reduce((acc, c) => acc + (c.replies?.length || 0), 0)})
                    </h2>

                    {/* Ô Nhập bình luận gốc */}
                    <form onSubmit={handleAddComment} className="mb-10 flex gap-4">
                        <div className="flex-1 flex gap-3">
                            <input
                                type="text" value={commentText} onChange={e => setCommentText(e.target.value)}
                                placeholder="Bạn nghĩ gì về bộ truyện này?" disabled={!user || isSubmitting}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 text-white outline-none focus:border-blue-500"
                            />
                            <button type="submit" disabled={!user || !commentText.trim()} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center">
                                <Send size={18} className="mr-2" /> Gửi
                            </button>
                        </div>
                    </form>

                    {/* Danh sách bình luận */}
                    <div className="space-y-6">
                        {comments.map((cmt: any) => {
                            const badge = getUserBadge(cmt.user?.role, cmt.user?.totalDeposited);
                            return (
                                <div key={cmt.id} className="animate-fade-in">

                                    {/* BÌNH LUẬN GỐC */}
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center font-bold text-white shrink-0">
                                            {cmt.user?.name?.charAt(0) || 'U'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50">
                                                <div className="flex justify-between items-center mb-1">
                                                    <div className="flex items-center flex-wrap gap-2">
                                                        <span className="font-bold text-blue-400">{cmt.user?.name}</span>
                                                        {/* HUY HIỆU CẤP BẬC */}
                                                        {badge && (
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full shadow-sm font-bold tracking-wide ${badge.style}`}>
                                                                {badge.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-slate-500">{new Date(cmt.createdAt).toLocaleDateString('vi')}</span>
                                                </div>
                                                <p className="text-slate-300 text-sm mt-1">{cmt.content}</p>
                                            </div>

                                            {/* NÚT TRẢ LỜI DƯỚI BÌNH LUẬN GỐC */}
                                            <button
                                                onClick={() => setReplyingToId(replyingToId === cmt.id ? null : cmt.id)}
                                                className="text-xs text-slate-400 hover:text-white mt-2 flex items-center ml-2 transition-colors font-medium"
                                            >
                                                <Reply size={14} className="mr-1" /> Trả lời
                                            </button>

                                            {/* Ô NHẬP TRẢ LỜI */}
                                            {replyingToId === cmt.id && (
                                                <div className="mt-3 ml-6 flex gap-2 animate-fade-in">
                                                    <input
                                                        autoFocus type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
                                                        placeholder={`Trả lời ${cmt.user?.name}...`}
                                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                                    />
                                                    <button onClick={() => handleReplySubmit(cmt.id)} disabled={!replyText.trim() || isSubmitting} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                                                        Gửi
                                                    </button>
                                                </div>
                                            )}

                                            {/* KHU VỰC HIỂN THỊ CÁC CÂU TRẢ LỜI LỒNG NHAU */}
                                            {cmt.replies && cmt.replies.length > 0 && (
                                                <div className="mt-3 ml-4 sm:ml-8 pl-4 border-l-2 border-slate-700/50 space-y-3">
                                                    {cmt.replies.map((reply: any) => {
                                                        const replyBadge = getUserBadge(reply.user?.role, reply.user?.totalDeposited);
                                                        return (
                                                            <div key={reply.id} className="flex gap-3">
                                                                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
                                                                    {reply.user?.name?.charAt(0) || 'U'}
                                                                </div>
                                                                <div className="flex-1 bg-slate-900/40 p-3 rounded-xl border border-slate-700/30">
                                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                        <span className="font-bold text-sm text-slate-300">{reply.user?.name}</span>
                                                                        {replyBadge && <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${replyBadge.style}`}>{replyBadge.name}</span>}
                                                                    </div>
                                                                    <p className="text-slate-400 text-sm">{reply.content}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>
            {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        </div>
    );
}