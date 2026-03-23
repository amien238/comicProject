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
  Share2,
  Info,
  FileImage, Send
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
  // Default to light mode to match the iOS Glassmorphism concept
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

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
        historyApi.updateHistory(resolvedComicId, chapterId).catch(() => { });
        const list = await comicApi.getChapters(resolvedComicId);
        setChapterList(Array.isArray(list) ? list : []);
      } else {
        setChapterList([]);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải chương này');
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

  // Handle scroll to update progress and hide UI automatically
  const handleScroll = useCallback(() => {
    const totalScroll = document.documentElement.scrollTop;
    const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const rawProgress = windowHeight > 0 ? totalScroll / windowHeight : 0;
    const clampedProgress = Math.max(0, Math.min(rawProgress, 1));

    setScrollProgress(clampedProgress * 100);

    // Auto-hide UI when scrolling down for immersive reading
    if (totalScroll > 150 && showUI) {
      setShowUI(false);
    }
  }, [showUI]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const currentIndex = chapterList.findIndex((c) => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? chapterList[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < chapterList.length - 1 ? chapterList[currentIndex + 1] : null;

  // iOS Glassmorphism Theme configuration
  const themeConfig = useMemo(() => {
    return theme === 'dark'
      ? {
        bg: 'bg-[#0B1120]',
        text: 'text-slate-200',
        glass: 'bg-slate-900/60 backdrop-blur-2xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
        input: 'bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 shadow-inner focus:bg-slate-800',
        bubble: 'bg-slate-800/60 backdrop-blur-md border border-slate-700/50 text-slate-300 shadow-sm',
        btnHover: 'hover:bg-slate-800',
        blobOpacity: 'opacity-20'
      }
      : {
        bg: 'bg-[#F4F7F9]',
        text: 'text-slate-800',
        glass: 'bg-white/40 backdrop-blur-2xl border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)]',
        input: 'bg-white/60 border border-white/80 text-slate-800 placeholder:text-slate-400 shadow-inner focus:bg-white',
        bubble: 'bg-white/50 backdrop-blur-md border border-white/60 text-slate-700 shadow-sm',
        btnHover: 'hover:bg-white/60',
        blobOpacity: 'opacity-100 mix-blend-multiply'
      };
  }, [theme]);

  const handleNavigate = (targetChapterId: string) => {
    if (!targetChapterId) return;
    router.push(`/read/${targetChapterId}`);
  };

  const handleToggleFavorite = async () => {
    if (!user) return alert('Vui lòng đăng nhập để yêu thích truyện');
    if (!comicId || favoriteLoading) return;

    setFavoriteLoading(true);
    try {
      const result = await interactionApi.toggleFavorite(comicId);
      setIsFavorite(Boolean(result?.isFavorite));
    } catch (err: any) {
      alert(err.message || 'Không thể cập nhật yêu thích');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent | React.MouseEvent, parentId?: string) => {
    e.preventDefault();
    if (!user) return alert('Vui lòng đăng nhập để bình luận');

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
      alert(err.message || 'Gửi bình luận thất bại');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleReportComment = async (commentId: string) => {
    if (!user) return alert('Vui lòng đăng nhập để báo cáo');
    if (!window.confirm('Bạn có chắc muốn báo cáo bình luận này?')) return;

    try {
      await interactionApi.reportComment(commentId);
      alert('Đã gửi báo cáo thành công.');
    } catch (err: any) {
      alert(err.message || 'Không thể báo cáo');
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${theme === 'dark' ? 'bg-[#0B1120]' : 'bg-[#F4F7F9]'}`}>
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${themeConfig.blobOpacity}`}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/30 blur-[100px] rounded-full" />
        </div>
        <div className="relative flex justify-center items-center z-10">
          <div className="absolute animate-ping w-16 h-16 rounded-full bg-blue-500/20"></div>
          <div className={`animate-spin h-10 w-10 border-4 border-t-blue-500 rounded-full shadow-lg ${theme === 'dark' ? 'border-slate-700' : 'border-white/50'}`} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden ${theme === 'dark' ? 'bg-[#0B1120] text-white' : 'bg-[#F4F7F9] text-slate-800'}`}>
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${themeConfig.blobOpacity}`}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-400/20 blur-[100px] rounded-full" />
        </div>

        <div className={`p-8 rounded-[2rem] max-w-md text-center border relative z-10 ${themeConfig.glass}`}>
          <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-500/20">
            <Info size={40} />
          </div>
          <h2 className="text-2xl font-bold mb-3">Chương bị khóa</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">{error}</p>
          <button
            onClick={() => router.back()}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-bold transition-all shadow-md"
          >
            Quay lại trang truyện
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${themeConfig.bg} ${themeConfig.text} min-h-screen relative font-sans transition-colors duration-500 selection:bg-blue-500/30 overflow-x-hidden`}>

      {/* iOS Background Blurred Orbs */}
      <div className={`fixed inset-0 z-0 pointer-events-none overflow-hidden transition-opacity duration-700 ${themeConfig.blobOpacity}`}>
        <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-cyan-300/40 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-pink-300/30 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] left-[20%] w-[700px] h-[500px] bg-indigo-300/30 blur-[120px] rounded-full" />
      </div>

      {/* Sleek Progress Bar at the very top */}
      <div className="fixed top-0 left-0 w-full h-1 z-[80] pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-150 ease-out rounded-r-full"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Floating Top Header (Glassmorphism Pill) */}
      <div className={`fixed top-4 left-0 w-full z-50 flex justify-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${showUI ? 'translate-y-0 opacity-100' : '-translate-y-24 opacity-0 pointer-events-none'}`}>
        <div className={`w-full max-w-4xl mx-4 rounded-full border flex items-center justify-between p-2 sm:p-2.5 transition-colors duration-500 ${themeConfig.glass}`}>

          <button
            onClick={() => router.push(`/comic/${chapterData?.chapter?.comicId || chapterData?.comic?.id}`)}
            className={`flex items-center gap-2 text-slate-500 dark:text-slate-300 hover:text-blue-500 px-4 py-2 rounded-full transition-all ${themeConfig.btnHover}`}
          >
            <ArrowLeft size={20} />
            <span className="hidden sm:block font-medium text-sm">Thoát</span>
          </button>

          <div className="flex-1 px-4 text-center overflow-hidden flex flex-col items-center">
            <h1 className="text-sm sm:text-base font-medium truncate w-full max-w-[200px] sm:max-w-md">
              {chapterData?.chapter?.comic?.title || chapterData?.comic?.title || 'Đang đọc truyện'}
            </h1>
            <p className="text-[13px] text-blue-500 dark:text-blue-400 truncate font-medium tracking-widest mt-0.5">
              {chapterData?.chapter?.title}
            </p>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 pr-2">
            <button
              onClick={handleToggleFavorite}
              disabled={favoriteLoading}
              className={`p-2.5 rounded-full transition-all ${themeConfig.btnHover} ${isFavorite ? 'text-pink-500' : 'text-slate-500 dark:text-slate-400'}`}
              title="Yêu thích truyện"
            >
              <Heart size={20} className={isFavorite ? 'fill-pink-500 drop-shadow-[0_0_5px_rgba(236,72,153,0.5)]' : ''} />
            </button>
            <button
              onClick={() => setShowComments(true)}
              className={`p-2.5 rounded-full transition-all text-slate-500 dark:text-slate-400 hover:text-blue-500 ${themeConfig.btnHover}`}
              title="Thảo luận chương"
            >
              <MessageCircle size={20} />
            </button>
            <button
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              className={`p-2.5 rounded-full transition-all text-slate-500 dark:text-slate-400 hover:text-yellow-500 ${themeConfig.btnHover}`}
              title="Đổi giao diện"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area (Images) */}
      <div
        className="relative z-10 flex flex-col items-center w-full mx-auto cursor-pointer min-h-screen pt-0 pb-32"
        onClick={() => setShowUI((prev) => !prev)}
      >
        {/* Safe space for top floating header when scrolled to top */}
        <div className="h-28 w-full"></div>

        {chapterData?.images?.length > 0 ? (
          <div className={`w-full max-w-3xl lg:max-w-4xl shadow-2xl rounded-3xl overflow-hidden border ${theme === 'dark' ? 'border-slate-800' : 'border-white/50'}`}>
            {chapterData.images.map((img: any, idx: number) => (
              <img
                key={idx}
                src={img.url}
                alt={`Trang ${img.pageNumber}`}
                loading={idx < 3 ? "eager" : "lazy"} // Load first 3 images immediately
                className={`w-full h-auto block select-none min-h-[300px] ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}
              />
            ))}
          </div>
        ) : (
          <div className={`py-40 italic flex flex-col items-center justify-center text-center px-4 rounded-[2.5rem] w-full max-w-3xl border ${themeConfig.glass}`}>
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-inner ${theme === 'dark' ? 'bg-slate-800' : 'bg-white/60'}`}>
              <FileImage size={40} className="text-slate-400 opacity-60" />
            </div>
            <span className="text-xl font-bold mb-2">Chương này chưa có nội dung</span>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tác giả có thể đang cập nhật hình ảnh. Vui lòng quay lại sau.</p>
          </div>
        )}
      </div>

      {/* Floating Bottom Navigation (Glassmorphism Pill) */}
      <div className={`fixed bottom-6 left-0 w-full z-50 flex justify-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${showUI ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0 pointer-events-none'}`}>
        <div className={`w-full max-w-xl mx-4 rounded-[2rem] border flex items-center justify-between p-2 shadow-[0_20px_40px_rgba(0,0,0,0.1)] transition-colors duration-500 ${themeConfig.glass}`}>

          <button
            onClick={() => prevChapter && handleNavigate(prevChapter.id)}
            disabled={!prevChapter}
            className={`flex items-center justify-center p-4 rounded-3xl font-bold transition-all ${prevChapter ? `text-slate-700 dark:text-slate-200 ${themeConfig.btnHover}` : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
          >
            <ChevronLeft size={24} />
          </button>

          {/* Custom Select Wrapper */}
          <div className="relative flex-1 max-w-[250px] group mx-2">
            <select
              value={chapterId}
              onChange={(e) => handleNavigate(e.target.value)}
              className={`w-full appearance-none bg-transparent border-none text-center font-bold text-sm sm:text-base py-3 px-8 rounded-2xl outline-none cursor-pointer transition-colors ${themeConfig.btnHover} ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}
            >
              {chapterList.map((c) => (
                <option key={c.id} value={c.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-medium">
                  {c.title} {c.price > 0 ? `(🔒 ${c.price})` : ''}
                </option>
              ))}
            </select>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-blue-500 transition-colors">
              <List size={16} />
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronRight size={16} className="rotate-90" />
            </div>
          </div>

          <button
            onClick={() => nextChapter && handleNavigate(nextChapter.id)}
            disabled={!nextChapter}
            className={`flex items-center justify-center p-4 rounded-3xl font-bold transition-all ${nextChapter
              ? 'bg-gradient-to-tr from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/30'
              : `text-slate-300 dark:text-slate-600 cursor-not-allowed ${themeConfig.btnHover}`
              }`}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {/* Glassmorphic Comments Sidebar Overlay */}
      <div
        className={`fixed inset-0 z-[65] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${showComments ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={() => setShowComments(false)}
      />

      {/* Glassmorphic Comments Sidebar */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-[420px] z-[70] backdrop-blur-3xl shadow-[-20px_0_40px_rgba(0,0,0,0.1)] border-l transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${showComments ? 'translate-x-0' : 'translate-x-full'} ${themeConfig.glass} ${theme === 'light' ? 'bg-white/70 border-white/80' : 'bg-slate-900/80 border-white/10'}`}>

        {/* Header */}
        <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10' : 'border-white/50'}`}>
          <h3 className="text-xl flex items-center gap-3 text-slate-800 dark:text-white">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-500">
              <MessageCircle size={20} />
            </div>
            Comment
          </h3>
          <button onClick={() => setShowComments(false)} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-slate-100 shadow-sm text-slate-500'}`}>
            <X size={20} />
          </button>
        </div>

        {/* Comment Input */}
        <form onSubmit={handlePostComment} className={`p-5 border-b ${theme === 'dark' ? 'border-white/10' : 'border-white/50'} shrink-0 relative z-10`}>
          <div className="flex gap-3">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={user ? 'Nhập bình luận của bạn...' : 'Đăng nhập để bình luận'}
              className={`flex-1 rounded-2xl px-5 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-400/50 ${themeConfig.input}`}
              disabled={!user || commentLoading}
            />
            <button
              type="submit"
              disabled={!user || commentLoading || !commentText.trim()}
              className="px-2 py-3 w-11 h-11 bg-blue-500 hover:bg-blue-600 text-white rounded-4xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(59,130,246,0.2)] shrink-0"
            >
              <Send size={25} className="ml-0.5" />
            </button>
          </div>
        </form>

        {/* Comment List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar relative z-10">
          {comments.length === 0 ? (
            <div className="text-center py-12 opacity-50 italic text-sm">Chưa có bình luận nào cho chương này. Hãy là người đầu tiên lên tiếng!</div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="animate-fade-in">
                <div className={`rounded-[1.5rem] p-5 border transition-all ${themeConfig.bubble}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-purple-500 flex items-center justify-center text-xs text-white font-black shadow-sm">
                        {comment.user?.avatar ? (
                          <img src={comment.user?.avatar} className="w-full h-full object-cover rounded-full" alt="avatar" />
                        ) :
                          ((comment.user?.name || 'U').charAt(0).toUpperCase())}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-blue-600 dark:text-blue-400 leading-none">{comment.user?.name || 'Độc giả'}</span>
                        {(() => {
                          const badge = resolveUserTier(comment.user?.role, comment.user?.totalDeposited);
                          if (!badge) return null;
                          return (
                            <span className={`text-[9px] mt-1 px-1.5 py-0.5 w-fit rounded-full tracking-wider ${badge.className} shadow-sm`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm leading-relaxed whitespace-pre-wrap ml-11">{comment.content}</div>

                  <div className="flex items-center gap-4 mt-4 ml-11">
                    <button
                      type="button"
                      onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                      className="text-[12px] text-slate-400 hover:text-blue-500 tracking-wider transition-colors"
                    >
                      Trả lời
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReportComment(comment.id)}
                      className="text-[12px] text-slate-400 hover:text-red-500 tracking-wider transition-colors"
                    >
                      Báo cáo
                    </button>
                  </div>

                  {/* Reply Input Box */}
                  {replyingTo === comment.id && (
                    <div className="mt-4 ml-11 flex gap-2 animate-fade-in">
                      <input
                        autoFocus
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Trả lời ${comment.user?.name || 'thành viên'}...`}
                        className={`flex-1 rounded-xl px-4 py-2.5 text-xs outline-none transition-all ${themeConfig.input}`}
                      />
                      <button
                        type="button"
                        disabled={!replyText.trim() || commentLoading}
                        onClick={(e) => handlePostComment(e, comment.id)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-2.5 w-10 h-9 rounded-full text-xs font-bold disabled:opacity-50 transition-all shadow-md shadow-blue-500/20"
                      >
                        <Send size={20} className="ml-0.5" />
                      </button>
                    </div>
                  )}

                  {/* Replies List */}
                  {(comment.replies || []).length > 0 && (
                    <div className={`mt-4 ml-11 pl-4 border-l-[3px] space-y-4 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200/60'}`}>
                      {comment.replies.map((reply: any) => {
                        const rBadge = resolveUserTier(reply.user?.role, reply.user?.totalDeposited);
                        return (
                          <div key={reply.id} className="text-sm">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="font-bold text-slate-700 dark:text-slate-300">{reply.user?.name || 'Độc giả'}</span>
                              {rBadge && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${rBadge.className}`}>
                                  {rBadge.label}
                                </span>
                              )}
                            </div>
                            <div className="leading-relaxed opacity-90 text-slate-600 dark:text-slate-400">{reply.content}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.4); border-radius: 10px; border: 1px solid transparent; background-clip: content-box; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(100, 116, 139, 0.6); }
            
            @keyframes fade-in {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in {
              animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `,
        }}
      />
    </div>
  );
}