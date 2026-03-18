"use client";
import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';

import Navbar from '../../src/components/NavBar';
import { useAuth } from '../../src/context/AuthContext';
import { historyApi, transactionApi, userApi } from '../../src/services/api';
import { resolveUserTier } from '../../src/utils/userTier';

type ProfileTab = 'unlocked' | 'favorites' | 'history' | 'wallet';

const orderStatusLabel = (status: string) => {
  const safeStatus = String(status || '').toUpperCase();
  if (safeStatus === 'PAID') return { text: 'Da thanh toan', className: 'text-green-400 border-green-500/30 bg-green-500/10' };
  if (safeStatus === 'PENDING') return { text: 'Cho thanh toan', className: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' };
  if (safeStatus === 'PROCESSING') return { text: 'Dang xu ly', className: 'text-blue-400 border-blue-500/30 bg-blue-500/10' };
  if (safeStatus === 'FAILED' || safeStatus === 'CANCELED' || safeStatus === 'EXPIRED') {
    return { text: safeStatus, className: 'text-red-400 border-red-500/30 bg-red-500/10' };
  }
  return { text: safeStatus || 'UNKNOWN', className: 'text-slate-400 border-slate-500/30 bg-slate-500/10' };
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>('wallet');
  const [unlockedChapters, setUnlockedChapters] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [readingHistory, setReadingHistory] = useState<any[]>([]);
  const [paymentOrders, setPaymentOrders] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [requestingWithdraw, setRequestingWithdraw] = useState(false);

  const [depositAmount, setDepositAmount] = useState(50000);
  const [depositMethod, setDepositMethod] = useState<'BANK_TRANSFER' | 'EWALLET'>('BANK_TRANSFER');

  const [withdrawAmount, setWithdrawAmount] = useState(50000);
  const [withdrawMethod, setWithdrawMethod] = useState<'BANK_TRANSFER' | 'EWALLET'>('BANK_TRANSFER');
  const [withdrawAccountName, setWithdrawAccountName] = useState('');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState('');

  const tier = resolveUserTier(user?.role, user?.totalDeposited);

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

  const handleCreatePaymentOrder = async () => {
    if (creatingOrder) return;

    if (!Number.isInteger(depositAmount) || depositAmount <= 0) {
      alert('So tien nap phai la so nguyen duong');
      return;
    }

    setCreatingOrder(true);
    try {
      const result = await transactionApi.createPaymentOrder({
        amount: depositAmount,
        method: depositMethod,
      });

      alert(`Tao lenh nap thanh cong: ${result?.order?.providerOrderId || result?.order?.id || ''}`);
      const orders = await transactionApi.getMyPaymentOrders(30).catch(() => []);
      setPaymentOrders(Array.isArray(orders) ? orders : []);
    } catch (error: any) {
      alert(error.message || 'Khong the tao lenh nap');
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleWithdrawRequest = async () => {
    if (requestingWithdraw) return;

    if (!Number.isInteger(withdrawAmount) || withdrawAmount <= 0) {
      alert('So diem rut phai la so nguyen duong');
      return;
    }

    if (!withdrawAccountNumber.trim()) {
      alert('Vui long nhap so tai khoan/vi');
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

      alert('Gui yeu cau rut tien thanh cong, vui long cho duyet.');
      setWithdrawAccountName('');
      setWithdrawAccountNumber('');
      if (refreshUser) await refreshUser();
    } catch (error: any) {
      alert(error.message || 'Khong the gui yeu cau rut');
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
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">
        <div className="bg-slate-800 p-8 rounded-3xl text-center border border-slate-700 shadow-xl">
          <h2 className="text-2xl font-bold mb-4">Vui long dang nhap</h2>
          <button onClick={() => router.push('/')} className="bg-blue-600 px-6 py-2 rounded-xl">
            Ve Trang Chu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 pb-10">
      <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => {}} />

      <main className="max-w-5xl mx-auto p-4 sm:p-6 mt-4 animate-fade-in">
        <button onClick={() => router.back()} className="flex items-center text-slate-400 hover:text-white mb-6">
          <ArrowLeft size={20} className="mr-2" /> Quay lai
        </button>

        <h1 className="text-3xl font-bold text-white mb-8">Trang Ca Nhan</h1>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="col-span-1 space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl text-center">
              <div className="w-24 h-24 mx-auto bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-4xl font-bold text-white mb-4">
                {user.avatar ? (
                  <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="avatar" />
                ) : (
                  user.name?.charAt(0).toUpperCase()
                )}
              </div>
              <h2 className="text-xl font-bold">{user.name}</h2>
              <p className="text-slate-400 text-sm mb-4">{user.email}</p>

              <div className="bg-slate-900/50 p-3 rounded-xl mb-2 text-blue-300 font-bold text-sm">
                Vai tro: {user.role}
              </div>
              {tier && <div className={`p-2 rounded-xl mb-4 text-xs font-black uppercase ${tier.className}`}>Cap: {tier.label}</div>}

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
                <p className="text-yellow-500 text-xs font-bold mb-1">So du</p>
                <p className="text-3xl font-black text-yellow-400 flex justify-center items-center">
                  <Coins size={24} className="mr-2" /> {user.points}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="w-full text-slate-500 hover:text-red-400 font-medium py-2 flex justify-center items-center"
              >
                <LogOut size={16} className="mr-2" /> Dang xuat
              </button>
            </div>
          </div>

          <div className="col-span-2">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl h-full flex flex-col min-h-[560px]">
              <div className="flex space-x-2 mb-6 border-b border-slate-700 pb-4 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setActiveTab('wallet')}
                  className={`px-4 py-2 rounded-xl font-bold flex items-center whitespace-nowrap transition-all ${
                    activeTab === 'wallet' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Wallet size={18} className="mr-2" /> Vi Tien
                </button>
                <button
                  onClick={() => setActiveTab('unlocked')}
                  className={`px-4 py-2 rounded-xl font-bold flex items-center whitespace-nowrap transition-all ${
                    activeTab === 'unlocked' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <BookOpen size={18} className="mr-2" /> Da Mua
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 rounded-xl font-bold flex items-center whitespace-nowrap transition-all ${
                    activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Clock size={18} className="mr-2" /> Lich Su
                </button>
                <button
                  onClick={() => setActiveTab('favorites')}
                  className={`px-4 py-2 rounded-xl font-bold flex items-center whitespace-nowrap transition-all ${
                    activeTab === 'favorites' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Heart size={18} className="mr-2" /> Yeu Thich
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                {loading ? (
                  <p className="text-center text-slate-500 py-10">Dang tai...</p>
                ) : (
                  <>
                    {activeTab === 'wallet' && (
                      <div className="space-y-6">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                          <h3 className="font-bold text-white mb-3 flex items-center">
                            <CreditCard size={18} className="mr-2 text-emerald-400" /> Tao lenh nap tien
                          </h3>
                          <div className="grid sm:grid-cols-3 gap-3">
                            <input
                              type="number"
                              min={1000}
                              value={depositAmount}
                              onChange={(e) => setDepositAmount(Number(e.target.value))}
                              className="sm:col-span-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                              placeholder="So diem nap"
                            />
                            <select
                              value={depositMethod}
                              onChange={(e) => setDepositMethod(e.target.value as 'BANK_TRANSFER' | 'EWALLET')}
                              className="sm:col-span-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                            >
                              <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                              <option value="EWALLET">EWALLET</option>
                            </select>
                            <button
                              onClick={handleCreatePaymentOrder}
                              disabled={creatingOrder}
                              className="sm:col-span-1 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                            >
                              {creatingOrder ? 'Dang tao...' : 'Tao lenh nap'}
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            He thong se tao ma giao dich doi soat de ban nap qua ngan hang/vi dien tu.
                          </p>
                        </div>

                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                          <h3 className="font-bold text-white mb-3 flex items-center">
                            <Landmark size={18} className="mr-2 text-cyan-400" /> Yeu cau rut tien
                          </h3>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <input
                              type="number"
                              min={1000}
                              value={withdrawAmount}
                              onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                              placeholder="So diem rut"
                            />
                            <select
                              value={withdrawMethod}
                              onChange={(e) => setWithdrawMethod(e.target.value as 'BANK_TRANSFER' | 'EWALLET')}
                              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                            >
                              <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                              <option value="EWALLET">EWALLET</option>
                            </select>
                            <input
                              type="text"
                              value={withdrawAccountName}
                              onChange={(e) => setWithdrawAccountName(e.target.value)}
                              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                              placeholder="Ten tai khoan/vi"
                            />
                            <input
                              type="text"
                              value={withdrawAccountNumber}
                              onChange={(e) => setWithdrawAccountNumber(e.target.value)}
                              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                              placeholder="So tai khoan/so vi"
                            />
                          </div>
                          <button
                            onClick={handleWithdrawRequest}
                            disabled={requestingWithdraw}
                            className="mt-3 w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                          >
                            {requestingWithdraw ? 'Dang gui...' : 'Gui yeu cau rut'}
                          </button>
                        </div>

                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                          <h3 className="font-bold text-white mb-3 flex items-center">
                            <Smartphone size={18} className="mr-2 text-blue-400" /> Lenh nap gan day
                          </h3>
                          {paymentOrders.length === 0 ? (
                            <p className="text-slate-500 text-sm">Chua co lenh nap nao.</p>
                          ) : (
                            <div className="space-y-2">
                              {paymentOrders.map((order) => {
                                const badge = orderStatusLabel(order.status);
                                return (
                                  <div key={order.id} className="p-3 rounded-xl border border-slate-700 bg-slate-800/60">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="text-xs text-slate-300 font-bold">{order.providerOrderId || order.id}</span>
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badge.className}`}>{badge.text}</span>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      <div>So tien: {order.amount} | Method: {order.method}</div>
                                      {order.bankReferenceCode && <div>Ref: {order.bankReferenceCode}</div>}
                                      {order.checkoutUrl && (
                                        <div>
                                          Checkout: <a href={order.checkoutUrl} className="text-blue-400 hover:underline">{order.checkoutUrl}</a>
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

                    {activeTab === 'unlocked' && (
                      unlockedChapters.length === 0 ? (
                        <p className="text-center text-slate-500 py-10">Chua co chuong nao duoc mua.</p>
                      ) : (
                        unlockedChapters.map((item, i) => (
                          <div
                            key={i}
                            onClick={() => router.push(`/read/${item.chapterId}`)}
                            className="flex items-center p-3 bg-slate-900 rounded-xl hover:border-blue-500/50 border border-slate-700 cursor-pointer group"
                          >
                            <img src={item.comicCover} className="w-12 h-16 object-cover rounded mr-4" alt="cover" />
                            <div className="flex-1">
                              <h4 className="font-bold group-hover:text-blue-400">{item.comicTitle}</h4>
                              <p className="text-blue-500 text-sm">{item.chapterTitle}</p>
                            </div>
                            <ChevronRight className="text-slate-600" />
                          </div>
                        ))
                      )
                    )}

                    {activeTab === 'history' && (
                      readingHistory.length === 0 ? (
                        <p className="text-center text-slate-500 py-10">Ban chua doc truyen nao gan day.</p>
                      ) : (
                        readingHistory.map((item, i) => (
                          <div
                            key={i}
                            onClick={() => router.push(`/read/${item.chapterId}`)}
                            className="flex items-center p-3 bg-slate-900 rounded-xl hover:border-indigo-500/50 border border-slate-700 cursor-pointer group"
                          >
                            <img src={item.comic.coverUrl} className="w-12 h-16 object-cover rounded mr-4" alt="cover" />
                            <div className="flex-1">
                              <h4 className="font-bold group-hover:text-indigo-400 line-clamp-1">{item.comic.title}</h4>
                              <p className="text-slate-400 text-sm">
                                Dang doc: <span className="text-indigo-400">{item.chapter.title}</span>
                              </p>
                              <p className="text-slate-600 text-[10px] mt-1">Cap nhat: {new Date(item.updatedAt).toLocaleString('vi-VN')}</p>
                            </div>
                            <ChevronRight className="text-slate-600" />
                          </div>
                        ))
                      )
                    )}

                    {activeTab === 'favorites' && (
                      favorites.length === 0 ? (
                        <p className="text-center text-slate-500 py-10">Chua co truyen yeu thich.</p>
                      ) : (
                        favorites.map((item, i) => (
                          <div
                            key={i}
                            onClick={() => router.push(`/comic/${item.comicId}`)}
                            className="flex items-center p-3 bg-slate-900 rounded-xl hover:border-pink-500/50 border border-slate-700 cursor-pointer group"
                          >
                            <img src={item.coverUrl} className="w-12 h-16 object-cover rounded mr-4" alt="cover" />
                            <div className="flex-1">
                              <h4 className="font-bold group-hover:text-pink-400">{item.title}</h4>
                              <p className="text-slate-500 text-sm">{item.authorName}</p>
                            </div>
                            <ChevronRight className="text-slate-600" />
                          </div>
                        ))
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .scrollbar-hide::-webkit-scrollbar { display: none; }
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
          `,
        }}
      />
    </div>
  );
}
