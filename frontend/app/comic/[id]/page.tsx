"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Eye,
  Heart,
  Lock,
  MessageSquare,
  Reply,
  Star,
  Unlock,
  Share2, Send
} from 'lucide-react';

import Navbar from '../../../src/components/NavBar';
import AuthModal from '../../../src/components/AuthModal';
import { comicApi, interactionApi, transactionApi, userApi } from '../../../src/services/api';
import { useAuth } from '../../../src/context/AuthContext';
import { resolveUserTier } from '../../../src/utils/userTier';

const renderStars = (
  value: number,
  onClick: (score: number) => void,
  disabled = false,
  size = 24,
) => {
  return [1, 2, 3, 4, 5].map((score) => (
    <button
      key={score}
      type="button"
      onClick={() => onClick(score)}
      disabled={disabled}
      className="disabled:opacity-50 hover:scale-110 transition-transform focus:outline-none"
    >
      <Star
        size={size}
        className={score <= value ? 'text-yellow-400 fill-yellow-400 drop-shadow-sm' : 'text-slate-300'}
      />
    </button>
  ));
};

export default function ComicDetail() {
  const params = useParams();
  const router = useRouter();
  const comicId = params?.id as string;

  const { user, refreshUser } = useAuth();

  const [comic, setComic] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);

  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [userScore, setUserScore] = useState(0);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const [ratingLoading, setRatingLoading] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!comicId) return;

      try {
        setLoading(true);
        setErrorMsg(null);

        const comicData = await comicApi.getComicById(comicId);
        if (!comicData) throw new Error('Không tìm thấy truyện');

        const [chapterData, commentData] = await Promise.all([
          comicApi.getChapters(comicId).catch(() => []),
          interactionApi.getComments(comicId).catch(() => []),
        ]);

        setComic(comicData);
        setChapters(Array.isArray(chapterData) ? chapterData : []);
        setComments(Array.isArray(commentData) ? commentData : []);
        setFavoriteCount(Number(comicData.favoriteCount || 0));

        if (user) {
          const [unlocked, favorites] = await Promise.all([
            userApi.getUnlockedChapters().catch(() => []),
            userApi.getFavorites().catch(() => []),
          ]);

          const unlockedList = Array.isArray(unlocked) ? unlocked : [];
          const favoriteList = Array.isArray(favorites) ? favorites : [];

          setUnlockedIds(unlockedList.map((item: any) => item.chapterId));
          setIsFavorite(favoriteList.some((fav: any) => fav.comicId === comicId));
        } else {
          setUnlockedIds([]);
          setIsFavorite(false);
        }
      } catch (error: any) {
        setErrorMsg(error.message || 'Không thể tải dữ liệu');
        setComic(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    if (comicId) interactionApi.incrementView(comicId).catch(() => { });
  }, [comicId, user]);

  const displayRating = useMemo(() => Number(comic?.averageRating || 0), [comic]);

  const handleBuyChapter = async (chapterId: string, price: number) => {
    if (!user) return setShowAuthModal(true);
    if (!window.confirm(`Mở khóa chương này với ${price} điểm?`)) return;

    try {
      await transactionApi.buyChapter(chapterId);
      setUnlockedIds((prev) => [...prev, chapterId]);
      await refreshUser?.();
      // Optionally use a toast instead of alert for better UX
      alert('Mở khóa thành công!');
    } catch (error: any) {
      alert(error.message || 'Mua chương thất bại');
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) return setShowAuthModal(true);
    if (favoriteLoading) return;

    setFavoriteLoading(true);
    try {
      const data = await interactionApi.toggleFavorite(comicId);
      setIsFavorite(Boolean(data?.isFavorite));
      if (typeof data?.favoriteCount === 'number') {
        setFavoriteCount(data.favoriteCount);
      } else {
        setFavoriteCount((prev) => (data?.isFavorite ? prev + 1 : Math.max(prev - 1, 0)));
      }
    } catch (error: any) {
      alert(error.message || 'Không thể cập nhật yêu thích');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleRateComic = async (score: number) => {
    if (!user) return setShowAuthModal(true);
    if (ratingLoading) return;

    setRatingLoading(true);
    try {
      const data = await interactionApi.rateComic(comicId, score);
      setUserScore(score);
      setComic((prev: any) => ({
        ...prev,
        averageRating: Number(data?.averageRating || prev?.averageRating || 0),
      }));
    } catch (error: any) {
      alert(error.message || 'Không thể đánh giá truyện');
    } finally {
      setRatingLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent | React.MouseEvent, parentId?: string) => {
    e.preventDefault();

    if (!user) return setShowAuthModal(true);
    const content = parentId ? replyText : commentText;
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const result = await interactionApi.addComment({ comicId, content, parentId });
      if (parentId) {
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === parentId
              ? { ...comment, replies: [...(comment.replies || []), result.comment] }
              : comment,
          ),
        );
        setReplyText('');
        setReplyingTo(null);
      } else {
        setComments((prev) => [{ ...result.comment, replies: [] }, ...prev]);
        setCommentText('');
      }
    } catch (error: any) {
      alert(error.message || 'Gửi bình luận thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportComment = async (commentId: string) => {
    if (!user) return setShowAuthModal(true);
    if (!window.confirm('Bạn có chắc muốn báo cáo bình luận này?')) return;

    try {
      await interactionApi.reportComment(commentId);
      alert('Đã gửi báo cáo thành công.');
    } catch (error: any) {
      alert(error.message || 'Không thể báo cáo bình luận');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="relative flex justify-center items-center">
          <div className="absolute animate-ping w-16 h-16 rounded-full bg-blue-400/40"></div>
          <div className="animate-spin h-10 w-10 border-4 border-white/50 border-t-blue-500 rounded-full shadow-lg" />
        </div>
      </div>
    );
  }

  if (errorMsg || !comic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4 relative overflow-hidden">
        {/* Pastel Blur Backgrounds */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-300/30 blur-[100px] rounded-full pointer-events-none" />

        <div className="bg-white/60 p-8 rounded-[2rem] border border-white/80 text-center max-w-md shadow-[0_8px_32px_rgba(0,0,0,0.05)] backdrop-blur-2xl relative z-10">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-100">
            <AlertTriangle size={40} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-slate-800">Oops! Đã có lỗi xảy ra</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">{errorMsg || 'Không thể tải thông tin truyện lúc này. Vui lòng thử lại sau.'}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-white hover:bg-slate-50 text-slate-800 px-8 py-3.5 rounded-2xl font-bold transition-all border border-slate-200 shadow-sm"
          >
            Quay về trang chủ
          </button>
        </div>
      </div>
    );
  }


  return (
    <div>
      <div className="relative z-90">
        <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => setShowAuthModal(true)} />
      </div>

      <div className="min-h-screen bg-[#F4F7F9] text-slate-800 font-sans pb-20 relative overflow-hidden">
        {/* iOS Glassmorphism Vibe - Pastel Animated Orbs */}
        <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-cyan-300/30 blur-[120px] rounded-full pointer-events-none mix-blend-multiply" />
        <div className="absolute top-[10%] right-[-5%] w-[500px] h-[500px] bg-pink-300/20 blur-[120px] rounded-full pointer-events-none mix-blend-multiply" />
        <div className="absolute bottom-[20%] left-[20%] w-[700px] h-[500px] bg-indigo-300/20 blur-[120px] rounded-full pointer-events-none mix-blend-multiply" />

        <div className='gap-7 h-15' />

        <main className="max-w-6xl mx-auto p-4 sm:p-6 mt-6 relative z-10 animate-fade-in">
          {/* Hero Section - Glassmorphism Card */}
          <div className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 flex flex-col md:flex-row gap-8 lg:gap-12 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/60 relative">

            {/* Cover Image */}
            <div className="relative shrink-0 mx-auto md:mx-0 group">
              <img
                src={comic.coverUrl || 'https://via.placeholder.com/300x450?text=No+Image'}
                className="w-56 md:w-72 aspect-[2/3] object-cover rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] border border-white group-hover:scale-[1.02] transition-transform duration-500"
                alt={comic.title}
              />
              <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs text-slate-800 flex items-center border border-white shadow-md">
                <Star size={14} className="mr-1 fill-yellow-400 text-yellow-400" />
                {displayRating.toFixed(1)}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="mb-3 flex items-center gap-3 flex-wrap">
                <span className="bg-blue-100/80 text-blue-600 border border-blue-200/50 px-3 py-1 rounded-xl text-xs tracking-wider backdrop-blur-sm shadow-sm">
                  Đang tiến hành
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl text-slate-900 mb-4 leading-tight tracking-tight">
                {comic.title}
              </h1>

              <p className="text-slate-500 font-medium mb-6 flex items-center gap-2">
                Tác giả: <span className="text-blue-600">{comic.author?.name || 'Đang cập nhật'}</span>
              </p>

              {/* Stats Pills - Frosted Glass */}
              <div className="flex flex-wrap gap-3 mb-8">
                <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md px-4 py-2.5 rounded-3xl border border-white/60 text-slate-600 font-medium shadow-sm">
                  <Eye size={18} className="text-blue-500" />
                  {Number(comic.views || 0).toLocaleString()} <span className="hidden sm:inline">lượt xem</span>
                </div>
                <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md px-4 py-2.5 rounded-3xl border border-white/60 text-slate-600 font-medium shadow-sm">
                  <Heart size={18} className={isFavorite ? 'fill-pink-500 text-pink-500' : 'text-pink-400'} />
                  {favoriteCount} <span className="hidden sm:inline">yêu thích</span>
                </div>
                <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md px-4 py-2.5 rounded-3xl border border-white/60 text-slate-600 font-medium shadow-sm">
                  <Star size={18} className="fill-yellow-400 text-yellow-400" />
                  {displayRating.toFixed(1)} <span className="text-slate-400 text-sm">({comic.ratingCount || 0})</span>
                </div>
              </div>

              <div className="bg-white/30 backdrop-blur-sm p-5 sm:p-6 rounded-3xl border border-white/50 mb-8 shadow-inner">
                <p className="text-slate-600 leading-relaxed text-sm sm:text-base line-clamp-4 hover:line-clamp-none transition-all duration-300 cursor-pointer">
                  {comic.description || 'Chưa có mô tả cho truyện này.'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-auto">
                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => chapters[0] && router.push(`/read/${chapters[0].id}`)}
                    className="flex-1 sm:flex-none bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium px-8 py-4 rounded-4xl shadow-[0_8px_20px_rgba(59,130,246,0.25)] hover:shadow-[0_10px_25px_rgba(59,130,246,0.35)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                  >
                    <Clock size={20} /> Đọc Ngay
                  </button>
                  <button
                    onClick={handleToggleFavorite}
                    disabled={favoriteLoading}
                    className={`px-5 py-4 w-15 h-15 rounded-4xl font-bold border transition-all flex items-center justify-center hover:-translate-y-0.5 shadow-sm ${isFavorite
                      ? 'bg-pink-50 text-pink-500 border-pink-200 shadow-pink-100'
                      : 'bg-white/60 hover:bg-white text-slate-600 border-white/80'
                      }`}
                    title="Thêm vào yêu thích"
                  >
                    <Heart size={24} className={isFavorite ? 'fill-current' : ''} />
                  </button>
                  <button
                    className="px-5 py-4 w-15 h-15 rounded-4xl border bg-white/60 hover:bg-white text-slate-600 border-white/80 transition-all hover:-translate-y-0.5 shadow-sm"
                    title="Chia sẻ"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      alert("Đã sao chép đường dẫn!");
                    }}
                  >
                    <Share2 size={24} />
                  </button>
                </div>

                <div className="flex flex-col items-center sm:items-start pt-4 sm:pt-0 sm:pl-6 w-full sm:w-auto">
                  <span className="text-xs text-slate-400 mb-2 tracking-wider">Đánh giá của bạn</span>
                  <div className="flex items-center gap-1.5">
                    {renderStars(userScore || Math.round(displayRating), handleRateComic, ratingLoading, 24)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chapter List Section */}
          <div className="mt-12 bg-white/10 backdrop-blur-4xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2.5rem] p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <h2 className="text-xl flex items-center text-slate-900">
                <span className="w-2 h-8 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full mr-3 shadow-sm"></span>
                Danh sách chương
              </h2>
              <div className="flex items-center gap-3">
                <span className="bg-white/60 text-slate-600 px-4 py-2 rounded-4xl border border-white text-sm shadow-sm backdrop-blur-sm">
                  Tổng: <span className="text-blue-600">{chapters.length}</span> chương
                </span>
              </div>
            </div>

            <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {chapters.length === 0 ? (
                <div className="p-16 text-center text-slate-400 font-medium flex flex-col items-center bg-white/30 rounded-3xl border border-white/40">
                  <Clock size={48} className="mb-4 text-slate-300" />
                  Truyện đang được cập nhật chương mới.
                </div>
              ) : (
                chapters.map((ch) => {
                  const isUnlocked = unlockedIds.includes(ch.id) || ch.price === 0;
                  return (
                    <div
                      key={ch.id}
                      onClick={() => (isUnlocked ? router.push(`/read/${ch.id}`) : handleBuyChapter(ch.id, ch.price))}
                      className="group bg-white/50 hover:bg-white/90 rounded-2xl p-4 flex justify-between items-center transition-all duration-300 border border-white/60 shadow-sm cursor-pointer hover:shadow-md"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-4xl flex items-center justify-center text-slate-500 font-black group-hover:text-blue-500 transition-all border border-slate-100 shadow-sm">
                          {ch.orderNumber}
                        </div>
                        <h4 className="text-slate-700 font-medium group-hover:text-slate-900 transition-colors text-base sm:text-lg truncate max-w-[200px] sm:max-w-md">
                          {ch.title}
                        </h4>
                      </div>

                      <div className="shrink-0 ml-4">
                        {isUnlocked ? (
                          <span className="text-green-600 text-xs tracking-widest bg-green-100/80 px-3.5 py-2 rounded-4xl border border-green-200 flex items-center shadow-sm">
                            <Unlock size={14} className="mr-1.5" /> Đã mở
                          </span>
                        ) : (
                          <span className="bg-orange-100/80 text-orange-600 border border-orange-200 px-4 py-2 rounded-4xl text-xs flex items-center gap-1.5 shadow-sm group-hover:bg-orange-100 transition-colors">
                            <Lock size={14} /> {ch.price} Điểm
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="mt-12 bg-white/40 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative overflow-hidden">

            <h2 className="text-2xl mb-8 flex items-center text-slate-900 relative z-10">
              <MessageSquare className="mr-3 text-blue-500" size={28} /> Thảo luận
            </h2>

            <form onSubmit={(e) => handlePostComment(e)} className="mb-12 flex gap-4 relative z-10">
              <div className="w-12 h-12 rounded-4xl bg-gradient-to-tr from-blue-400 to-indigo-500 flex items-center justify-center text-white shadow-md shrink-0 border border-white/50">
                {user?.avatar ? (
                  <img src={user?.avatar} className="w-full h-full object-cover rounded-full" alt="avatar" />
                ) :
                  ((user?.name || 'U').charAt(0).toUpperCase())}
              </div>
              <div className="flex-1 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative group">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={user ? 'Chia sẻ cảm nghĩ của bạn...' : 'Đăng nhập để bình luận'}
                    disabled={!user || submitting}
                    className="w-full bg-white/60 border border-white/80 rounded-2xl px-5 py-3.5 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-400/50 transition-all placeholder:text-slate-400 shadow-inner"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!user || submitting || !commentText.trim()}
                  className="px-2 py-3 w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-4xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(59,130,246,0.2)] shrink-0"
                >
                  <Send size={30} className="ml-0.5" />
                </button>
              </div>
            </form>

            <div className="space-y-6 relative z-10">
              {comments.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-white/40 rounded-3xl border border-dashed border-white/80 font-medium">
                  Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nghĩ!
                </div>
              ) : (
                comments.map((cmt: any) => {
                  const badge = resolveUserTier(cmt.user?.role, cmt.user?.totalDeposited);
                  return (
                    <div key={cmt.id} className="animate-fade-in">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-white border border-slate-200 rounded-4xl flex items-center justify-center font-bold text-slate-500 shrink-0 shadow-sm">
                          {cmt.user?.avatar ? (
                            <img src={cmt.user?.avatar} className="w-full h-full object-cover rounded-full" alt="avatar" />
                          ) :
                            ((cmt.user?.name || 'U').charAt(0).toUpperCase())}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="bg-white/50 border border-white/80 p-4 rounded-2xl rounded-tl-none shadow-sm backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-blue-600 hover:underline cursor-pointer">{cmt.user?.name || 'Độc giả'}</span>
                                {badge && (
                                  <span className={`text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider ${badge.className} shadow-sm`}>
                                    {badge.label}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium bg-slate-100/80 px-2 py-1 rounded-md">
                                {new Date(cmt.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap break-words">{cmt.content}</p>
                          </div>

                          <div className="mt-2.5 ml-2 flex gap-4">
                            <button
                              type="button"
                              onClick={() => setReplyingTo(replyingTo === cmt.id ? null : cmt.id)}
                              className="text-[15px] text-slate-400 hover:text-blue-500 flex items-center gap-1.5 transition-colors tracking-wider"
                            >
                              <Reply size={17} /> Trả lời
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReportComment(cmt.id)}
                              className="text-[15px] text-slate-400 hover:text-red-500 transition-colors tracking-wider"
                            >
                              Báo cáo
                            </button>
                          </div>

                          {/* Box nhập Reply */}
                          {replyingTo === cmt.id && (
                            <div className="mt-3 ml-2 flex gap-3 animate-fade-in">
                              <input
                                autoFocus
                                type="text"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder={`Trả lời ${cmt.user?.name || 'thành viên'}...`}
                                className="flex-1 bg-white/70 border border-white/80 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-400/50 transition-all shadow-inner"
                              />
                              <button
                                type="button"
                                onClick={(e) => handlePostComment(e, cmt.id)}
                                disabled={!replyText.trim() || submitting}
                                className="px-2 py-3 w-11 h-11 bg-blue-500 hover:bg-blue-600 text-white rounded-4xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(59,130,246,0.2)] shrink-0"
                              >
                                <Send size={28} className="ml-0.5" />
                              </button>
                            </div>
                          )}

                          {/* List Replies */}
                          {(cmt.replies || []).length > 0 && (
                            <div className="mt-4 ml-4 sm:ml-8 border-l-[3px] border-slate-200/50 pl-4 sm:pl-6 space-y-4">
                              {cmt.replies.map((reply: any) => {
                                const rBadge = resolveUserTier(reply.user?.role, reply.user?.totalDeposited);
                                return (
                                  <div key={reply.id} className="flex gap-3 relative">
                                    {/* Connector line for nested UI */}
                                    <div className="absolute -left-[28px] top-4 w-5 h-[3px] bg-slate-200/50 hidden sm:block rounded-r-full"></div>
                                    <div className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-[11px] font-bold text-slate-400 shrink-0 shadow-sm">
                                      {reply.user?.avatar ? (
                                        <img src={reply.user?.avatar} className="w-full h-full object-cover rounded-full" alt="avatar" />
                                      ) :
                                        ((reply.user?.name || 'U').charAt(0).toUpperCase())}
                                    </div>
                                    <div className="flex-1 bg-white/40 backdrop-blur-sm p-3.5 rounded-2xl rounded-tl-none border border-white/80 shadow-sm">
                                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <span className="font-bold text-xs text-blue-600">{reply.user?.name || 'Độc giả'}</span>
                                        {rBadge && (
                                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md uppercase ${rBadge.className}`}>
                                            {rBadge.label}
                                          </span>
                                        )}
                                        <span className="text-[9px] text-slate-400 ml-auto bg-slate-100/50 px-1.5 py-0.5 rounded">
                                          {new Date(reply.createdAt).toLocaleDateString('vi-VN')}
                                        </span>
                                      </div>
                                      <p className="text-slate-600 text-sm leading-relaxed">{reply.content}</p>
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
                })
              )}
            </div>
          </div>
        </main>
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.3); border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.5); border-radius: 10px; border: 1px solid rgba(255,255,255,0.5); }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.6); }
            
            @keyframes fade-in {
              from { opacity: 0; transform: translateY(15px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in {
              animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `,
        }}
      />
    </div>
  );
}