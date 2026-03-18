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

  const [activeTab, setActiveTab] = useState<AuthorTab>('comic');
  const [loading, setLoading] = useState(false);

  const [allTags, setAllTags] = useState<any[]>([]);
  const [myTags, setMyTags] = useState<any[]>([]);
  const [myComics, setMyComics] = useState<any[]>([]);
  const [manageChapters, setManageChapters] = useState<any[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newComicStatus, setNewComicStatus] = useState<'PUBLISHED' | 'HIDDEN'>('PUBLISHED');

  const [selectedComicId, setSelectedComicId] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [orderNumber, setOrderNumber] = useState(1);
  const [price, setPrice] = useState(0);
  const [newChapterStatus, setNewChapterStatus] = useState<'PUBLISHED' | 'HIDDEN'>('PUBLISHED');
  const [newChapterHiddenReason, setNewChapterHiddenReason] = useState('');
  const [chapterFiles, setChapterFiles] = useState<File[]>([]);
  const [draggingFileIndex, setDraggingFileIndex] = useState<number | null>(null);

  const [manageComicId, setManageComicId] = useState('');
  const [chapterImageManagerId, setChapterImageManagerId] = useState('');
  const [chapterImages, setChapterImages] = useState<any[]>([]);
  const [draggingImageIndex, setDraggingImageIndex] = useState<number | null>(null);
  const [savingImageOrder, setSavingImageOrder] = useState(false);

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <h2 className="text-2xl font-bold mb-4">Khu vuc nay chi danh cho Author/Admin.</h2>
        <button onClick={() => router.push('/')} className="bg-blue-600 px-6 py-2 rounded-xl">
          Ve Trang Chu
        </button>
      </div>
    );
  }

  const handleCreateComic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverFile) return alert('Vui long chon anh bia');

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

      alert('Tao truyuyen thanh cong');
      setTitle('');
      setDescription('');
      setCoverFile(null);
      setSelectedTags([]);
      setNewComicStatus('PUBLISHED');
      await loadDashboardData();
    } catch (error: any) {
      alert(error.message || 'Tao truyuyen that bai');
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

    if (!selectedComicId) return alert('Vui long chon bo truyuyen');
    if (chapterFiles.length === 0) return alert('Vui long chon it nhat 1 anh');

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

      alert('Tao chuong thanh cong');
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
      alert(error.message || 'Tao chuong that bai');
    } finally {
      setLoading(false);
    }
  };

  const updateComicStatus = async (comicId: string, status: 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED') => {
    const hiddenReason = status === 'HIDDEN' ? window.prompt('Ly do an truyyen (tuy chon):') || undefined : undefined;

    try {
      await authorApi.updateComic(comicId, {
        status,
        hiddenReason,
      });
      await loadDashboardData();
    } catch (error: any) {
      alert(error.message || 'Khong cap nhat duoc trang thai truyyen');
    }
  };

  const deleteComic = async (comicId: string) => {
    if (!window.confirm('Ban chac chan muon xoa truyyen nay?')) return;

    try {
      await authorApi.deleteComic(comicId);
      if (manageComicId === comicId) {
        setManageComicId('');
        setManageChapters([]);
      }
      await loadDashboardData();
    } catch (error: any) {
      alert(error.message || 'Xoa truyyen that bai');
    }
  };

  const updateChapterStatus = async (chapterId: string, status: 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED') => {
    const hiddenReason = status === 'HIDDEN' ? window.prompt('Ly do an chuong (tuy chon):') || undefined : undefined;

    try {
      await authorApi.updateChapter(chapterId, { status, hiddenReason });
      const chapters = await comicApi.getChapters(manageComicId, { includeHidden: true }).catch(() => []);
      setManageChapters(Array.isArray(chapters) ? chapters : []);
    } catch (error: any) {
      alert(error.message || 'Khong cap nhat duoc trang thai chuong');
    }
  };

  const deleteChapter = async (chapterId: string) => {
    if (!window.confirm('Ban chac chan muon xoa chuong nay?')) return;

    try {
      await authorApi.deleteChapter(chapterId);
      const chapters = await comicApi.getChapters(manageComicId, { includeHidden: true }).catch(() => []);
      setManageChapters(Array.isArray(chapters) ? chapters : []);
    } catch (error: any) {
      alert(error.message || 'Xoa chuong that bai');
    }
  };

  const openImageManager = async (chapterId: string) => {
    try {
      const detail = await comicApi.getChapterDetail(chapterId);
      const images = Array.isArray(detail?.images) ? [...detail.images].sort((a, b) => a.pageNumber - b.pageNumber) : [];
      setChapterImageManagerId(chapterId);
      setChapterImages(images);
    } catch (error: any) {
      alert(error.message || 'Khong tai duoc danh sach anh chuong');
    }
  };

  const saveImageOrder = async () => {
    if (!chapterImageManagerId || chapterImages.length === 0) return;

    setSavingImageOrder(true);
    try {
      await authorApi.updateChapter(chapterImageManagerId, {
        imageOrder: chapterImages.map((img) => img.id),
      });
      alert('Da luu thu tu anh');
      await openImageManager(chapterImageManagerId);
    } catch (error: any) {
      alert(error.message || 'Luu thu tu anh that bai');
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
    } catch (error: any) {
      alert(error.message || 'Tao tag that bai');
    }
  };

  const updateTag = async (tagId: string, payload: any) => {
    try {
      await tagApi.updateTag(tagId, payload);
      await loadDashboardData();
    } catch (error: any) {
      alert(error.message || 'Cap nhat tag that bai');
    }
  };

  const deleteTag = async (tagId: string) => {
    if (!window.confirm('Ban chac chan muon xoa tag nay?')) return;

    try {
      await tagApi.deleteTag(tagId);
      await loadDashboardData();
    } catch (error: any) {
      alert(error.message || 'Xoa tag that bai');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] animate-fade-in text-slate-100 pb-10">
      <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => {}} />

      <main className="max-w-6xl mx-auto p-4 sm:p-6 mt-4">
        <button onClick={() => router.back()} className="flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft size={20} className="mr-2" /> Quay lai
        </button>

        <h1 className="text-3xl font-bold text-white mb-8 border-b border-slate-700 pb-4 flex items-center">
          <Upload className="mr-3 text-purple-400" /> Bang Dieu Khien Author
        </h1>

        <div className="flex flex-wrap gap-3 mb-8">
          <button onClick={() => setActiveTab('comic')} className={`px-5 py-2 rounded-xl font-bold ${activeTab === 'comic' ? 'bg-purple-600' : 'bg-slate-800 text-slate-400'}`}>
            Tao Truyen
          </button>
          <button onClick={() => setActiveTab('chapter')} className={`px-5 py-2 rounded-xl font-bold ${activeTab === 'chapter' ? 'bg-blue-600' : 'bg-slate-800 text-slate-400'}`}>
            Tao Chuong
          </button>
          <button onClick={() => setActiveTab('manage')} className={`px-5 py-2 rounded-xl font-bold ${activeTab === 'manage' ? 'bg-emerald-600' : 'bg-slate-800 text-slate-400'}`}>
            Quan Ly Truyen/Chuong
          </button>
          <button onClick={() => setActiveTab('tags')} className={`px-5 py-2 rounded-xl font-bold ${activeTab === 'tags' ? 'bg-amber-600' : 'bg-slate-800 text-slate-400'}`}>
            Quan Ly Tags
          </button>
        </div>

        {activeTab === 'comic' && (
          <form onSubmit={handleCreateComic} className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Ten truyen</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                type="text"
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl"
                placeholder="Nhap ten truyen..."
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Mo ta</label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl"
                placeholder="Gioi thieu truyen..."
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Trang thai</label>
              <select
                value={newComicStatus}
                onChange={(e) => setNewComicStatus(e.target.value as 'PUBLISHED' | 'HIDDEN')}
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl"
              >
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="HIDDEN">HIDDEN</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Tags</label>
              <div className="flex flex-wrap gap-3">
                {allTags
                  .filter((tag) => tag.status !== 'HIDDEN')
                  .map((tag) => (
                    <label key={tag.id} className="flex items-center space-x-2 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        value={tag.id}
                        checked={selectedTags.includes(tag.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTags((prev) => [...prev, tag.id]);
                          else setSelectedTags((prev) => prev.filter((id) => id !== tag.id));
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{tag.name}</span>
                    </label>
                  ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Anh bia</label>
              <input
                required
                type="file"
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-400"
              />
            </div>

            <button disabled={loading} type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold p-4 rounded-xl">
              {loading ? 'Dang xu ly...' : 'Tao Truyen'}
            </button>
          </form>
        )}

        {activeTab === 'chapter' && (
          <form onSubmit={handleCreateChapter} className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Chon Truyen</label>
              <select
                required
                value={selectedComicId}
                onChange={(e) => setSelectedComicId(e.target.value)}
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl"
              >
                <option value="">-- Chon truyen --</option>
                {myComics.map((comic) => (
                  <option key={comic.id} value={comic.id}>
                    {comic.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <input
                required
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                type="text"
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl"
                placeholder="Ten chuong"
              />
              <input
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(Number(e.target.value))}
                type="number"
                min="1"
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl"
                placeholder="Thu tu chuong"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <input
                required
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                type="number"
                min="0"
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl"
                placeholder="Gia diem"
              />
              <select
                value={newChapterStatus}
                onChange={(e) => setNewChapterStatus(e.target.value as 'PUBLISHED' | 'HIDDEN')}
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl"
              >
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="HIDDEN">HIDDEN</option>
              </select>
            </div>

            {newChapterStatus === 'HIDDEN' && (
              <input
                value={newChapterHiddenReason}
                onChange={(e) => setNewChapterHiddenReason(e.target.value)}
                type="text"
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl"
                placeholder="Ly do an chuong (tuy chon)"
              />
            )}

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Tai anh chuong</label>
              <input
                required
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleChapterFiles(e.target.files)}
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-400"
              />
              <p className="text-xs text-slate-500 mt-2 flex items-center">
                <FileImage size={14} className="mr-1" /> Keo-tha de doi thu tu anh truoc khi upload.
              </p>
            </div>

            {chapterFiles.length > 0 && (
              <div className="space-y-2">
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
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900 border border-slate-700"
                  >
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <GripVertical size={14} className="text-slate-500" />
                      <span className="text-xs text-slate-500">#{index + 1}</span>
                      <span className="truncate max-w-[320px]">{file.name}</span>
                    </div>
                    <span className="text-xs text-slate-500">{Math.ceil(file.size / 1024)} KB</span>
                  </div>
                ))}
              </div>
            )}

            <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-4 rounded-xl">
              {loading ? 'Dang xu ly...' : 'Tao Chuong'}
            </button>
          </form>
        )}

        {activeTab === 'manage' && (
          <div className="space-y-6">
            <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl">
              <h3 className="font-bold text-lg mb-4">Quan ly truyen</h3>
              <div className="space-y-3">
                {myComics.map((comic) => (
                  <div key={comic.id} className="p-3 rounded-xl bg-slate-900 border border-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <p className="font-bold">{comic.title}</p>
                        <p className="text-xs text-slate-500">Status: {comic.status || 'PUBLISHED'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setManageComicId(comic.id)} className="px-3 py-1 rounded-lg bg-slate-700 text-xs">
                          Chon
                        </button>
                        <button onClick={() => updateComicStatus(comic.id, 'PUBLISHED')} className="px-3 py-1 rounded-lg bg-green-700 text-xs">
                          Hien
                        </button>
                        <button onClick={() => updateComicStatus(comic.id, 'HIDDEN')} className="px-3 py-1 rounded-lg bg-yellow-700 text-xs">
                          An
                        </button>
                        <button onClick={() => updateComicStatus(comic.id, 'ARCHIVED')} className="px-3 py-1 rounded-lg bg-slate-600 text-xs">
                          Luu tru
                        </button>
                        <button onClick={() => deleteComic(comic.id)} className="px-3 py-1 rounded-lg bg-red-700 text-xs">
                          <Trash2 size={12} className="inline mr-1" />Xoa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedManageComic && (
              <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl">
                <h3 className="font-bold text-lg mb-4">Quan ly chuong: {selectedManageComic.title}</h3>
                <div className="space-y-2">
                  {manageChapters.map((chapter) => (
                    <div key={chapter.id} className="p-3 rounded-xl bg-slate-900 border border-slate-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            #{chapter.orderNumber} - {chapter.title}
                          </p>
                          <p className="text-xs text-slate-500">Status: {chapter.status || 'PUBLISHED'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => updateChapterStatus(chapter.id, 'PUBLISHED')} className="px-3 py-1 rounded-lg bg-green-700 text-xs">
                            <Eye size={12} className="inline mr-1" />Hien
                          </button>
                          <button onClick={() => updateChapterStatus(chapter.id, 'HIDDEN')} className="px-3 py-1 rounded-lg bg-yellow-700 text-xs">
                            <EyeOff size={12} className="inline mr-1" />An
                          </button>
                          <button onClick={() => openImageManager(chapter.id)} className="px-3 py-1 rounded-lg bg-blue-700 text-xs">
                            Anh
                          </button>
                          <button onClick={() => deleteChapter(chapter.id)} className="px-3 py-1 rounded-lg bg-red-700 text-xs">
                            Xoa
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {manageChapters.length === 0 && <p className="text-sm text-slate-500">Chua co chuong nao.</p>}
                </div>
              </div>
            )}

            {chapterImageManagerId && (
              <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl">
                <h3 className="font-bold text-lg mb-4">Sap xep anh chuong</h3>
                <div className="space-y-2 mb-4">
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
                      className="flex items-center gap-3 p-2 rounded-lg border border-slate-700 bg-slate-900"
                    >
                      <GripVertical size={14} className="text-slate-500" />
                      <span className="text-xs text-slate-500">#{index + 1}</span>
                      <img src={img.url} alt={`page-${index + 1}`} className="w-10 h-10 object-cover rounded" />
                      <span className="text-xs text-slate-300 truncate">{img.normalizedName || `image_${index + 1}`}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button onClick={saveImageOrder} disabled={savingImageOrder} className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-bold">
                    <Save size={14} className="inline mr-1" /> {savingImageOrder ? 'Dang luu...' : 'Luu thu tu'}
                  </button>
                  <button onClick={() => setChapterImageManagerId('')} className="px-4 py-2 rounded-lg bg-slate-700 text-sm">
                    Dong
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tags' && (
          <div className="space-y-6">
            <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl">
              <h3 className="font-bold text-lg mb-4 flex items-center">
                <Tags size={18} className="mr-2 text-amber-400" /> Tao tag moi
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2"
                  placeholder="Ten tag"
                />
                <input
                  value={newTagDescription}
                  onChange={(e) => setNewTagDescription(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2"
                  placeholder="Mo ta tag"
                />
              </div>
              <button onClick={createTag} className="mt-3 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold">
                <Plus size={14} className="inline mr-1" /> Tao Tag
              </button>
            </div>

            <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl">
              <h3 className="font-bold text-lg mb-4">Tags cua ban</h3>
              <div className="space-y-2">
                {myTags.map((tag) => (
                  <div key={tag.id} className="p-3 rounded-xl bg-slate-900 border border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{tag.name}</p>
                        <p className="text-xs text-slate-500">{tag.description || 'Khong co mo ta'} | Status: {tag.status}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            updateTag(tag.id, { status: tag.status === 'ACTIVE' ? 'HIDDEN' : 'ACTIVE' })
                          }
                          className="px-3 py-1 rounded-lg bg-slate-700 text-xs"
                        >
                          {tag.status === 'ACTIVE' ? 'An' : 'Hien'}
                        </button>
                        <button onClick={() => deleteTag(tag.id)} className="px-3 py-1 rounded-lg bg-red-700 text-xs">
                          Xoa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {myTags.length === 0 && <p className="text-sm text-slate-500">Ban chua tao tag nao.</p>}
              </div>
            </div>
          </div>
        )}

        {loading && <div className="text-center text-sm text-slate-400 mt-4">Dang xu ly...</div>}
      </main>
    </div>
  );
}
