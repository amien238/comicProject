"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Heart,
  List,
  MessageCircle,
  Moon,
  Sun,
  X,
} from 'lucide-react';

import { comicApi, historyApi, interactionApi, userApi } from '../../../src/services/api';
import { useAuth } from '../../../src/context/AuthContext';
import { resolveUserTier } from '../../../src/utils/userTier';

export default function ReadChapter() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const chapterId = params.chapterId as string;

  const [chapterData, setChapterData] = useState<any>(null);
  const [chapterList, setChapterList] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [showUI, setShowUI] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);

  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const comicId = chapterData?.chapter?.comicId || chapterData?.comic?.id;

  const fetchChapterAndList = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const data = await comicApi.getChapterDetail(chapterId);
      setChapterData(data);

      const resolvedComicId = data?.chapter?.comicId;
      if (resolvedComicId) {
        historyApi.updateHistory(resolvedComicId, chapterId).catch(() => {});
        const list = await comicApi.getChapters(resolvedComicId);
        setChapterList(Array.isArray(list) ? list : []);
      } else {
        setChapterList([]);
      }
    } catch (err: any) {
      setError(err.message || 'Khong the tai chuong');
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  const fetchChapterComments = useCallback(async () => {
    try {
      const commentData = await interactionApi.getChapterComments(chapterId);
      setComments(Array.isArray(commentData) ? commentData : []);
    } catch (_error) {
      setComments([]);
    }
  }, [chapterId]);

  useEffect(() => {
    fetchChapterAndList();
    fetchChapterComments();
  }, [fetchChapterAndList, fetchChapterComments]);

  useEffect(() => {
    if (!user || !comicId) {
      setIsFavorite(false);
      return;
    }

    userApi
      .getFavorites()
      .then((favorites) => {
        const list = Array.isArray(favorites) ? favorites : [];
        setIsFavorite(list.some((item: any) => item.comicId === comicId));
      })
      .catch(() => setIsFavorite(false));
  }, [user, comicId]);

  const handleScroll = useCallback(() => {
    const totalScroll = document.documentElement.scrollTop;
    const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const rawProgress = windowHeight > 0 ? totalScroll / windowHeight : 0;
    const clampedProgress = Math.max(0, Math.min(rawProgress, 1));

    setScrollProgress(clampedProgress * 100);

    if (totalScroll > 100 && showUI) {
      setShowUI(false);
    }
  }, [showUI]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const currentIndex = chapterList.findIndex((c) => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? chapterList[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < chapterList.length - 1 ? chapterList[currentIndex + 1] : null;

  const pageClass = useMemo(() => {
    return theme === 'dark' ? 'bg-[#0b1120] text-slate-100' : 'bg-slate-100 text-slate-900';
  }, [theme]);

  const handleNavigate = (targetChapterId: string) => {
    router.push(`/read/${targetChapterId}`);
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      alert('Vui long dang nhap de yeu thich truyen');
      return;
    }

    if (!comicId || favoriteLoading) return;

    setFavoriteLoading(true);
    try {
      const result = await interactionApi.toggleFavorite(comicId);
      setIsFavorite(Boolean(result?.isFavorite));
    } catch (err: any) {
      alert(err.message || 'Khong the cap nhat yeu thich');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent | React.MouseEvent, parentId?: string) => {
    e.preventDefault();
    if (!user) {
      alert('Vui long dang nhap de binh luan');
      return;
    }

    const payloadContent = parentId ? replyText : commentText;
    if (!payloadContent.trim() || commentLoading) return;

    setCommentLoading(true);
    try {
      const result = await interactionApi.addComment({
        chapterId,
        content: payloadContent,
        parentId,
      });

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
    } catch (err: any) {
      alert(err.message || 'Gui binh luan that bai');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleReportComment = async (commentId: string) => {
    if (!user) {
      alert('Vui long dang nhap de bao cao');
      return;
    }

    if (!window.confirm('Bao cao binh luan nay?')) return;

    try {
      await interactionApi.reportComment(commentId);
      alert('Da gui bao cao.');
    } catch (err: any) {
      alert(err.message || 'Khong the bao cao');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="animate-spin h-10 w-10 border-t-2 border-blue-500 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-white bg-[#0f172a]">
        <div className="bg-slate-800 p-8 rounded-2xl max-w-md text-center border border-slate-700 shadow-2xl">
          <div className="text-red-400 text-5xl mb-4">Locked</div>
          <h2 className="text-xl font-bold mb-2">Chuong bi khoa</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => router.back()}
            className="bg-blue-600 px-6 py-2 rounded-xl font-bold hover:bg-blue-500 transition-all"
          >
            Quay lai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${pageClass} min-h-screen relative font-sans selection:bg-blue-500/30`}>
      <div className="fixed top-0 left-0 h-1 bg-slate-800 z-[60] w-full">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <div className={`fixed top-0 left-0 w-full z-50 transition-transform duration-300 ease-in-out ${showUI ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 p-3 sm:p-4 flex items-center justify-between shadow-lg text-white">
          <button
            onClick={() => router.push(`/comic/${chapterData?.chapter?.comicId || chapterData?.comic?.id}`)}
            className="flex items-center text-slate-300 hover:text-white transition-colors bg-slate-800/80 p-2 sm:px-4 sm:py-2 rounded-xl"
          >
            <ArrowLeft size={20} className="sm:mr-2" />
            <span className="hidden sm:block font-bold text-sm">Ve truyen</span>
          </button>

          <div className="flex-1 px-4 text-center overflow-hidden">
            <h1 className="text-sm sm:text-base font-bold text-white truncate">
              {chapterData?.chapter?.comic?.title || chapterData?.comic?.title || 'Dang doc truyen'}
            </h1>
            <p className="text-xs text-blue-400 truncate font-medium">{chapterData?.chapter?.title}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFavorite}
              disabled={favoriteLoading}
              className="text-slate-300 hover:text-pink-400 bg-slate-800/80 p-2 rounded-xl transition-colors"
              title="Yeu thich truyen"
            >
              <Heart size={18} className={isFavorite ? 'fill-pink-400 text-pink-400' : ''} />
            </button>
            <button
              onClick={() => setShowComments(true)}
              className="text-slate-300 hover:text-white bg-slate-800/80 p-2 rounded-xl transition-colors"
              title="Comment chuong"
            >
              <MessageCircle size={18} />
            </button>
            <button
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              className="text-slate-300 hover:text-yellow-300 bg-slate-800/80 p-2 rounded-xl transition-colors"
              title="Doi che do sang toi"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </div>

      <div
        className="flex flex-col items-center w-full max-w-3xl mx-auto cursor-pointer min-h-screen pt-4 pb-24"
        onClick={() => setShowUI((prev) => !prev)}
      >
        {chapterData?.images?.length > 0 ? (
          chapterData.images.map((img: any, idx: number) => (
            <img
              key={idx}
              src={img.url}
              alt={`Trang ${img.pageNumber}`}
              loading="lazy"
              className="w-full h-auto block select-none"
            />
          ))
        ) : (
          <div className="py-32 text-slate-500 italic flex flex-col items-center">
            <span className="text-4xl mb-4">No content</span>
            Chuong nay hien chua co noi dung.
          </div>
        )}
      </div>

      <div className={`fixed bottom-0 left-0 w-full z-50 transition-transform duration-300 ease-in-out ${showUI ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] text-white">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
            <button
              onClick={() => prevChapter && handleNavigate(prevChapter.id)}
              disabled={!prevChapter}
              className={`flex-1 flex items-center justify-center p-3 rounded-xl font-bold transition-all ${
                prevChapter ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
              }`}
            >
              <ChevronLeft size={20} className="mr-1" />
              <span className="hidden sm:block">Chuong truoc</span>
            </button>

            <div className="relative flex-1 group">
              <select
                value={chapterId}
                onChange={(e) => handleNavigate(e.target.value)}
                className="w-full appearance-none bg-slate-800 border border-slate-700 text-white text-center font-bold p-3 rounded-xl outline-none cursor-pointer focus:border-blue-500 hover:bg-slate-700 transition-colors"
              >
                {chapterList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} {c.price > 0 ? `(?? ${c.price})` : ''}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <List size={18} />
              </div>
            </div>

            <button
              onClick={() => nextChapter && handleNavigate(nextChapter.id)}
              disabled={!nextChapter}
              className={`flex-1 flex items-center justify-center p-3 rounded-xl font-bold transition-all ${
                nextChapter
                  ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20'
                  : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
              }`}
            >
              <span className="hidden sm:block">Chuong sau</span>
              <ChevronRight size={20} className="ml-1" />
            </button>
          </div>
        </div>
      </div>

      {showComments && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex justify-end">
          <div className="w-full max-w-md h-full bg-slate-900 text-slate-100 border-l border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-lg">Comment chuong</h3>
              <button onClick={() => setShowComments(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePostComment} className="p-4 border-b border-slate-700 flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={user ? 'Nhap comment...' : 'Dang nhap de comment'}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                disabled={!user || commentLoading}
              />
              <button
                type="submit"
                disabled={!user || commentLoading || !commentText.trim()}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
              >
                Gui
              </button>
            </form>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {comments.length === 0 ? (
                <div className="text-slate-500 text-sm">Chua co comment nao.</div>
                      ) : (
                        comments.map((comment) => (
                          <div key={comment.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                            <div className="text-xs text-slate-300 mb-1 flex items-center gap-2">
                              <span>{comment.user?.name || 'Doc gia'}</span>
                              {(() => {
                                const badge = resolveUserTier(comment.user?.role, comment.user?.totalDeposited);
                                if (!badge) return null;
                                return (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${badge.className}`}>
                                    {badge.label}
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="text-sm text-slate-100">{comment.content}</div>

                            <button
                              type="button"
                              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                              className="mt-2 text-[11px] font-bold text-slate-400 hover:text-blue-400"
                            >
                              Tra loi
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReportComment(comment.id)}
                              className="mt-2 ml-3 text-[11px] font-bold text-slate-400 hover:text-red-400"
                            >
                              Bao cao
                            </button>

                            {replyingTo === comment.id && (
                              <div className="mt-2 flex gap-2">
                                <input
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder={`Tra loi ${comment.user?.name || 'thanh vien'}...`}
                                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs"
                                />
                                <button
                                  type="button"
                                  disabled={!replyText.trim() || commentLoading}
                                  onClick={(e) => handlePostComment(e, comment.id)}
                                  className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                                >
                                  Gui
                                </button>
                              </div>
                            )}

                            {(comment.replies || []).length > 0 && (
                              <div className="mt-2 pl-3 border-l border-slate-700 space-y-2">
                                {comment.replies.map((reply: any) => {
                                  const badge = resolveUserTier(reply.user?.role, reply.user?.totalDeposited);
                                  return (
                                    <div key={reply.id} className="text-xs text-slate-300">
                                      <span className="text-slate-400">{reply.user?.name || 'Doc gia'}: </span>
                                      {badge && (
                                        <span className={`text-[9px] px-1 py-0.5 rounded uppercase mr-1 ${badge.className}`}>
                                          {badge.label}
                                        </span>
                                      )}
                                      {reply.content}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
