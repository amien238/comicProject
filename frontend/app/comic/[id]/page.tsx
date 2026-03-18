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
  size = 20,
) => {
  return [1, 2, 3, 4, 5].map((score) => (
    <button
      key={score}
      type="button"
      onClick={() => onClick(score)}
      disabled={disabled}
      className="disabled:opacity-50"
    >
      <Star
        size={size}
        className={score <= value ? 'text-yellow-400 fill-yellow-400' : 'text-slate-500'}
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
        if (!comicData) throw new Error('Khong tim thay truyen');

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
        setErrorMsg(error.message || 'Khong the tai du lieu');
        setComic(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    if (comicId) interactionApi.incrementView(comicId).catch(() => {});
  }, [comicId, user]);

  const displayRating = useMemo(() => Number(comic?.averageRating || 0), [comic]);

  const handleBuyChapter = async (chapterId: string, price: number) => {
    if (!user) return setShowAuthModal(true);
    if (!window.confirm(`Mua chuong nay voi ${price} diem?`)) return;

    try {
      await transactionApi.buyChapter(chapterId);
      setUnlockedIds((prev) => [...prev, chapterId]);
      await refreshUser?.();
      alert('Mo khoa thanh cong');
    } catch (error: any) {
      alert(error.message || 'Mua chuong that bai');
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
      alert(error.message || 'Khong the cap nhat yeu thich');
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
      alert(error.message || 'Khong the danh gia truyen');
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
      alert(error.message || 'Gui binh luan that bai');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportComment = async (commentId: string) => {
    if (!user) return setShowAuthModal(true);
    if (!window.confirm('Bao cao binh luan nay?')) return;

    try {
      await interactionApi.reportComment(commentId);
      alert('Da gui bao cao.');
    } catch (error: any) {
      alert(error.message || 'Khong the bao cao binh luan');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="animate-spin h-10 w-10 border-t-2 border-blue-500 rounded-full" />
      </div>
    );
  }

  if (errorMsg || !comic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a] text-white p-4">
        <div className="bg-slate-800/80 p-8 rounded-3xl border border-slate-700 text-center max-w-md shadow-2xl backdrop-blur-sm">
          <AlertTriangle size={64} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Khong kha dung</h2>
          <p className="text-slate-400 mb-6">{errorMsg || 'Khong the tai truyen'}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 hover:bg-blue-500 px-8 py-2 rounded-xl font-bold transition-all"
          >
            Ve trang chu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans pb-10">
      <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => setShowAuthModal(true)} />

      <main className="max-w-6xl mx-auto p-4 sm:p-6 mt-4 animate-fade-in">
        <button onClick={() => router.push('/')} className="flex items-center text-slate-400 hover:text-white mb-6 group">
          <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Quay lai
        </button>

        <div className="bg-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-8 shadow-xl border border-slate-700/50">
          <div className="relative shrink-0">
            <img
              src={comic.coverUrl || 'https://via.placeholder.com/300x450?text=No+Image'}
              className="w-full md:w-64 aspect-[2/3] object-cover rounded-2xl shadow-lg border border-slate-700"
              alt="cover"
            />
            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-yellow-400 flex items-center border border-white/10">
              <Star size={14} className="mr-1 fill-yellow-400" /> {displayRating.toFixed(1)}
            </div>
          </div>

          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 leading-tight">{comic.title}</h1>
            <p className="text-blue-400 font-bold mb-6">Tac gia: {comic.author?.name || 'An danh'}</p>

            <div className="flex flex-wrap gap-4 mb-6 bg-slate-900/40 p-4 rounded-2xl border border-slate-700/30 w-fit">
              <div className="flex items-center gap-2 text-blue-300">
                <Eye size={16} /> {Number(comic.views || 0).toLocaleString()} views
              </div>
              <div className="flex items-center gap-2 text-pink-300">
                <Heart size={16} className={isFavorite ? 'fill-pink-400 text-pink-400' : ''} /> {favoriteCount} favorites
              </div>
              <div className="flex items-center gap-2 text-yellow-300">
                <Star size={16} className="fill-yellow-400 text-yellow-400" /> {displayRating.toFixed(1)} ({comic.ratingCount || 0})
              </div>
            </div>

            <p className="text-slate-400 leading-relaxed mb-8 text-sm sm:text-base line-clamp-6">{comic.description}</p>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              {renderStars(userScore || Math.round(displayRating), handleRateComic, ratingLoading, 22)}
              <span className="text-xs text-slate-400">Danh gia truyen</span>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => chapters[0] && router.push(`/read/${chapters[0].id}`)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-2xl font-black shadow-lg transition-all"
              >
                Doc ngay
              </button>
              <button
                onClick={handleToggleFavorite}
                disabled={favoriteLoading}
                className={`px-6 py-3.5 rounded-2xl font-bold border transition-all ${
                  isFavorite
                    ? 'bg-pink-500/20 text-pink-300 border-pink-500/50'
                    : 'bg-slate-700 hover:bg-slate-600 text-pink-300 border-slate-600'
                }`}
              >
                <Heart size={20} className={isFavorite ? 'fill-current' : ''} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center">
              <Clock className="mr-2 text-indigo-400" /> Danh sach chuong
            </h2>
            <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700 font-bold">
              {chapters.length} chuong
            </span>
          </div>

          <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {chapters.length === 0 ? (
              <div className="bg-slate-800/40 p-16 rounded-3xl text-center border border-dashed border-slate-700 text-slate-500 italic">
                Chua co chuong nao.
              </div>
            ) : (
              chapters.map((ch) => {
                const isUnlocked = unlockedIds.includes(ch.id) || ch.price === 0;
                return (
                  <div
                    key={ch.id}
                    onClick={() => (isUnlocked ? router.push(`/read/${ch.id}`) : handleBuyChapter(ch.id, ch.price))}
                    className="bg-slate-800/60 hover:bg-slate-700 rounded-2xl p-4 flex justify-between items-center transition-all border border-slate-700/50 cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center font-bold text-slate-600 group-hover:text-blue-400 transition-colors">
                        {ch.orderNumber}
                      </div>
                      <h4 className="font-bold text-slate-200 group-hover:text-white transition-colors">{ch.title}</h4>
                    </div>
                    {isUnlocked ? (
                      <span className="text-green-500 text-[10px] font-black uppercase tracking-widest bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20 flex items-center">
                        <Unlock size={12} className="mr-1.5" /> Da mo
                      </span>
                    ) : (
                      <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-4 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5">
                        <Lock size={12} /> {ch.price} diem
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-16 bg-slate-800/50 rounded-3xl p-6 sm:p-8 border border-slate-700/50 shadow-xl backdrop-blur-sm">
          <h2 className="text-2xl font-bold mb-8 flex items-center">
            <MessageSquare className="mr-3 text-blue-500" /> Thao luan
          </h2>

          <form onSubmit={(e) => handlePostComment(e)} className="mb-12 flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white shadow-lg shrink-0">
              {(user?.name || 'U').charAt(0)}
            </div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={user ? 'Nhap binh luan...' : 'Dang nhap de binh luan'}
                disabled={!user || submitting}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-5 py-3 text-sm text-white outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!user || submitting || !commentText.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-2xl font-bold transition-all disabled:opacity-50"
              >
                Gui
              </button>
            </div>
          </form>

          <div className="space-y-8">
            {comments.length === 0 ? (
              <div className="text-center py-10 text-slate-500 italic">Chua co binh luan nao.</div>
            ) : (
              comments.map((cmt: any) => {
                const badge = resolveUserTier(cmt.user?.role, cmt.user?.totalDeposited);
                return (
                  <div key={cmt.id}>
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center font-bold text-white shrink-0">
                        {(cmt.user?.name || 'U').charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="bg-slate-900/40 border border-slate-700/50 p-4 rounded-2xl rounded-tl-none">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-blue-400">{cmt.user?.name || 'Doc gia'}</span>
                              {badge && (
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${badge.className}`}>
                                  {badge.label}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500">{new Date(cmt.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                          <p className="text-slate-300 text-sm">{cmt.content}</p>
                        </div>

                        <div className="mt-2 ml-2 flex gap-3">
                          <button
                            type="button"
                            onClick={() => setReplyingTo(replyingTo === cmt.id ? null : cmt.id)}
                            className="text-[11px] font-black text-slate-500 hover:text-blue-400 flex items-center gap-1.5 transition-colors"
                          >
                            <Reply size={12} /> TRA LOI
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReportComment(cmt.id)}
                            className="text-[11px] font-black text-slate-500 hover:text-red-400 transition-colors"
                          >
                            BAO CAO
                          </button>
                        </div>

                        {replyingTo === cmt.id && (
                          <div className="mt-3 ml-6 flex gap-2">
                            <input
                              autoFocus
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder={`Tra loi ${cmt.user?.name || 'thanh vien'}...`}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={(e) => handlePostComment(e, cmt.id)}
                              disabled={!replyText.trim() || submitting}
                              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                            >
                              Gui
                            </button>
                          </div>
                        )}

                        {(cmt.replies || []).length > 0 && (
                          <div className="mt-4 ml-6 sm:ml-10 border-l-2 border-slate-800 pl-4 space-y-4">
                            {cmt.replies.map((reply: any) => {
                              const rBadge = resolveUserTier(reply.user?.role, reply.user?.totalDeposited);
                              return (
                                <div key={reply.id} className="flex gap-3">
                                  <div className="w-8 h-8 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                                    {(reply.user?.name || 'U').charAt(0)}
                                  </div>
                                  <div className="flex-1 bg-slate-900/20 p-3 rounded-xl border border-slate-800/50">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-bold text-xs text-slate-400">{reply.user?.name || 'Doc gia'}</span>
                                      {rBadge && (
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${rBadge.className}`}>
                                          {rBadge.label}
                                        </span>
                                      )}
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
                );
              })
            )}
          </div>
        </div>
      </main>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 5px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
          `,
        }}
      />
    </div>
  );
}
