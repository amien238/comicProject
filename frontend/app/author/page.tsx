"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Upload,
  BookOpen,
  FileImage,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Tags,
  GripVertical,
  Save,
  Settings2,
  Image as ImageIcon,
  Archive
} from 'lucide-react';

import Navbar from '../../src/components/NavBar';
import { useAuth } from '../../src/context/AuthContext';
import { authorApi, comicApi, tagApi, uploadApi } from '../../src/services/api';

type AuthorTab = 'comic' | 'chapter' | 'manage' | 'tags';

const moveItem = <T,>(items: T[], from: number, to: number): T[] => {
  const cloned = [...items];
  const [item] = cloned.splice(from, 1);
  cloned.splice(to, 0, item);
  return cloned;
};

export default function AuthorDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  

  const [activeTab, setActiveTab] = useState<AuthorTab>('comic');
  const [loading, setLoading] = useState(false);

  const [allTags, setAllTags] = useState<any[]>([]);
  const [myTags, setMyTags] = useState<any[]>([]);
  const [myComics, setMyComics] = useState<any[]>([]);
  const [manageChapters, setManageChapters] = useState<any[]>([]);

  // Create Comic State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newComicStatus, setNewComicStatus] = useState<'PUBLISHED' | 'HIDDEN'>('PUBLISHED');

  // Create Chapter State
  const [selectedComicId, setSelectedComicId] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [orderNumber, setOrderNumber] = useState(1);
  const [price, setPrice] = useState(0);
  const [newChapterStatus, setNewChapterStatus] = useState<'PUBLISHED' | 'HIDDEN'>('PUBLISHED');
  const [newChapterHiddenReason, setNewChapterHiddenReason] = useState('');
  const [chapterFiles, setChapterFiles] = useState<File[]>([]);
  const [draggingFileIndex, setDraggingFileIndex] = useState<number | null>(null);

  // Manage State
  const [manageComicId, setManageComicId] = useState('');
  const [chapterImageManagerId, setChapterImageManagerId] = useState('');
  const [chapterImages, setChapterImages] = useState<any[]>([]);
  const [draggingImageIndex, setDraggingImageIndex] = useState<number | null>(null);
  const [savingImageOrder, setSavingImageOrder] = useState(false);

  // Tags State
  const [newTagName, setNewTagName] = useState('');
  const [newTagDescription, setNewTagDescription] = useState('');

  const canAccess = user && (user.role === 'AUTHOR' || user.role === 'ADMIN');

  const selectedManageComic = useMemo(
    () => myComics.find((comic) => comic.id === manageComicId) || null,
    [myComics, manageComicId],
  );

  const loadDashboardData = async () => {
    if (!canAccess) return;

    setLoading(true);
    try {
      const [comics, tags, createdTags] = await Promise.all([
        authorApi.getMyComics().catch(() => []),
        tagApi.getAllTags({ includeHidden: true }).catch(() => []),
        tagApi.getMyTags().catch(() => []),
      ]);

      const safeComics = Array.isArray(comics) ? comics : [];
      setMyComics(safeComics);
      setAllTags(Array.isArray(tags) ? tags : []);
      setMyTags(Array.isArray(createdTags) ? createdTags : []);

      if (safeComics.length > 0 && !selectedComicId) {
        setSelectedComicId(safeComics[0].id);
      }

      if (safeComics.length > 0 && !manageComicId) {
        setManageComicId(safeComics[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [canAccess]);

  useEffect(() => {
    const loadChaptersForManage = async () => {
      if (!manageComicId) {
        setManageChapters([]);
        return;
      }

      const chapters = await comicApi.getChapters(manageComicId, { includeHidden: true }).catch(() => []);
      setManageChapters(Array.isArray(chapters) ? chapters : []);
    };

    loadChaptersForManage();
  }, [manageComicId]);

  if (!canAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7F9] p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-300/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="bg-white/60 p-8 rounded-[2rem] border border-white/80 text-center max-w-md shadow-xl backdrop-blur-2xl relative z-10">
          <h2 className="text-2xl font-bold mb-4 text-slate-800">Truy cập bị từ chối</h2>
          <p className="text-slate-500 mb-8">Khu vực này chỉ dành cho Tác giả hoặc Quản trị viên.</p>
          <button onClick={() => router.push('/')} className="w-full bg-blue-500 hover:bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-bold transition-all shadow-md">
            Về Trang Chủ
          </button>
        </div>
      </div>
    );
  }

  const handleCreateComic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverFile) return alert('Vui lòng chọn ảnh bìa');

    setLoading(true);
    try {
      const uploadRes = await uploadApi.uploadSingle(coverFile);
      const coverUrl = uploadRes.imageUrl;

      await authorApi.createComic({
        title,
        description,
        coverUrl,
        tagIds: selectedTags,
        status: newComicStatus,
      });

      alert('Tạo truyện thành công!');
      setTitle('');
      setDescription('');
      setCoverFile(null);
      setSelectedTags([]);
      setNewComicStatus('PUBLISHED');
      await loadDashboardData();
    } catch (error: any) {
      alert(error.message || 'Tạo truyện thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleChapterFiles = (files: FileList | null) => {
    if (!files) return setChapterFiles([]);
    setChapterFiles(Array.from(files));
  };

  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedComicId) return alert('Vui lòng chọn bộ truyện');
    if (chapterFiles.length === 0) return alert('Vui lòng chọn ít nhất 1 ảnh');

    setLoading(true);
    try {
      const uploadRes = await uploadApi.uploadMultiple(chapterFiles);
      const imageUrls = uploadRes.imageUrls;

      await authorApi.createChapter({
        comicId: selectedComicId,
        title: chapterTitle,
        orderNumber: Number(orderNumber),
        price: Number(price),
        images: imageUrls,
        status: newChapterStatus,
        hiddenReason: newChapterStatus === 'HIDDEN' ? newChapterHiddenReason : undefined,
      });

      alert('Tạo chương thành công!');
      setChapterTitle('');
      setOrderNumber(orderNumber + 1);
      setPrice(0);
      setNewChapterStatus('PUBLISHED');
      setNewChapterHiddenReason('');
      setChapterFiles([]);

      if (manageComicId === selectedComicId) {
        const chapters = await comicApi.getChapters(selectedComicId, { includeHidden: true }).catch(() => []);
        setManageChapters(Array.isArray(chapters) ? chapters : []);
      }
    } catch (error: any) {
      alert(error.message || 'Tạo chương thất bại');
    } finally {
      setLoading(false);
    }
  };

  const updateComicStatus = async (comicId: string, status: 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED') => {
    const hiddenReason = status === 'HIDDEN' ? window.prompt('Lý do ẩn truyện (tùy chọn):') || undefined : undefined;

    try {
      await authorApi.updateComic(comicId, {
        status,
        hiddenReason,
      });
      await loadDashboardData();
    } catch (error: any) {
      alert(error.message || 'Không cập nhật được trạng thái truyện');
    }
  };

  const deleteComic = async (comicId: string) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa truyện này?')) return;

    try {
      await authorApi.deleteComic(comicId);
      if (manageComicId === comicId) {
        setManageComicId('');
        setManageChapters([]);
      }
      await loadDashboardData();
    } catch (error: any) {
      alert(error.message || 'Xóa truyện thất bại');
    }
  };

  const updateChapterStatus = async (chapterId: string, status: 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED') => {
    const hiddenReason = status === 'HIDDEN' ? window.prompt('Lý do ẩn chương (tùy chọn):') || undefined : undefined;

    try {
      await authorApi.updateChapter(chapterId, { status, hiddenReason });
      const chapters = await comicApi.getChapters(manageComicId, { includeHidden: true }).catch(() => []);
      setManageChapters(Array.isArray(chapters) ? chapters : []);
    } catch (error: any) {
      alert(error.message || 'Không cập nhật được trạng thái chương');
    }
  };

  const deleteChapter = async (chapterId: string) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa chương này?')) return;

    try {
      await authorApi.deleteChapter(chapterId);
      const chapters = await comicApi.getChapters(manageComicId, { includeHidden: true }).catch(() => []);
      setManageChapters(Array.isArray(chapters) ? chapters : []);
    } catch (error: any) {
      alert(error.message || 'Xóa chương thất bại');
    }
  };

  const openImageManager = async (chapterId: string) => {
    try {
      const detail = await comicApi.getChapterDetail(chapterId);
      const images = Array.isArray(detail?.images) ? [...detail.images].sort((a, b) => a.pageNumber - b.pageNumber) : [];
      setChapterImageManagerId(chapterId);
      setChapterImages(images);
    } catch (error: any) {
      alert(error.message || 'Không tải được danh sách ảnh chương');
    }
  };

  const saveImageOrder = async () => {
    if (!chapterImageManagerId || chapterImages.length === 0) return;

    setSavingImageOrder(true);
    try {
      await authorApi.updateChapter(chapterImageManagerId, {
        imageOrder: chapterImages.map((img) => img.id),
      });
      alert('Đã lưu thứ tự ảnh!');
      await openImageManager(chapterImageManagerId);
    } catch (error: any) {
      alert(error.message || 'Lưu thứ tự ảnh thất bại');
    } finally {
      setSavingImageOrder(false);
    }
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;

    try {
      await tagApi.createTag({ name: newTagName.trim(), description: newTagDescription.trim() || undefined });
      setNewTagName('');
      setNewTagDescription('');
      await loadDashboardData();
      alert("Tạo tag thành công!");
    } catch (error: any) {
      alert(error.message || 'Tạo tag thất bại');
    }
  };

  const updateTag = async (tagId: string, payload: any) => {
    try {
      await tagApi.updateTag(tagId, payload);
      await loadDashboardData();
    } catch (error: any) {
      alert(error.message || 'Cập nhật tag thất bại');
    }
  };

  const deleteTag = async (tagId: string) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa tag này?')) return;

    try {
      await tagApi.deleteTag(tagId);
      await loadDashboardData();
    } catch (error: any) {
      alert(error.message || 'Xóa tag thất bại');
    }
  };

  // Helper Input Class
  const inputClass = "w-full px-4 py-3 bg-white/60 border border-slate-200/80 rounded-2xl text-slate-700 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner placeholder:text-slate-400";

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
        <div className='h-20' />

        <div className="relative z-10">
          <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => { }} />
        </div>

        <main className="max-w-5xl mx-auto p-4 sm:p-6 mt-4 relative z-10 animate-fade-in">
          <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-6 sm:p-8 mb-8 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-400/20 blur-[60px] rounded-full pointer-events-none" />
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/30 shrink-0">
              <Upload size={28} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Khu vực Tác giả</h1>
              <p className="text-slate-500 text-sm mt-1">Quản lý và xuất bản các tác phẩm của bạn</p>
            </div>
          </div>

          {/* Segmented Control Tabs */}
          <div className="flex p-1.5 bg-white/40 backdrop-blur-xl rounded-4xl border border-white/60 mb-8 overflow-x-auto shadow-sm no-scrollbar">
            <button
              onClick={() => setActiveTab('comic')}
              className={`flex-1 flex items-center justify-center whitespace-nowrap min-w-[120px] gap-2 px-6 py-3 rounded-4xl font-medium text-sm transition-all duration-300 ${activeTab === 'comic' ? 'bg-white text-blue-600 shadow-sm shadow-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'}`}
            >
              <BookOpen size={25} /> Tạo Truyện
            </button>
            <button
              onClick={() => setActiveTab('chapter')}
              className={`flex-1 flex items-center justify-center whitespace-nowrap min-w-[120px] gap-2 px-6 py-3 rounded-4xl font-medium text-sm transition-all duration-300 ${activeTab === 'chapter' ? 'bg-white text-indigo-600 shadow-sm shadow-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'}`}
            >
              <FileImage size={25} /> Tạo Chương
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`flex-1 flex items-center justify-center whitespace-nowrap min-w-[120px] gap-2 px-6 py-3 rounded-4xl font-medium text-sm transition-all duration-300 ${activeTab === 'manage' ? 'bg-white text-emerald-600 shadow-sm shadow-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'}`}
            >
              <Settings2 size={25} /> Quản Lý
            </button>
            <button
              onClick={() => setActiveTab('tags')}
              className={`flex-1 flex items-center justify-center whitespace-nowrap min-w-[120px] gap-2 px-6 py-3 rounded-4xl font-medium text-sm transition-all duration-300 ${activeTab === 'tags' ? 'bg-white text-amber-600 shadow-sm shadow-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'}`}
            >
              <Tags size={25} /> Nhãn (Tags)
            </button>
          </div>

          {/* TAB 1: COMIC */}
          {activeTab === 'comic' && (
            <form onSubmit={handleCreateComic} className="bg-white/60 backdrop-blur-2xl border border-white/80 p-6 sm:p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-6 animate-fade-in relative">
              <h2 className="text-xl font-bold text-blue-800 flex items-center gap-2 mb-2"><BookOpen size={25} className="text-blue-800" /> Khởi tạo tác phẩm mới</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Tên truyện <span className="text-red-500">*</span></label>
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    type="text"
                    className={inputClass}
                    placeholder="Nhập tên truyện..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Mô tả <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className={`${inputClass} resize-none`}
                    placeholder="Giới thiệu nội dung truyện..."
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Trạng thái hiển thị</label>
                    <select
                      value={newComicStatus}
                      onChange={(e) => setNewComicStatus(e.target.value as 'PUBLISHED' | 'HIDDEN')}
                      className={inputClass}
                    >
                      <option value="PUBLISHED">Công khai (Published)</option>
                      <option value="HIDDEN">Đang ẩn (Hidden)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Ảnh bìa (Cover) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        required
                        type="file"
                        accept="image/*"
                        onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={`${inputClass} flex items-center gap-3 cursor-pointer`}>
                        <ImageIcon size={20} className="text-blue-500" />
                        <span className="truncate flex-1 text-slate-500">
                          {coverFile ? coverFile.name : 'Nhấn để chọn ảnh từ máy...'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-3 ml-1 flex items-center justify-between">
                    <span>Phân loại (Tags)</span>
                    <span className="text-xs font-normal text-slate-400">Đã chọn: {selectedTags.length}</span>
                  </label>
                  <div className="flex flex-wrap gap-2.5 bg-white/40 p-4 rounded-xl border border-slate-200/50">
                    {allTags
                      .filter((tag) => tag.status !== 'HIDDEN')
                      .map((tag) => {
                        const isSelected = selectedTags.includes(tag.id);
                        return (
                          <div
                            key={tag.id}
                            onClick={() => {
                              if (isSelected) setSelectedTags((prev) => prev.filter((id) => id !== tag.id));
                              else setSelectedTags((prev) => [...prev, tag.id]);
                            }}
                            className={`px-4 py-2 rounded-4xl text-sm cursor-pointer transition-all border ${isSelected
                              ? 'bg-blue-500 border-blue-500 text-white shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 shadow-sm'
                              }`}
                          >
                            {tag.name}
                          </div>
                        )
                      })}
                    {allTags.length === 0 && <span className="text-sm text-slate-400">Chưa có tag nào trong hệ thống.</span>}
                  </div>
                </div>
              </div>

              <button disabled={loading} type="submit" className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium p-4 rounded-4xl shadow-[0_8px_20px_rgba(59,130,246,0.25)] hover:shadow-[0_10px_25px_rgba(59,130,246,0.35)] transition-all mt-4 disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? <span className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> Đang xử lý...</span> : 'Tạo Truyện'}
              </button>
            </form>
          )}

          {/* TAB 2: CHAPTER */}
          {activeTab === 'chapter' && (
            <form onSubmit={handleCreateChapter} className="bg-white/60 backdrop-blur-2xl border border-white/80 p-6 sm:p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-6 animate-fade-in">
              <h2 className="text-xl font-bold text-indigo-500 flex items-center gap-2 mb-2"><FileImage size={26} className="text-indigo-500" /> Thêm chương mới</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Thuộc truyện <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={selectedComicId}
                    onChange={(e) => setSelectedComicId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">-- Chọn tác phẩm của bạn --</option>
                    {myComics.map((comic) => (
                      <option key={comic.id} value={comic.id}>
                        {comic.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Tên chương <span className="text-red-500">*</span></label>
                    <input
                      required
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                      type="text"
                      className={inputClass}
                      placeholder="VD: Chap 1 - Sự khởi đầu"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Thứ tự chương <span className="text-red-500">*</span></label>
                    <input
                      required
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(Number(e.target.value))}
                      type="number"
                      min="1"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Giá điểm mở khóa <span className="text-slate-400 font-normal">(0 = Miễn phí)</span></label>
                    <input
                      required
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      type="number"
                      min="0"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Trạng thái</label>
                    <select
                      value={newChapterStatus}
                      onChange={(e) => setNewChapterStatus(e.target.value as 'PUBLISHED' | 'HIDDEN')}
                      className={inputClass}
                    >
                      <option value="PUBLISHED">Công khai</option>
                      <option value="HIDDEN">Đang ẩn</option>
                    </select>
                  </div>
                </div>

                {newChapterStatus === 'HIDDEN' && (
                  <div className="animate-fade-in">
                    <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Lý do ẩn</label>
                    <input
                      value={newChapterHiddenReason}
                      onChange={(e) => setNewChapterHiddenReason(e.target.value)}
                      type="text"
                      className={inputClass}
                      placeholder="Nhập lý do (tùy chọn)..."
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2 ml-1 flex justify-between items-center">
                    <span>Tải ảnh nội dung <span className="text-red-500">*</span></span>
                    {chapterFiles.length > 0 && <span className="text-xs text-indigo-500 font-bold bg-indigo-50 px-2 py-1 rounded-md">{chapterFiles.length} ảnh</span>}
                  </label>

                  <div className="relative group border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 rounded-2xl transition-all h-24 flex items-center justify-center cursor-pointer overflow-hidden">
                    <input
                      required
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleChapterFiles(e.target.files)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="text-center text-indigo-500 font-medium text-sm flex flex-col items-center">
                      <Upload size={24} className="mb-1 opacity-70 group-hover:opacity-100 group-hover:-translate-y-1 transition-all" />
                      <span>Nhấn hoặc Kéo thả nhiều ảnh vào đây</span>
                    </div>
                  </div>

                  {chapterFiles.length > 0 && (
                    <div className="mt-4 bg-white/50 border border-slate-200 rounded-2xl p-3">
                      <p className="text-xs text-slate-500 mb-3 px-2 flex items-center gap-1">
                        <GripVertical size={14} /> Bạn có thể kéo thả để đổi thứ tự ảnh trước khi tải lên.
                      </p>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {chapterFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            draggable
                            onDragStart={() => setDraggingFileIndex(index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (draggingFileIndex === null || draggingFileIndex === index) return;
                              setChapterFiles((prev) => moveItem(prev, draggingFileIndex, index));
                              setDraggingFileIndex(null);
                            }}
                            className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-colors group"
                          >
                            <div className="flex items-center gap-3 text-sm text-slate-700 w-full min-w-0">
                              <GripVertical size={16} className="text-slate-400 group-hover:text-indigo-500 shrink-0" />
                              <span className="font-bold text-slate-400 w-6 shrink-0 text-right">#{index + 1}</span>
                              <span className="truncate flex-1 font-medium">{file.name}</span>
                            </div>
                            <span className="text-xs text-slate-400 font-medium shrink-0 bg-slate-100 px-2 py-1 rounded-md ml-3">{Math.ceil(file.size / 1024)} KB</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button disabled={loading} type="submit" className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium p-4 rounded-4xl shadow-[0_8px_20px_rgba(99,102,241,0.25)] hover:shadow-[0_10px_25px_rgba(99,102,241,0.35)] transition-all mt-4 disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? <span className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> Đang tải lên...</span> : 'Phát hành Chương'}
              </button>
            </form>
          )}

          {/* TAB 3: MANAGE */}
          {activeTab === 'manage' && (
            <div className="space-y-6 animate-fade-in">
              {/* Manage Comics List */}
              <div className="bg-white/60 backdrop-blur-2xl border border-white/80 p-6 sm:p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
                <h3 className="text-xl font-bold text-emerald-500 flex items-center gap-2 mb-6">
                  <Settings2 size={26} className="text-emerald-500" /> Quản lý Tác phẩm
                </h3>

                <div className="space-y-3">
                  {myComics.map((comic) => (
                    <div key={comic.id} className={`p-4 rounded-2xl border transition-all ${manageComicId === comic.id ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium text-slate-800 text-lg">{comic.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[13px] uppercase px-2 py-0.5 rounded-4xl ${comic.status === 'PUBLISHED' ? 'bg-green-100 text-green-600 border border-green-600' :
                              comic.status === 'HIDDEN' ? 'border bg-yellow-100 text-yellow-600 border-yellow-600' : 'bg-slate-200 text-slate-600'
                              }`}>
                              {comic.status || 'PUBLISHED'}
                            </span>
                            <span className="text-xs text-slate-500">{comic.chapterCount || 0} chương</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button onClick={() => setManageComicId(comic.id)} className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${manageComicId === comic.id ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 border-slate-300 border hover:bg-slate-200'}`}>
                            Chọn quản lý
                          </button>
                          <button onClick={() => updateComicStatus(comic.id, 'PUBLISHED')} title="Công khai" className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-50 text-green-600 border border-green-300 hover:bg-green-100 transition-colors">
                            <Eye size={16} />
                          </button>
                          <button onClick={() => updateComicStatus(comic.id, 'HIDDEN')} title="Ẩn" className="w-9 h-9 flex items-center justify-center rounded-xl bg-yellow-50 text-yellow-600 border border-yellow-300 hover:bg-yellow-100 transition-colors">
                            <EyeOff size={16} />
                          </button>
                          <button onClick={() => updateComicStatus(comic.id, 'ARCHIVED')} title="Lưu trữ" className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200 transition-colors">
                            <Archive size={16} />
                          </button>
                          <button onClick={() => deleteComic(comic.id)} title="Xóa" className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 border border-red-300 hover:text-red-600 transition-colors ml-1">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {myComics.length === 0 && (
                    <div className="text-center py-10 bg-white/50 border border-dashed border-slate-300 rounded-2xl text-slate-500 font-medium">
                      Bạn chưa có tác phẩm nào.
                    </div>
                  )}
                </div>
              </div>

              {/* Manage Chapters List */}
              {selectedManageComic && (
                <div className="bg-white/60 backdrop-blur-2xl border border-white/80 p-6 sm:p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] animate-fade-in relative">
                  {/* Decorative Blur */}
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-300/20 blur-[50px] rounded-full pointer-events-none" />

                  <h3 className="text-lg text-slate-800 mb-6 flex items-center flex-wrap gap-2">
                    <span className="text-slate-500">Chương của:</span> <span className="text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-4xl border border-blue-300">{selectedManageComic.title}</span>
                  </h3>

                  <div className="space-y-3">
                    {manageChapters.map((chapter) => (
                      <div key={chapter.id} className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-200 transition-all group">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-4xl flex items-center justify-center font-medium text-slate-500 group-hover:text-blue-500 group-hover:bg-blue-50 transition-colors">
                              {chapter.orderNumber}
                            </div>
                            <div>
                              <p className=" text-slate-800">{chapter.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[11px] uppercase px-2 py-0.5 rounded-4xl ${chapter.status === 'PUBLISHED' ? 'bg-green-100 text-green-600 border border-green-600' : 'bg-yellow-100 text-yellow-600 border border-yellow-600'
                                  }`}>
                                  {chapter.status || 'PUBLISHED'}
                                </span>
                                {chapter.price > 0 ? (
                                  <span className="text-[11px] text-orange-500 bg-orange-50 px-2 py-0.5 rounded-4xl border border-orange-500">{chapter.price} Điểm</span>
                                ) : (
                                  <span className="text-[11px] text-green-500 bg-green-50 px-2 py-0.5 rounded-4xl border border-green-600">Miễn phí</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => updateChapterStatus(chapter.id, 'PUBLISHED')} className="px-3 py-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-600 text-xs border border-green-300 transition-colors flex items-center gap-1">
                              <Eye size={16} />
                            </button>
                            <button onClick={() => updateChapterStatus(chapter.id, 'HIDDEN')} className="px-3 py-2 rounded-xl bg-yellow-50 hover:bg-yellow-100 text-yellow-600 text-xs border border-yellow-300 transition-colors flex items-center gap-1">
                              <EyeOff size={16} />
                            </button>
                            <button onClick={() => openImageManager(chapter.id)} className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600  text-xs border border-blue-300 transition-colors shadow-sm flex items-center gap-1.5">
                              <ImageIcon size={16} /> Quản lý ảnh
                            </button>
                            <button onClick={() => deleteChapter(chapter.id)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 text-red-500 border border-red-300 hover:bg-red-100 hover:text-red-600 transition-colors ml-1">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {manageChapters.length === 0 && (
                      <div className="text-center py-12 bg-white/50 border border-dashed border-slate-300 rounded-2xl text-slate-500 font-medium flex flex-col items-center">
                        <FileImage size={40} className="mb-3 text-slate-300" />
                        Truyện này chưa có chương nào.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Image Manager Modal/Section */}
              {chapterImageManagerId && (
                <div className="pt-10 fixed inset-0 z-50 flex items-center justify-center p-4  backdrop-blur-sm animate-fade-in">
                  <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-white/80">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-xl text-slate-800">Sắp xếp ảnh chương</h3>
                        <p className="text-xs text-slate-500 mt-1">Kéo thả để thay đổi thứ tự. Đừng quên bấm Lưu.</p>
                      </div>
                      <button onClick={() => setChapterImageManagerId('')} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors font-bold">
                        &times;
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-white">
                      <div className="grid gap-3">
                        {chapterImages.map((img, index) => (
                          <div
                            key={img.id}
                            draggable
                            onDragStart={() => setDraggingImageIndex(index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (draggingImageIndex === null || draggingImageIndex === index) return;
                              setChapterImages((prev) => moveItem(prev, draggingImageIndex, index));
                              setDraggingImageIndex(null);
                            }}
                            className="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
                          >
                            <GripVertical size={20} className="text-slate-300 group-hover:text-blue-500 shrink-0" />
                            <div className="w-10 h-10 bg-slate-100 rounded-4xl flex items-center justify-center font-medium text-slate-500 border border-slate-300 text-sm shrink-0">
                              {index + 1}
                            </div>
                            <img src={img.url} alt={`page-${index + 1}`} className="w-16 h-16 object-cover rounded-xl shadow-sm border border-slate-100 shrink-0" />
                            <span className="text-sm font-medium text-slate-600 truncate flex-1">{img.normalizedName || `image_page_${index + 1}.jpg`}</span>
                          </div>
                        ))}
                        {chapterImages.length === 0 && <p className="text-center text-slate-400 py-10">Không có ảnh nào.</p>}
                      </div>
                    </div>

                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button onClick={() => setChapterImageManagerId('')} className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-medium hover:bg-rose-600 hover:text-white transition-colors">
                        Hủy
                      </button>
                      <button onClick={saveImageOrder} disabled={savingImageOrder} className="px-8 py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2 transition-colors">
                        <Save size={22} /> {savingImageOrder ? 'Đang lưu...' : 'Lưu Thứ Tự'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TAGS */}
          {activeTab === 'tags' && (
            <div className="space-y-6 animate-fade-in">
              {/* Create Tag */}
              <div className="bg-white/60 backdrop-blur-2xl border border-white/80 p-6 sm:p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
                <h3 className="text-xl font-bold text-amber-500 mb-6 flex items-center gap-2">
                  <Tags size={20} className="text-amber-500" /> Tạo thẻ (Tag) mới
                </h3>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-4">
                    <input
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className={inputClass}
                      placeholder="Tên tag (VD: Action, Romance...)"
                    />
                    <input
                      value={newTagDescription}
                      onChange={(e) => setNewTagDescription(e.target.value)}
                      className={inputClass}
                      placeholder="Mô tả tag (Không bắt buộc)"
                    />
                  </div>
                  <button onClick={createTag} className="md:w-32 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold shadow-md shadow-amber-500/20 flex flex-col items-center justify-center p-4 transition-all">
                    <Plus size={24} className="mb-1" /> Tạo ngay
                  </button>
                </div>
              </div>

              {/* Manage Tags */}
              <div className="bg-white/60 backdrop-blur-2xl border border-white/80 p-6 sm:p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
                <h3 className="text-xl font-medium text-slate-800 mb-6">Tags bạn đã tạo</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myTags.map((tag) => (
                    <div key={tag.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden group">
                      <div className={`absolute top-0 left-0 w-4 h-full ${tag.status === 'ACTIVE' ? 'bg-amber-400' : 'bg-slate-300'}`}></div>
                      <div className="pl-3">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-slate-800 text-lg">{tag.name}</p>
                          <span className={`text-[12px] uppercase px-3 py-0.5 rounded-4xl ${tag.status === 'ACTIVE' ? 'bg-amber-100 border border-amber-300 text-amber-700' : 'bg-slate-100 border border-slate-300 text-slate-500'}`}>
                            {tag.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mb-4 line-clamp-2 min-h-[40px]">
                          {tag.description || 'Không có mô tả'}
                        </p>
                        <div className="flex gap-2 pt-3 border-t border-slate-100">
                          <button
                            onClick={() => updateTag(tag.id, { status: tag.status === 'ACTIVE' ? 'HIDDEN' : 'ACTIVE' })}
                            className={`flex-1 py-1.5 rounded-4xl text-xs font-medium transition-colors ${tag.status === 'ACTIVE' ? 'bg-slate-100 border border-slate-300 text-slate-600 hover:bg-slate-200' : 'bg-amber-50 border border-amber-300 text-amber-600 hover:bg-amber-100'
                              }`}
                          >
                            {tag.status === 'ACTIVE' ? 'Tạm Ẩn' : 'Bật Lại'}
                          </button>
                          <button onClick={() => deleteTag(tag.id)} className="px-3 py-1.5 rounded-4xl bg-red-50 text-red-500 border border-red-300 hover:bg-red-100 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {myTags.length === 0 && (
                  <div className="text-center py-10 bg-white/50 border border-dashed border-slate-300 rounded-2xl text-slate-500 font-medium">
                    Bạn chưa tạo tag nào.
                  </div>
                )}
              </div>
            </div>
          )}

        </main>

        <style
          dangerouslySetInnerHTML={{
            __html: `
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.4); border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.6); }
            
            @keyframes fade-in {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in {
              animation: fade-in 0.4s ease-out forwards;
            }
          `,
          }}
        />
      </div>
    </div>
  );
}