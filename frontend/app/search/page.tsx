"use client";
import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Star,
  Eye,
  Search as SearchIcon,
  Filter,
  Tag as TagIcon,
  TrendingUp,
  Heart,
  Clock,
  SlidersHorizontal
} from 'lucide-react';
import Navbar from '../../src/components/NavBar';
import AuthModal from '../../src/components/AuthModal';
import { comicApi, tagApi } from '../../src/services/api';

type SortOption = 'newest' | 'views' | 'rating' | 'favorites';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Lấy từ khóa 'q' từ trên thanh URL
  const query = searchParams.get('q') || '';

  const [comics, setComics] = useState<any[]>([]);
  const [allTags, setAllTags] = useState<any[]>([]);
  const [filteredComics, setFilteredComics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States cho Bộ lọc & Sắp xếp
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Lấy toàn bộ truyện và tags về
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [comicsData, tagsData] = await Promise.all([
          comicApi.getAllComics().catch(() => []),
          tagApi.getAllTags().catch(() => [])
        ]);

        setComics(Array.isArray(comicsData) ? comicsData : []);
        setAllTags(Array.isArray(tagsData) ? tagsData : []);
      } catch (error) {
        console.error("Lỗi lấy dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Logic: Lọc + Sắp xếp kết hợp
  useEffect(() => {
    if (comics.length === 0) return;

    let results = [...comics];

    // 1. Lọc theo từ khóa tìm kiếm (Query)
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(comic =>
        comic.title?.toLowerCase().includes(lowerQuery) ||
        (comic.author?.name && comic.author.name.toLowerCase().includes(lowerQuery))
      );
    }

    // 2. Lọc theo Tags (Chỉ lấy truyện có CHỨA TẤT CẢ các tag đang chọn)
    if (selectedTags.length > 0) {
      results = results.filter(comic => {
        const comicTagIds = comic.tags?.map((t: any) => t.id) || [];
        return selectedTags.every(tagId => comicTagIds.includes(tagId));
      });
    }

    // 3. Sắp xếp (Sort)
    switch (sortBy) {
      case 'views':
        results.sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0));
        break;
      case 'rating':
        results.sort((a, b) => (Number(b.averageRating) || 0) - (Number(a.averageRating) || 0));
        break;
      case 'favorites':
        results.sort((a, b) => (Number(b.favoriteCount) || 0) - (Number(a.favoriteCount) || 0));
        break;
      case 'newest':
      default:
        results.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
    }

    setFilteredComics(results);
  }, [query, comics, selectedTags, sortBy]);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  return (
      <main className="max-w-7xl mx-auto p-4 sm:p-6 mt-4 relative z-10 animate-fade-in">
        <div className="bg-white/40 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-6 mb-8 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-400/20 blur-[60px] rounded-full pointer-events-none" />
          <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0">
            <SearchIcon size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-2xl font-medium text-slate-800 tracking-tight">
              Kết quả tìm kiếm
            </h1>
            <p className="text-slate-500 mt-1">
              {query ? (
                <span>Cho từ khóa: <span className="text-blue-600 font-bold">"{query}"</span></span>
              ) : (
                <span>Tất cả tác phẩm</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">

          {/* SIDEBAR BỘ LỌC (Right Side on Desktop, Top on Mobile) */}
          <div className="w-full lg:w-80 shrink-0 order-first lg:order-last">
            <div className="bg-white/60 backdrop-blur-2xl border border-white/80 p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] sticky top-24 relative overflow-hidden">
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-pink-300/20 blur-[40px] rounded-full pointer-events-none" />

              <h3 className="text-lg font-medium text-blue-500 mb-5 flex items-center gap-2">
                <SlidersHorizontal size={20} className="text-blue-500" /> Tùy chỉnh hiển thị
              </h3>

              {/* Sắp xếp */}
              <div className="mb-8">
                <label className="text-xs font-medium text-slate-400 tracking-wider mb-3 block">Sắp xếp theo</label>
                <div className="space-y-2">
                  {[
                    { id: 'newest', icon: Clock, label: 'Mới cập nhật', color: 'text-indigo-500' },
                    { id: 'views', icon: Eye, label: 'Lượt xem', color: 'text-blue-500' },
                    { id: 'rating', icon: Star, label: 'Đánh giá cao', color: 'text-yellow-500' },
                    { id: 'favorites', icon: Heart, label: 'Yêu thích nhiều', color: 'text-pink-500' }
                  ].map((sort) => (
                    <button
                      key={sort.id}
                      onClick={() => setSortBy(sort.id as SortOption)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-4xl transition-all border ${sortBy === sort.id
                        ? 'bg-white border-blue-200 shadow-sm shadow-blue-500/10'
                        : 'bg-transparent border-transparent hover:bg-white/50 text-slate-600'
                        }`}
                    >
                      <sort.icon size={18} className={sortBy === sort.id ? sort.color : 'text-slate-400'} />
                      <span className={`font-medium text-sm ${sortBy === sort.id ? 'text-blue-600' : ''}`}>{sort.label}</span>
                      {sortBy === sort.id && <div className="ml-auto w-2 h-2 rounded-full bg-blue-500"></div>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px w-full bg-slate-200/50 mb-6"></div>

              {/* Lọc Tag */}
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3 block flex justify-between items-center">
                  <span>Thể loại (Tags)</span>
                  {selectedTags.length > 0 && (
                    <button onClick={() => setSelectedTags([])} className="text-[12px] border border-red-600 bg-red-200 text-red-500 hover:text-white hover:bg-red-500  px-2 py-0.5 rounded-4xl transition-colors">
                      Xóa lọc
                    </button>
                  )}
                </label>
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => {
                    const isSelected = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`px-3.5 py-1.5 rounded-4xl text-xs transition-all border ${isSelected
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 border-blue-500 text-white shadow-md shadow-blue-500/20 hover:-translate-y-0.5'
                          : 'bg-white/80 border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-white shadow-sm hover:text-blue-600'
                          }`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                  {allTags.length === 0 && !loading && (
                    <span className="text-xs text-slate-400 italic">Không có tag nào.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT (Search Results) */}
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-lg font-medium text-slate-700">
                Tìm thấy <span className="text-blue-600">{filteredComics.length}</span> tác phẩm
              </h2>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20 bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-sm">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-500"></div>
              </div>
            ) : filteredComics.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredComics.map(comic => (
                  <div
                    key={comic.id}
                    onClick={() => router.push(`/comic/${comic.id}`)}
                    className="group cursor-pointer flex flex-col h-full bg-white/50 backdrop-blur-md rounded-2xl overflow-hidden hover:bg-white transition-all duration-300 border border-white/80 hover:border-blue-200 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_rgba(59,130,246,0.15)] hover:-translate-y-1"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden bg-slate-100">
                      <img src={comic.coverUrl} alt={comic.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />

                      {/* Glassmorphism Rating Badge */}
                      <div className="absolute top-2 right-2 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-medium flex items-center text-white border border-white shadow-sm">
                        <Star size={12} className="mr-1 fill-yellow-400 text-yellow-400 drop-shadow-sm" />
                        {Number(comic.averageRating || 0).toFixed(1)}
                      </div>
                    </div>

                    <div className="p-4 flex flex-col flex-grow bg-gradient-to-b from-transparent to-white/50">
                      <h3 className="font-medium text-sm sm:text-base line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors text-slate-800 leading-tight">
                        {comic.title}
                      </h3>
                      <p className="text-xs text-blue-500 mb-3 truncate">
                        {comic.author?.name || 'Đang cập nhật'}
                      </p>

                      <div className="mt-auto flex items-center gap-2 flex-wrap">
                        <span className="flex items-center text-[10px] font-medium text-slate-500 bg-white/80 px-2 py-1 rounded-4xl border border-slate-300">
                          <Eye size={15} className="mr-1 text-slate-400" /> {Number(comic.views || 0).toLocaleString()}
                        </span>
                        {comic.tags && comic.tags.length > 0 && (
                          <span className="flex items-center text-[10px] text-slate-500 bg-white/80 px-2 py-1 rounded-4xl border border-slate-300 truncate max-w-[80px]">
                            <TagIcon size={15} className="mr-1 text-slate-400" /> {comic.tags[0].name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : 
            (
              <div className="bg-white/50 backdrop-blur-2xl rounded-[2.5rem] p-12 text-center border border-white/60 mt-2 shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col items-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <Filter size={32} className="text-blue-600" />
                </div>
                <p className="text-slate-700 text-lg font-bold mb-2">Không tìm thấy kết quả phù hợp</p>
                <p className="text-slate-500 text-sm">Thử thay đổi từ khóa hoặc bỏ bớt các bộ lọc để xem nhiều truyện hơn nhé.</p>
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="mt-6 bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium px-6 py-2.5 rounded-full transition-colors border border-blue-200"
                  >
                    Xóa bộ lọc Tags
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div>
      <div className="relative z-20">
        <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => setShowAuthModal(true)} />
      </div>
      <div className="min-h-screen font-sans bg-[#F4F7F9] relative overflow-x-hidden selection:bg-blue-500/30 pb-20">
        {/* iOS Background Blurred Orbs */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden mix-blend-multiply opacity-100">
          <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-cyan-300/30 blur-[120px] rounded-full" />
          <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] bg-pink-300/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-[10%] left-[20%] w-[700px] h-[500px] bg-indigo-300/20 blur-[120px] rounded-full" />
        </div>

        <div className='h-16' />

        {/* Tính năng Suspense bọc lại để Next.js tối ưu hóa tham số trên URL */}
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center relative z-10">
            <div className="absolute animate-ping w-16 h-16 rounded-full bg-blue-500/20"></div>
            <div className="animate-spin h-10 w-10 border-4 border-slate-200 border-t-blue-500 rounded-full"></div>
          </div>
        }>
          <SearchContent />
        </Suspense>

        {showAuthModal && <div className="relative z-[100]"><AuthModal onClose={() => setShowAuthModal(false)} /></div>}

        <style
          dangerouslySetInnerHTML={{
            __html: `
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
    </div>
  );
}