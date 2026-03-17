"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Star, Eye, Search as SearchIcon } from 'lucide-react';
import Navbar from '../../src/components/NavBar';
import AuthModal from '../../src/components/AuthModal';
import { comicApi } from '../../src/services/api';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Lấy từ khóa 'q' từ trên thanh URL (VD: /search?q=solo)
  const query = searchParams.get('q') || '';
  
  const [comics, setComics] = useState<any[]>([]);
  const [filteredComics, setFilteredComics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Lấy toàn bộ truyện về
  useEffect(() => {
    const fetchComics = async () => {
      setLoading(true);
      try {
        const data = await comicApi.getAllComics();
        setComics(data);
      } catch (error) {
        console.error("Lỗi lấy danh sách truyện:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchComics();
  }, []);

  // Lọc truyện dựa trên từ khóa tìm kiếm (Lọc theo Tên, Tác giả, và Tag)
  useEffect(() => {
    if (query && comics.length > 0) {
      const lowerQuery = query.toLowerCase();
      const results = comics.filter(comic => 
        comic.title.toLowerCase().includes(lowerQuery) || 
        (comic.author?.name && comic.author.name.toLowerCase().includes(lowerQuery)) ||
        (comic.tags && comic.tags.some((t: any) => t.name.toLowerCase().includes(lowerQuery)))
      );
      setFilteredComics(results);
    } else {
      setFilteredComics(comics);
    }
  }, [query, comics]);

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 mt-4">
      <button onClick={() => router.push('/')} className="flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={20} className="mr-2" /> Quay lại Trang chủ
      </button>

      <h1 className="text-2xl font-bold text-white mb-6 flex items-center">
        <SearchIcon className="mr-3 text-blue-500" /> 
        Kết quả tìm kiếm cho: <span className="text-blue-400 ml-2">"{query}"</span>
      </h1>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredComics.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {filteredComics.map(comic => (
            <div 
              key={comic.id} 
              onClick={() => router.push(`/comic/${comic.id}`)} 
              className="group cursor-pointer flex flex-col h-full bg-slate-800/40 rounded-xl overflow-hidden hover:bg-slate-800 transition-all border border-slate-700/50 hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]"
            >
              <div className="relative aspect-[2/3] overflow-hidden">
                <img src={comic.coverUrl} alt={comic.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold flex items-center text-yellow-400">
                  <Star size={12} className="mr-1 fill-yellow-400" /> {comic.averageRating || '5.0'}
                </div>
              </div>
              <div className="p-3 flex flex-col flex-grow">
                <h3 className="font-bold text-sm sm:text-base line-clamp-2 mb-1 group-hover:text-blue-400 transition-colors text-white">{comic.title}</h3>
                <p className="text-xs text-slate-400 mt-auto flex justify-between items-center">
                  <span>{comic.author?.name || 'Đang cập nhật'}</span>
                  <span className="flex items-center"><Eye size={12} className="mr-1"/> {comic.views || 0}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-2xl p-10 text-center border border-slate-700 mt-8">
          <p className="text-slate-400 text-lg">Không tìm thấy truyện nào phù hợp với từ khóa "{query}".</p>
        </div>
      )}
    </main>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="min-h-screen animate-fade-in bg-[#0f172a] font-sans">
      <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => setShowAuthModal(true)} />
      {/* Tính năng Suspense bọc lại để Next.js tối ưu hóa tham số trên URL */}
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="animate-spin h-10 w-10 border-t-2 border-blue-500 rounded-full"></div></div>}>
        <SearchContent />
      </Suspense>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}