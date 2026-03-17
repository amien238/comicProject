"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, BookOpen, FileImage, Plus } from 'lucide-react';
import Navbar from '../../src/components/NavBar';
import { useAuth } from '../../src/context/AuthContext';
import { comicApi, tagApi, uploadApi, authorApi } from '../../src/services/api';

export default function AuthorDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('comic'); // 'comic' hoặc 'chapter'
  const [loading, setLoading] = useState(false);

  // Dữ liệu chung
  const [tags, setTags] = useState<any[]>([]);
  const [myComics, setMyComics] = useState<any[]>([]);

  // Form Đăng Truyện
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Form Thêm Chương
  const [selectedComicId, setSelectedComicId] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [orderNumber, setOrderNumber] = useState(1);
  const [price, setPrice] = useState(0);
  const [chapterFiles, setChapterFiles] = useState<FileList | null>(null);

  useEffect(() => {
    // Load Tags và Danh sách truyện
    tagApi.getAllTags().then(setTags).catch(console.error);
    comicApi.getAllComics().then(data => {
      // Lọc ra các truyện do tác giả này viết
      if (user) {
        const filtered = data.filter((c: any) => c.authorId === user.id);
        setMyComics(filtered);
      }
    }).catch(console.error);
  }, [user]);

  // CHẶN NGƯỜI DÙNG BÌNH THƯỜNG
  if (!user || (user.role !== 'AUTHOR' && user.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <h2 className="text-2xl font-bold mb-4">🚫 Khu vực cấm! Chỉ dành cho Tác giả.</h2>
        <button onClick={() => router.push('/')} className="bg-blue-600 px-6 py-2 rounded-xl">Về Trang Chủ</button>
      </div>
    );
  }

  // Xử lý tạo Truyện
  const handleCreateComic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverFile) return alert("Vui lòng chọn ảnh bìa!");
    setLoading(true);

    try {
      // 1. Upload ảnh bìa lên Cloudinary
      const uploadRes = await uploadApi.uploadSingle(coverFile);
      const coverUrl = uploadRes.imageUrl;

      // 2. Gọi API tạo truyện
      await authorApi.createComic({
        title, description, coverUrl, tagIds: selectedTags
      });

      alert("🎉 Đăng truyện thành công!");
      window.location.reload(); // Load lại trang để reset form
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Xử lý tạo Chương
  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComicId) return alert("Vui lòng chọn bộ truyện!");
    if (!chapterFiles || chapterFiles.length === 0) return alert("Vui lòng chọn ít nhất 1 ảnh trang truyện!");
    setLoading(true);

    try {
      // 1. Upload TẤT CẢ các trang truyện lên Cloudinary cùng lúc
      const uploadRes = await uploadApi.uploadMultiple(chapterFiles);
      const imageUrls = uploadRes.imageUrls;

      // 2. Gọi API tạo chương
      await authorApi.createChapter({
        comicId: selectedComicId,
        title: chapterTitle,
        orderNumber: Number(orderNumber),
        price: Number(price),
        images: imageUrls // Backend sẽ tự lưu theo thứ tự
      });

      alert("🎉 Thêm chương thành công!");
      setChapterTitle(''); setChapterFiles(null);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] animate-fade-in text-slate-100 pb-10">
      <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => {}} />

      <main className="max-w-4xl mx-auto p-4 sm:p-6 mt-4">
        <button onClick={() => router.back()} className="flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft size={20} className="mr-2" /> Quay lại
        </button>

        <h1 className="text-3xl font-bold text-white mb-8 border-b border-slate-700 pb-4 flex items-center">
          <Upload className="mr-3 text-purple-400" /> Bảng Điều Khiển Tác Giả
        </h1>

        {/* Tabs */}
        <div className="flex space-x-4 mb-8">
          <button onClick={() => setActiveTab('comic')} className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center ${activeTab === 'comic' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            <BookOpen size={18} className="mr-2" /> Đăng Truyện Mới
          </button>
          <button onClick={() => setActiveTab('chapter')} className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center ${activeTab === 'chapter' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            <Plus size={18} className="mr-2" /> Thêm Chương Mới
          </button>
        </div>

        {/* --- TAB ĐĂNG TRUYỆN --- */}
        {activeTab === 'comic' && (
          <form onSubmit={handleCreateComic} className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Tên truyện</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-purple-500" placeholder="Nhập tên truyện..." />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Mô tả nội dung</label>
              <textarea required value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-purple-500" placeholder="Giới thiệu cốt truyện..."></textarea>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Thể loại (Tags)</label>
              <div className="flex flex-wrap gap-3">
                {tags.map(tag => (
                  <label key={tag.id} className="flex items-center space-x-2 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700 cursor-pointer hover:border-purple-500 transition-colors">
                    <input 
                      type="checkbox" 
                      value={tag.id}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedTags([...selectedTags, tag.id]);
                        else setSelectedTags(selectedTags.filter(id => id !== tag.id));
                      }}
                      className="w-4 h-4 accent-purple-600" 
                    />
                    <span className="text-sm">{tag.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Ảnh bìa truyện</label>
              <input required type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] || null)} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer" />
            </div>

            <button disabled={loading} type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold p-4 rounded-xl transition-all shadow-lg flex items-center justify-center">
              {loading ? 'Đang Upload & Xử lý...' : 'Xuất Bản Truyện'}
            </button>
          </form>
        )}

        {/* --- TAB THÊM CHƯƠNG --- */}
        {activeTab === 'chapter' && (
          <form onSubmit={handleCreateChapter} className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl space-y-6">
            {myComics.length === 0 ? (
              <div className="text-yellow-400 p-4 bg-yellow-400/10 rounded-xl">Bạn chưa có bộ truyện nào. Hãy qua Tab "Đăng Truyện Mới" để tạo truyện trước nhé!</div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Chọn Truyện</label>
                  <select required value={selectedComicId} onChange={e => setSelectedComicId(e.target.value)} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500">
                    <option value="">-- Click để chọn truyện --</option>
                    {myComics.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">Tên Chương</label>
                    <input required value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} type="text" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500" placeholder="VD: Chương 1: Bắt đầu" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">Chương số (Thứ tự)</label>
                    <input required value={orderNumber} onChange={e => setOrderNumber(Number(e.target.value))} type="number" min="1" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Giá điểm (Nhập 0 nếu Miễn phí)</label>
                  <input required value={price} onChange={e => setPrice(Number(e.target.value))} type="number" min="0" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Tải các trang truyện (Chọn nhiều ảnh cùng lúc)</label>
                  <input required type="file" multiple accept="image/*" onChange={e => setChapterFiles(e.target.files)} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" />
                  <p className="text-xs text-slate-500 mt-2 flex items-center"><FileImage size={14} className="mr-1"/> Giữ Ctrl (hoặc Shift) để chọn nhiều ảnh. Ảnh sẽ được tự upload lên Cloudinary.</p>
                </div>

                <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-4 rounded-xl transition-all shadow-lg flex items-center justify-center">
                  {loading ? 'Đang Upload hàng loạt lên Cloudinary...' : 'Đăng Chương Mới'}
                </button>
              </>
            )}
          </form>
        )}
      </main>
    </div>
  );
}