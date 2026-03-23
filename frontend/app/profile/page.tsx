"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Coins,
  CreditCard,
  BookOpen,
  Heart,
  Clock,
  ChevronRight,
  LogOut,
  Landmark,
  Smartphone,
  Wallet,
  Camera,
  User as UserIcon,
  Settings,
  CheckCircle2,
  ImagePlus, QrCode, Copy, X
} from 'lucide-react';

import Navbar from '../../src/components/NavBar';
import { useAuth } from '../../src/context/AuthContext';
import { historyApi, transactionApi, userApi, uploadApi } from '../../src/services/api';
import { resolveUserTier } from '../../src/utils/userTier';

type ProfileTab = 'account' | 'wallet' | 'unlocked' | 'history' | 'favorites';

const MY_BANK_BIN = "970407"
const MY_BANK_ACCOUNT = "1108191310"
const MY_ACCOUNT_NAME = "Đinh Thị Ngọc Trâm"


const orderStatusLabel = (status: string) => {
  const safeStatus = String(status || '').toUpperCase();
  if (safeStatus === 'PAID') return { text: 'Đã thanh toán', className: 'text-emerald-600 border-emerald-200 bg-emerald-50' };
  if (safeStatus === 'PENDING') return { text: 'Chờ thanh toán', className: 'text-amber-600 border-amber-200 bg-amber-50' };
  if (safeStatus === 'PROCESSING') return { text: 'Đang xử lý', className: 'text-blue-600 border-blue-200 bg-blue-50' };
  if (safeStatus === 'FAILED' || safeStatus === 'CANCELED' || safeStatus === 'EXPIRED') {
    return { text: safeStatus, className: 'text-red-600 border-red-200 bg-red-50' };
  }
  return { text: safeStatus || 'UNKNOWN', className: 'text-slate-500 border-slate-200 bg-slate-50' };
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>('account');
  const [unlockedChapters, setUnlockedChapters] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [readingHistory, setReadingHistory] = useState<any[]>([]);
  const [paymentOrders, setPaymentOrders] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [requestingWithdraw, setRequestingWithdraw] = useState(false);

  // Profile Edit States
  const [editName, setEditName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wallet States
  const [depositAmount, setDepositAmount] = useState(50000);
  const [depositMethod, setDepositMethod] = useState<'BANK_TRANSFER' | 'EWALLET'>('BANK_TRANSFER');

  const [showQRModal, setShowQRModal] = useState(false);
  const [currentPendingOrder, setCurrentPendingOrder] = useState<any>(null);

  const [withdrawAmount, setWithdrawAmount] = useState(50000);
  const [withdrawMethod, setWithdrawMethod] = useState<'BANK_TRANSFER' | 'EWALLET'>('BANK_TRANSFER');
  const [withdrawAccountName, setWithdrawAccountName] = useState('');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState('');

  const tier = resolveUserTier(user?.role, user?.totalDeposited);

  // Khởi tạo data ban đầu cho form edit
  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setAvatarPreview(user.avatar || null);
    }
  }, [user]);

  const loadAllData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [unlocked, favs, history, orders] = await Promise.all([
        userApi.getUnlockedChapters().catch(() => []),
        userApi.getFavorites().catch(() => []),
        historyApi.getMyHistory().catch(() => []),
        transactionApi.getMyPaymentOrders(30).catch(() => []),
      ]);

      setUnlockedChapters(Array.isArray(unlocked) ? unlocked : []);
      setFavorites(Array.isArray(favs) ? favs : []);
      setReadingHistory(Array.isArray(history) ? history : []);
      setPaymentOrders(Array.isArray(orders) ? orders : []);
    } catch (error) {
      console.error('Profile load error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [user]);

  // --- Handlers ---

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setUpdatingProfile(true);
    try {
      let newAvatarUrl = user.avatar;

      if (avatarFile) {
        // Upload avatar nếu có file mới
        const uploadRes = await uploadApi.uploadSingle(avatarFile);
        newAvatarUrl = uploadRes.imageUrl;
      }

      // // Cập nhật thông tin user
      // await userApi.updateProfile({
      //   name: editName.trim(),
      //   avatar: newAvatarUrl
      // });

      // Sử dụng Custom Modal Message thay vì alert mặc định
      const msgBox = document.createElement('div');
      msgBox.className = "fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in";
      msgBox.innerHTML = `
        <div class="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 border border-slate-100 text-center">
          <div class="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-4"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
          <h3 class="text-xl font-bold text-slate-800 mb-2">Thành công!</h3>
          <p class="text-slate-500 mb-6">Hồ sơ của bạn đã được cập nhật.</p>
          <button id="close-msg-btn" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-2xl transition-colors">Đóng</button>
        </div>
      `;
      document.body.appendChild(msgBox);
      document.getElementById('close-msg-btn')?.addEventListener('click', () => document.body.removeChild(msgBox));

      if (refreshUser) await refreshUser();
      setAvatarFile(null);
    } catch (error: any) {
      alert(error.message || 'Cập nhật thất bại. Vui lòng thử lại.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleCreatePaymentOrder = async () => {
    if (creatingOrder) return;
    if (!Number.isInteger(depositAmount) || depositAmount <= 0) {
      alert('Số tiền nạp phải là số nguyên dương lớn hơn 0');
      return;
    }

    setCreatingOrder(true);
    try {
      const result = await transactionApi.createPaymentOrder({
        amount: depositAmount,
        method: depositMethod,
      });

      const newOrder = result?.order;
      if (newOrder) {
        setCurrentPendingOrder(newOrder);
        setShowQRModal(true);
      }

      alert(`Tạo lệnh nạp thành công: ${result?.order?.providerOrderId || result?.order?.id || ''}`);
      const orders = await transactionApi.getMyPaymentOrders(30).catch(() => []);
      setPaymentOrders(Array.isArray(orders) ? orders : []);
    } catch (error: any) {
      alert(error.message || 'Không thể tạo lệnh nạp');
    } finally {
      setCreatingOrder(false);
    }
  };

  // Hàm Copy siêu tương thích (Hỗ trợ cả iFrame)
  const copyToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Tàng hình thẻ textarea
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');

      // Hiển thị thông báo nhỏ ở góc dưới thay vì alert cồng kềnh
      const toast = document.createElement('div');
      toast.className = "fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-[300] font-medium text-sm animate-fade-in flex items-center gap-2";
      toast.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Đã sao chép!`;
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 2000);

    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

  const handleWithdrawRequest = async () => {
    if (requestingWithdraw) return;
    if (!Number.isInteger(withdrawAmount) || withdrawAmount < 50000) {
      alert('Số điểm rút tối thiểu là 50,000');
      return;
    }
    if (!withdrawAccountNumber.trim()) {
      alert('Vui lòng nhập số tài khoản/ví');
      return;
    }

    setRequestingWithdraw(true);
    try {
      await transactionApi.requestWithdraw({
        amount: withdrawAmount,
        method: withdrawMethod,
        accountName: withdrawAccountName.trim() || undefined,
        accountNumber: withdrawAccountNumber.trim(),
      });

      alert('Gửi yêu cầu rút tiền thành công, vui lòng chờ duyệt.');
      setWithdrawAccountName('');
      setWithdrawAccountNumber('');
      if (refreshUser) await refreshUser();
    } catch (error: any) {
      alert(error.message || 'Không thể gửi yêu cầu rút');
    } finally {
      setRequestingWithdraw(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-300/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="bg-white/60 p-8 rounded-[2rem] text-center border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.05)] backdrop-blur-2xl relative z-10 max-w-sm w-full mx-4">
          <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserIcon size={40} />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-slate-800">Vui lòng đăng nhập</h2>
          <p className="text-slate-500 mb-8">Bạn cần đăng nhập để truy cập không gian cá nhân của mình.</p>
          <button onClick={() => router.push('/')} className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-md">
            Về Trang Chủ
          </button>
        </div>
      </div>
    );
  }

  // Helper cho Input
  const inputClass = "w-full px-4 py-3 bg-white/60 border border-slate-200/80 rounded-2xl text-slate-700 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner placeholder:text-slate-400";

  return (
    <div>
      <div className="relative z-20">
        <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => { }} />
      </div>

      <div className="min-h-screen bg-[#F4F7F9] text-slate-800 font-sans pb-20 relative overflow-hidden selection:bg-blue-500/30">
        <div className='h-15' />
        {/* iOS Background Blurred Orbs */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden mix-blend-multiply opacity-100">
          <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-cyan-300/30 blur-[120px] rounded-full" />
          <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] bg-pink-300/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-[10%] left-[20%] w-[700px] h-[500px] bg-indigo-300/20 blur-[120px] rounded-full" />
        </div>



        <main className="max-w-6xl mx-auto p-4 sm:p-6 mt-4 relative z-10 animate-fade-in">
          <h1 className="text-2xl font-medium text-slate-800 mb-8 drop-shadow-sm">Trang Cá Nhân</h1>

          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">

            {/* CỘT TRÁI: IDENTITY (Card nhận diện cá nhân) */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-300/20 blur-[40px] rounded-full pointer-events-none" />

                <div className="relative w-28 h-28 mx-auto mb-4 group cursor-pointer" onClick={() => setActiveTab('account')}>
                  <div className="w-full h-full bg-gradient-to-tr from-blue-400 to-indigo-500 rounded-full shadow-lg shadow-blue-500/20 flex items-center justify-center text-4xl font-black text-white border-4 border-white overflow-hidden transition-transform group-hover:scale-105">
                    {avatarPreview ? (
                      <img src={avatarPreview} className="w-full h-full object-cover" alt="avatar" />
                    ) : (
                      user.name?.charAt(0).toUpperCase()
                    )}
                  </div>
                  {/* Lớp mờ và icon camera khi hover */}
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="text-white" size={28} />
                  </div>
                </div>

                <h2 className="text-2xl font-medium text-slate-800 leading-tight">{user.name}</h2>
                <p className="text-slate-500 text-sm mb-5 mt-1">{user.email}</p>

                <div className="flex justify-center gap-2 mb-6">
                  <div className="bg-blue-50 border border-blue-300 text-blue-600 px-3 py-1.5 rounded-full font-medium text-xs shadow-sm tracking-wider">
                    {user.role}
                  </div>
                  {tier && (
                    <div className={`px-3 py-1.5 rounded-full text-xs font-medium tracking-wider shadow-sm border ${tier.className}`}>
                      {tier.label}
                    </div>
                  )}
                </div>

                {/* Hộp điểm số (Coins) mượt mà */}
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50/50 border border-yellow-200/50 rounded-[1.5rem] p-5 mb-6 shadow-sm relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 opacity-10 text-yellow-500">
                    <Coins size={80} />
                  </div>
                  <p className="text-yellow-600 font-medium mb-1 tracking-widest relative z-10">Số dư hiện tại</p>
                  <p className="text-3xl font-medium text-yellow-500 flex justify-center items-center relative z-10">
                    <Coins size={35} className="mr-2 fill-yellow-200 drop-shadow-sm" />
                    {Number(user.points || 0).toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full bg-white/60 hover:bg-red-50 text-slate-600 border hover:text-red-600 border-slate-300 hover:border-red-400 font-medium py-3.5 rounded-2xl flex justify-center items-center transition-all shadow-sm"
                >
                  <LogOut size={30} className="mr-2" /> Đăng xuất
                </button>
              </div>
            </div>

            {/* CỘT PHẢI: ACTIONS & CONTENT */}
            <div className="lg:col-span-2">
              <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-4 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] h-full flex flex-col min-h-[600px]">

                {/* Segmented Control Tabs */}
                <div className="flex p-1.5 bg-white/60 backdrop-blur-xl rounded-2xl border border-white mb-6 overflow-x-auto custom-scrollbar shadow-inner ">
                  <button
                    onClick={() => setActiveTab('account')}
                    className={`flex-1 flex justify-center items-center whitespace-nowrap min-w-[120px] px-4 py-3 rounded-full font-medium text-sm transition-all duration-300 ${activeTab === 'account' ? 'bg-white text-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border-2 border-slate-300' : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
                      }`}
                  >
                    <Settings size={16} className="mr-2" /> Cài đặt
                  </button>
                  <button
                    onClick={() => setActiveTab('wallet')}
                    className={`flex-1 flex justify-center items-center whitespace-nowrap min-w-[120px] px-4 py-3 rounded-full font-medium text-sm transition-all duration-300 ${activeTab === 'wallet' ? 'bg-white text-emerald-600 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border-2 border-emerald-300' : 'text-slate-500 hover:text-slate-700 hover:bg-white/4'
                      }`}
                  >
                    <Wallet size={16} className="mr-2" /> Ví Tiền
                  </button>
                  <button
                    onClick={() => setActiveTab('unlocked')}
                    className={`flex-1 flex justify-center items-center whitespace-nowrap min-w-[120px] px-4 py-3 rounded-full font-medium text-sm transition-all duration-300 ${activeTab === 'unlocked' ? 'bg-white text-blue-600 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border-2 border-blue-300' : 'text-slate-500 hover:text-slate-700 hover:bg-white/4'
                      }`}
                  >
                    <BookOpen size={16} className="mr-2" /> Đã Mua
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 flex justify-center items-center whitespace-nowrap min-w-[120px] px-4 py-3 rounded-full font-medium text-sm transition-all duration-300 ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border-2 border-indigo-300' : 'text-slate-500 hover:text-slate-700 hover:bg-white/4'
                      }`}
                  >
                    <Clock size={16} className="mr-2" /> Lịch Sử
                  </button>
                  <button
                    onClick={() => setActiveTab('favorites')}
                    className={`flex-1 flex justify-center items-center whitespace-nowrap min-w-[120px] px-4 py-3 rounded-full font-medium text-sm transition-all duration-300 ${activeTab === 'favorites' ? 'bg-white text-pink-600 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border-2 border-pink-300' : 'text-slate-500 hover:text-slate-700 hover:bg-white/4'
                      }`}
                  >
                    <Heart size={16} className="mr-2" /> Yêu Thích
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar pb-4 relative z-10">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-500 mb-4"></div>
                      <p className="text-slate-400 font-medium">Đang tải dữ liệu...</p>
                    </div>
                  ) : (
                    <div className="animate-fade-in">

                      {/* --- TAB: ACCOUNT (Cài đặt) --- */}
                      {activeTab === 'account' && (
                        <div className="bg-white/60 border border-white rounded-[2rem] p-6 sm:p-8 shadow-sm">
                          <h3 className="font-medium text-xl text-slate-800 mb-6 flex items-center">
                            <Settings size={22} className="mr-2 text-slate-800" /> Cập nhật Hồ sơ
                          </h3>

                          <form onSubmit={handleUpdateProfile} className="space-y-6">
                            {/* Đổi Avatar */}
                            <div>
                              <label className="block text-sm font-medium text-slate-600 mb-3 ml-1">Ảnh đại diện</label>
                              <div className="flex items-center gap-6">
                                <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                  {avatarPreview ? (
                                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                                  ) : (
                                    <UserIcon size={32} className="text-slate-400" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleAvatarChange}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200 px-5 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm flex items-center gap-2"
                                  >
                                    <ImagePlus size={18} /> Chọn ảnh mới
                                  </button>
                                  <p className="text-xs text-slate-400 mt-2">Định dạng JPEG, PNG, JPG. Tối đa 2MB.</p>
                                </div>
                              </div>
                            </div>

                            {/* Đổi Tên */}
                            <div>
                              <label className="block text-sm font-medium text-slate-600 mb-2 ml-1">Tên hiển thị</label>
                              <input
                                type="text"
                                required
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className={inputClass}
                                placeholder="Nhập tên của bạn"
                              />
                            </div>

                            {/* Email (Readonly) */}
                            <div>
                              <label className="block text-sm font-medium text-slate-600 mb-2 ml-1">Email đăng nhập (Không thể đổi)</label>
                              <input
                                type="email"
                                disabled
                                value={user.email}
                                className="w-full px-4 py-3 bg-slate-100/50 border border-slate-200 rounded-2xl text-slate-500 outline-none cursor-not-allowed"
                              />
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                              <button
                                type="submit"
                                disabled={updatingProfile}
                                className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-8 py-3.5 rounded-full font-medium shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                              >
                                {updatingProfile ? (
                                  <><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> Đang lưu...</>
                                ) : (
                                  <><CheckCircle2 size={18} /> Lưu thay đổi</>
                                )}
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {/* --- TAB: WALLET --- */}
                      {activeTab === 'wallet' && (
                        <div className="space-y-6">

                          {/* Nạp tiền */}
                          <div className="bg-white/60 border border-white rounded-[2rem] p-6 shadow-sm">
                            <h3 className="font-medium text-lg text-emerald-500 mb-4 flex items-center">
                              <CreditCard size={20} className="mr-2 text-emerald-500" /> Nạp điểm vào tài khoản
                            </h3>
                            <div className="grid sm:grid-cols-3 gap-4">
                              <input
                                type="number"
                                min={10000}
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(Number(e.target.value))}
                                className={`sm:col-span-1 ${inputClass}`}
                                placeholder="Số điểm cần nạp (Từ 10,000đ)"
                              />
                              <select
                                value={depositMethod}
                                onChange={(e) => setDepositMethod(e.target.value as 'BANK_TRANSFER' | 'EWALLET')}
                                className={`sm:col-span-1 ${inputClass}`}
                              >
                                <option value="BANK_TRANSFER">Chuyển khoản Ngân hàng</option>
                                <option value="EWALLET">Ví điện tử (Momo, ZaloPay)</option>
                              </select>
                              <button
                                onClick={handleCreatePaymentOrder}
                                disabled={creatingOrder}
                                className="sm:col-span-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-2xl font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all flex justify-center items-center"
                              >
                                {creatingOrder ? 'Đang tạo...' : 'Tạo lệnh nạp'}
                              </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-3 ml-1 bg-slate-50 p-2 rounded-lg border border-slate-100 inline-block">
                              💡 Hệ thống sẽ tạo mã giao dịch đối soát để bạn chuyển khoản.
                            </p>
                          </div>

                          {/* Rút tiền */}
                          <div className="bg-white/60 border border-white rounded-[2rem] p-6 shadow-sm">
                            <h3 className="font-medium text-lg text-cyan-500 mb-4 flex items-center">
                              <Landmark size={20} className="mr-2 text-cyan-500" /> Yêu cầu Rút tiền (Dành cho Tác giả)
                            </h3>
                            <div className="grid sm:grid-cols-2 gap-4">
                              <input
                                type="number"
                                min={50000}
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                                className={inputClass}
                                placeholder="Số điểm muốn rút (Tối thiểu 50.000)"
                              />
                              <select
                                value={withdrawMethod}
                                onChange={(e) => setWithdrawMethod(e.target.value as 'BANK_TRANSFER' | 'EWALLET')}
                                className={inputClass}
                              >
                                <option value="BANK_TRANSFER">Nhận qua Ngân hàng</option>
                                <option value="EWALLET">Nhận qua Ví điện tử</option>
                              </select>
                              <input
                                type="text"
                                value={withdrawAccountName}
                                onChange={(e) => setWithdrawAccountName(e.target.value)}
                                className={inputClass}
                                placeholder="Tên chủ tài khoản / Tên ví"
                              />
                              <input
                                type="text"
                                value={withdrawAccountNumber}
                                onChange={(e) => setWithdrawAccountNumber(e.target.value)}
                                className={inputClass}
                                placeholder="Số tài khoản / Số điện thoại ví"
                              />
                            </div>
                            <button
                              onClick={handleWithdrawRequest}
                              disabled={requestingWithdraw}
                              className="mt-4 w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-3.5 rounded-2xl font-bold shadow-md shadow-cyan-500/20 disabled:opacity-50 transition-all"
                            >
                              {requestingWithdraw ? 'Đang xử lý...' : 'Gửi yêu cầu rút'}
                            </button>
                          </div>

                          {/* Lịch sử giao dịch ví */}
                          <div className="bg-white/60 border border-white rounded-[2rem] p-6 shadow-sm">
                            <h3 className="font-medium text-lg text-blue-500 mb-4 flex items-center">
                              <Smartphone size={20} className="mr-2 text-blue-500" /> Lịch sử giao dịch gần đây
                            </h3>
                            {paymentOrders.length === 0 ? (
                              <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                                <p className="text-slate-400 font-medium">Chưa có giao dịch nào.</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {paymentOrders.map((order) => {
                                  const badge = orderStatusLabel(order.status);
                                  return (
                                    <div key={order.id} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                      {/* Highlight cho đơn PENDING */}
                                      {order.status === 'PENDING' ? (
                                        <div className="absolute top-0 left-0 w-2.5 h-full bg-amber-400"></div>
                                      ) : (
                                        <div className="absolute top-0 left-0 w-2.5 h-full bg-emerald-400"></div>
                                      )}

                                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                        <span className="text-sm text-slate-800 font-medium">Mã: {order.providerOrderId || order.id}</span>
                                        <span className={`text-[13px] font-medium tracking-wider px-2.5 py-1 rounded-full border ${badge.className}`}>
                                          {badge.text}
                                        </span>
                                      </div>
                                      <div className="text-sm text-slate-600 space-y-1">
                                        <div className="flex gap-2">
                                          <span className="text-slate-400">Số tiền:</span> <strong className="text-emerald-600">{Number(order.amount).toLocaleString()} VNĐ</strong>
                                        </div>

                                        {/* NÚT QUÉT MÃ NẾU ĐANG PENDING */}
                                        {order.status === 'PENDING' && (
                                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                                            <button
                                              onClick={() => {
                                                setCurrentPendingOrder(order);
                                                setShowQRModal(true);
                                              }}
                                              className="bg-emerald-50 text-emerald-600 hover:bg-emerald-400 hover:text-white px-4 py-2 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 border border-emerald-200/50"
                                            >
                                              <QrCode size={14} /> Quét mã thanh toán
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* --- TAB: UNLOCKED --- */}
                      {activeTab === 'unlocked' && (
                        unlockedChapters.length === 0 ? (
                          <div className="text-center py-16 bg-white/40 border border-dashed border-white/80 rounded-[2rem]">
                            <BookOpen size={40} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500 font-medium">Bạn chưa mở khóa chương nào.</p>
                          </div>
                        ) : (
                          <div className="grid sm:grid-cols-2 gap-4">
                            {unlockedChapters.map((item, i) => (
                              <div
                                key={i}
                                onClick={() => router.push(`/read/${item.chapterId}`)}
                                className="flex items-center p-3 sm:p-4 bg-white/60 border border-white hover:border-blue-200 rounded-[1.5rem] shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(59,130,246,0.1)] cursor-pointer group transition-all"
                              >
                                <img src={item.comicCover} className="w-16 h-20 sm:h-24 object-cover rounded-xl shadow-sm mr-4" alt="cover" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-slate-800 group-hover:text-blue-600 truncate mb-1">{item.comicTitle}</h4>
                                  <p className="text-blue-500 text-sm truncate">{item.chapterTitle}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-50 group-hover:bg-blue-50 group-hover:text-blue-500 group-hover:border-blue-300 transition-colors shrink-0 ml-2">
                                  <ChevronRight size={18} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}

                      {/* --- TAB: HISTORY --- */}
                      {activeTab === 'history' && (
                        readingHistory.length === 0 ? (
                          <div className="text-center py-16 bg-white/40 border border-dashed border-white/80 rounded-[2rem]">
                            <Clock size={40} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500 font-medium">Bạn chưa đọc truyện nào gần đây.</p>
                          </div>
                        ) : (
                          <div className="grid sm:grid-cols-2 gap-4">
                            {readingHistory.map((item, i) => (
                              <div
                                key={i}
                                onClick={() => router.push(`/read/${item.chapterId}`)}
                                className="flex items-center p-3 sm:p-4 bg-white/60 border border-white hover:border-indigo-200 rounded-[1.5rem] shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(99,102,241,0.1)] cursor-pointer group transition-all"
                              >
                                <img src={item.comic.coverUrl} className="w-16 h-20 sm:h-24 object-cover rounded-xl shadow-sm mr-4" alt="cover" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-slate-800 group-hover:text-indigo-600 line-clamp-1 mb-1">{item.comic.title}</h4>
                                  <p className="text-slate-500 text-xs mb-1">
                                    Đang đọc: <span className="text-indigo-500 font-bold">{item.chapter.title}</span>
                                  </p>
                                  <p className="text-slate-400 text-[12px] font-medium bg-slate-100 w-fit px-2 py-0.5 rounded-full border border-slate-300">
                                    {new Date(item.updatedAt).toLocaleDateString('vi-VN')}
                                  </p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-50 group-hover:bg-indigo-50 group-hover:text-indigo-500 group-hover:border-indigo-300 transition-colors shrink-0 ml-2">
                                  <ChevronRight size={18} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}

                      {/* --- TAB: FAVORITES --- */}
                      {activeTab === 'favorites' && (
                        favorites.length === 0 ? (
                          <div className="text-center py-16 bg-white/40 border border-dashed border-white/80 rounded-[2rem]">
                            <Heart size={40} className="mx-auto text-pink-200 mb-4" />
                            <p className="text-slate-500 font-medium">Chưa có truyện yêu thích.</p>
                          </div>
                        ) : (
                          <div className="grid sm:grid-cols-2 gap-4">
                            {favorites.map((item, i) => (
                              <div
                                key={i}
                                onClick={() => router.push(`/comic/${item.comicId}`)}
                                className="flex items-center p-3 sm:p-4 bg-white/60 border border-white hover:border-pink-200 rounded-[1.5rem] shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(236,72,153,0.1)] cursor-pointer group transition-all"
                              >
                                <img src={item.coverUrl} className="w-16 h-20 sm:h-24 object-cover rounded-xl shadow-sm mr-4" alt="cover" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-slate-800 group-hover:text-pink-600 line-clamp-2 mb-1">{item.title}</h4>
                                  <p className="text-slate-500 text-xs">{item.authorName}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-50 group-hover:bg-pink-50 group-hover:text-pink-500 group-hover:border-pink-300 transition-colors shrink-0 ml-2">
                                  <Heart size={16} className="group-hover:fill-pink-500" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}

                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ========================================== */}
        {/* 🚀 MODAL QR CODE THANH TOÁN (GLASSMORPHISM) */}
        {/* ========================================== */}
        {showQRModal && currentPendingOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-fade-in" onClick={() => setShowQRModal(false)}></div>

            <div className="bg-white/90 backdrop-blur-2xl border border-white p-6 sm:p-8 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-sm relative z-10 animate-fade-in flex flex-col items-center text-center">

              <button onClick={() => setShowQRModal(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-500 hover:text-white transition-colors">
                <X size={18} />
              </button>

              <h2 className="text-xl font-black text-slate-800 mb-1 mt-2">Thanh toán nạp điểm</h2>
              <p className="text-sm text-slate-500 mb-6">Mở app ngân hàng quét mã QR bên dưới</p>

              {/* Khối chứa ảnh QR tự động */}
              <div className="bg-white p-3 rounded-[2rem] shadow-sm border border-slate-100 mb-6">
                <img
                  src={`https://img.vietqr.io/image/${MY_BANK_BIN}-${MY_BANK_ACCOUNT}-compact2.png?amount=${currentPendingOrder.amount}&addInfo=${currentPendingOrder.bankReferenceCode || currentPendingOrder.id}&accountName=${MY_ACCOUNT_NAME}`}
                  alt="VietQR"
                  className="w-full h-auto rounded-2xl"
                />
              </div>

              {/* Chi tiết chuyển khoản */}
              <div className="w-full space-y-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                <div>
                  <p className="text-[14px] font-medium text-slate-400 tracking-wider">Số tiền cần chuyển</p>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-emerald-600 text-lg">{Number(currentPendingOrder.amount).toLocaleString()} VNĐ</p>
                    <button onClick={() => copyToClipboard(currentPendingOrder.amount.toString())} className="text-slate-400 hover:text-blue-500 p-1 transition-colors"><Copy size={16} /></button>
                  </div>
                </div>
                <div className="h-px bg-slate-200/60"></div>
                <div>
                  <p className="text-[14px] font-medium text-slate-400 tracking-wider">Nội dung chuyển khoản</p>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-blue-600 text-base">{currentPendingOrder.bankReferenceCode || currentPendingOrder.id}</p>
                    <button onClick={() => copyToClipboard(currentPendingOrder.bankReferenceCode || currentPendingOrder.id)} className="text-slate-400 hover:text-blue-500 p-1 transition-colors"><Copy size={16} /></button>
                  </div>
                </div>
              </div>

              <div className="w-full bg-red-50 text-red-500 text-xs font-medium p-3 rounded-xl mb-6 text-left border border-red-100">
                <span className="font-bold">⚠️ Quan trọng:</span> Vui lòng ghi ĐÚNG nội dung chuyển khoản để hệ thống tự động nhận diện và cộng điểm cho bạn.
              </div>

              <button
                onClick={() => setShowQRModal(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3.5 rounded-full transition-all shadow-md flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> Tôi đã chuyển khoản xong
              </button>

            </div>
          </div>
        )}

        <style
          dangerouslySetInnerHTML={{
            __html: `
            .custom-scrollbar::-webkit-scrollbar { height: 0px; width: 4px; display: none; }
            .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            .custom-scrollbar:hover::-webkit-scrollbar { display: block; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.4); border-radius: 10px; }
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
    </div>
  );
}