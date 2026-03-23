"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Scale,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  ShieldCheck,
  CreditCard,
  Landmark,
  FileText,
  AlertTriangle
} from 'lucide-react';

import Navbar from '../../src/components/NavBar';
import { useAuth } from '../../src/context/AuthContext';
import { transactionApi } from '../../src/services/api';

export default function AccountingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [withdrawRequests, setWithdrawRequests] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any[]>([]);

  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [transferAmount, setTransferAmount] = useState<number | ''>('');

  const [processingId, setProcessingId] = useState<string | null>(null);

  const isAccounter = user?.role === 'ACCOUNTER' || user?.role === 'ADMIN';

  const loadAll = async () => {
    if (!isAccounter) return;

    setLoading(true);
    try {
      const [summaryData, deposits, withdraws, reconciliationEvents] = await Promise.all([
        transactionApi.getAccountingSummary().catch(() => null),
        // SỬA LỖI Ở ĐÂY: Lấy đúng bảng PaymentOrder (Đơn tạo từ VietQR) thay vì lấy trong Audit
        transactionApi.getPaymentOrders({ status: 'PENDING', limit: 100 }).catch(() => []),
        transactionApi.getAudit({ type: 'WITHDRAW_REQUEST', limit: 100 }).catch(() => []),
        transactionApi.getReconciliation({ limit: 100 }).catch(() => []),
      ]);

      setSummary(summaryData);
      setDepositRequests(Array.isArray(deposits) ? deposits : []);
      setWithdrawRequests((Array.isArray(withdraws) ? withdraws : []).filter((item) => item.status === 'PENDING'));
      setReconciliation(Array.isArray(reconciliationEvents) ? reconciliationEvents : []);
    } catch (error) {
      console.error("Lỗi tải dữ liệu kế toán:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [isAccounter]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-300/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="bg-white/60 p-8 rounded-[2rem] text-center border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.05)] backdrop-blur-2xl relative z-10 max-w-sm w-full mx-4">
          <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={40} />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-slate-800">Vui lòng đăng nhập</h2>
          <button onClick={() => router.push('/')} className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-md mt-4">
            Về Trang Chủ
          </button>
        </div>
      </div>
    );
  }

  if (!isAccounter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-300/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="bg-white/60 p-8 rounded-[2rem] text-center border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.05)] backdrop-blur-2xl relative z-10 max-w-sm w-full mx-4">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-slate-800">Từ chối truy cập</h2>
          <p className="text-slate-500 mb-6">Khu vực này chỉ dành cho Kế toán viên hoặc Quản trị viên.</p>
          <button onClick={() => router.push('/')} className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-md">
            Về Trang Chủ
          </button>
        </div>
      </div>
    );
  }

  // API Duyệt đơn nạp điểm mới
  const reviewDeposit = async (id: string, approve: boolean) => {
    if (approve && !window.confirm('Xác nhận đã NHẬN ĐƯỢC TIỀN và duyệt đơn nạp này?')) return;
    if (!approve && !window.confirm('Từ chối đơn nạp này?')) return;

    setProcessingId(id);
    try {
      // Gọi hàm reviewPaymentOrder (Bạn sẽ cấu hình thêm ở api.ts bên dưới)
      await (transactionApi as any).reviewPaymentOrder({ id, approve });
      await loadAll();
      alert(approve ? 'Đã duyệt nạp tiền thành công! Điểm đã được cộng.' : 'Đã từ chối đơn nạp tiền.');
    } catch (error: any) {
      alert(error.message || 'Không xử lý được yêu cầu nạp');
    } finally {
      setProcessingId(null);
    }
  };

  // API Duyệt đơn rút điểm
  const reviewWithdraw = async (id: string, approve: boolean) => {
    const payoutReference = approve ? window.prompt('Nhập mã giao dịch chi tiền (tùy chọn):') || undefined : undefined;
    if (approve && payoutReference === null) return; // Bấm Cancel

    setProcessingId(id);
    try {
      await transactionApi.reviewWithdrawRequest({ transactionId: id, approve, payoutReference });
      await loadAll();
      alert(approve ? 'Đã duyệt lệnh rút tiền!' : 'Đã từ chối lệnh rút tiền.');
    } catch (error: any) {
      alert(error.message || 'Không xử lý được yêu cầu rút');
    } finally {
      setProcessingId(null);
    }
  };

  const handleTransfer = async () => {
    if (!fromUserId || !toUserId || Number(transferAmount) <= 0) {
      alert('Nhập đầy đủ ID người gửi, người nhận và số điểm > 0');
      return;
    }

    try {
      await transactionApi.transferPoints({
        fromUserId,
        toUserId,
        amount: Number(transferAmount),
        reason: 'Manual transfer from accounting screen',
      });
      alert('Chuyển điểm thành công!');
      setFromUserId('');
      setToUserId('');
      setTransferAmount('');
      await loadAll();
    } catch (error: any) {
      alert(error.message || 'Chuyển điểm thất bại');
    }
  };

  const closeCurrentPeriod = async () => {
    if (!window.confirm('Đóng kỳ kế toán hiện tại? Hành động này không thể hoàn tác.')) return;

    try {
      await transactionApi.closePeriod({ note: 'Closed from accounting dashboard' });
      await loadAll();
      alert('Đóng kỳ thành công');
    } catch (error: any) {
      alert(error.message || 'Đóng kỳ thất bại');
    }
  };

  const inputClass = "w-full px-4 py-3 bg-white/60 border border-slate-200/80 rounded-2xl text-slate-700 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner placeholder:text-slate-400";

  return (
    <div>
        <div className="relative z-20">
          <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => { }} />
        </div>

      <div className="min-h-screen bg-[#F4F7F9] text-slate-800 font-sans pb-20 relative overflow-hidden selection:bg-blue-500/30">

        {/* iOS Background Blurred Orbs */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden mix-blend-multiply opacity-100">
          <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-cyan-300/30 blur-[120px] rounded-full" />
          <div className="absolute bottom-[10%] right-[-10%] w-[700px] h-[500px] bg-indigo-300/20 blur-[120px] rounded-full" />
        </div>

        <div className='h-15'/>

        <main className="max-w-7xl mx-auto p-4 sm:p-6 mt-4 relative z-10 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-medium text-blue-500 drop-shadow-sm flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-tr from-cyan-400 to-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Scale size={24} />
                </div>
                Bảng Điều Khiển Kế Toán
              </h1>
            </div>
            <button
              onClick={loadAll}
              disabled={loading}
              className="bg-white/60 hover:bg-white border border-white/80 px-5 py-3 rounded-full text-slate-700 font-bold transition-all shadow-sm hover:text-blue-600 hover:border-blue-600 flex items-center gap-2 w-fit disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Làm mới dữ liệu
            </button>
          </div>

          <div className="grid lg:grid-cols-12 gap-6">

            {/* CỘT TRÁI (Overview & Transfer) */}
            <div className="lg:col-span-4 space-y-6">

              {/* TỔNG QUAN */}
              <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-5 text-blue-500 pointer-events-none"><FileText size={120} /></div>
                <h3 className="font-medium text-lg text-blue-500 mb-5 relative z-10 flex items-center gap-2">
                  <FileText size={20} className="text-blue-500" /> Tổng quan kỳ kế toán
                </h3>

                {summary ? (
                  <div className="space-y-3 text-sm relative z-10">
                    <div className="flex justify-between items-center p-3 bg-white/50 rounded-xl border border-blue-400/50">
                      <span className="text-blue-600">Kỳ hiện tại</span>
                      <span className="font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-300">{summary.period?.month}/{summary.period?.year}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-emerald-50/50 rounded-xl border border-emerald-400/50">
                      <span className="text-emerald-500">Tổng nạp vào</span>
                      <span className="font-medium text-emerald-600">+{Number(summary.totals?.deposited || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl border border-red-400/50">
                      <span className="text-red-600">Tổng rút ra</span>
                      <span className="font-medium text-red-600">-{Number(summary.totals?.withdrawnPaid || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/50 rounded-xl border border-slate-400/50">
                      <span className="text-slate-500">Nợ ví (Liability)</span>
                      <span className="font-medium text-slate-800">{Number(summary.totals?.walletLiability || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 italic text-sm">Chưa có dữ liệu tổng quan.</div>
                )}

                <button
                  onClick={closeCurrentPeriod}
                  className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white px-4 py-3.5 rounded-2xl text-sm font-medium shadow-md transition-all relative z-10"
                >
                  Chốt sổ & Đóng kỳ hiện tại
                </button>
              </div>

              {/* TRANSFER POINTS */}
              <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative overflow-hidden">
                <h3 className="font-medium text-lg text-indigo-500 mb-5 relative z-10 flex items-center gap-2">
                  <ArrowRightLeft size={20} className="text-indigo-500" /> Điều chuyển điểm
                </h3>
                <div className="space-y-3 relative z-10">
                  <input
                    value={fromUserId}
                    onChange={(e) => setFromUserId(e.target.value)}
                    placeholder="ID Người gửi (From User ID)"
                    className={inputClass}
                  />
                  <input
                    value={toUserId}
                    onChange={(e) => setToUserId(e.target.value)}
                    placeholder="ID Người nhận (To User ID)"
                    className={inputClass}
                  />
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(Number(e.target.value) || '')}
                    placeholder="Số điểm cần chuyển"
                    className={inputClass}
                  />
                  <button
                    onClick={handleTransfer}
                    className="w-full mt-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-4 py-3.5 rounded-2xl text-sm font-medium shadow-md shadow-indigo-500/20 transition-all"
                  >
                    Thực hiện chuyển
                  </button>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI (Lists) */}
            <div className="lg:col-span-8 space-y-6">

              {/* DUYỆT ĐƠN NẠP TIỀN */}
              <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-medium text-xl text-emerald-500 flex items-center gap-2">
                    <CreditCard size={22} className="text-emerald-500" /> Duyệt đơn Nạp điểm
                  </h3>
                  {depositRequests.length > 0 && (
                    <span className=" text-emerald-600 px-3 py-1 rounded-full text-sm shadow-sm border border-emerald-300">
                      {depositRequests.length} chờ duyệt
                    </span>
                  )}
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {depositRequests.length === 0 ? (
                    <div className="text-center py-10 bg-white/50 border border-dashed border-slate-300 rounded-2xl">
                      <CheckCircle2 size={40} className="mx-auto text-emerald-400/50 mb-3" />
                      <p className="text-emerald-400 font-medium">Không có yêu cầu nạp điểm nào đang chờ.</p>
                    </div>
                  ) : (
                    depositRequests.map((item) => (
                      <div key={item.id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between gap-4 group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-3 h-full bg-emerald-400 group-hover:bg-emerald-500 transition-colors"></div>

                        <div className="flex-1 ml-2">
                          <div className="flex justify-between items-start mb-3">
                            <p className="font-medium text-slate-800 text-lg">{item.user?.name || item.userId}</p>
                            <p className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-md border border-slate-300">{new Date(item.createdAt).toLocaleString('vi-VN')}</p>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 mb-2">
                            <div>
                              <p className="text-[12px] text-slate-400 font-medium tracking-widest mb-1">Số tiền yêu cầu</p>
                              <p className="font-bold text-emerald-600 text-xl leading-none">{Number(item.amount).toLocaleString()} đ</p>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-300">
                              <p className="text-[13px] text-slate-400 font-medium tracking-widest mb-0.5">Mã đối soát CK</p>
                              <p className="font-bold text-blue-600 text-base font-mono">{item.bankReferenceCode || item.providerOrderId || item.id}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-row md:flex-col gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4 w-full md:w-32 justify-center">
                          <button
                            onClick={() => reviewDeposit(item.id, true)}
                            disabled={processingId === item.id}
                            className="flex-1 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                          >
                            {processingId === item.id ? <RefreshCw size={20} className="animate-spin" /> : <CheckCircle2 size={20} />} Duyệt
                          </button>
                          <button
                            onClick={() => reviewDeposit(item.id, false)}
                            disabled={processingId === item.id}
                            className="flex-1 px-4 py-2 rounded-xl bg-white border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white text-sm font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <XCircle size={20} /> Từ chối
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* PENDING WITHDRAWS */}
              <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-medium text-xl text-amber-500 flex items-center gap-2">
                    <Landmark size={22} className="text-amber-500" /> Duyệt lệnh Rút tiền
                  </h3>
                  {withdrawRequests.length > 0 && (
                    <span className=" text-amber-600 border border-amber-300 px-3 py-1 rounded-full text-sm shadow-sm">
                      {withdrawRequests.length} chờ duyệt
                    </span>
                  )}
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {withdrawRequests.length === 0 ? (
                    <div className="text-center py-10 bg-white/50 border border-dashed border-slate-300 rounded-2xl">
                      <CheckCircle2 size={40} className="mx-auto text-amber-400/50 mb-3" />
                      <p className="text-amber-500 font-medium">Không có yêu cầu rút tiền nào đang chờ.</p>
                    </div>
                  ) : (
                    withdrawRequests.map((item) => (
                      <div key={item.id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between gap-4 group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-3 h-full bg-amber-400 group-hover:bg-amber-500 transition-colors"></div>
                        <div className="flex-1 ml-2">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-medium text-slate-800 text-lg">{item.user?.name || item.userId}</p>
                            <p className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{new Date(item.createdAt).toLocaleString('vi-VN')}</p>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">
                            Số điểm rút: <strong className="text-amber-600 text-xl">{Number(item.amount).toLocaleString()} đ</strong>
                          </p>
                          <div className="text-sm text-slate-600 bg-amber-50/50 p-3 rounded-xl border border-amber-100 inline-block space-y-1">
                            <p className="text-xs font-medium text-amber-600/70">Thông tin chuyển khoản</p>
                            <p>Tên tài khoản: <strong className="text-slate-800">{item.accountName || '-'}</strong></p>
                            <p>Số tài khoản: <strong className="text-slate-800">{item.accountNumber || item.referenceCode || '-'}</strong></p>
                          </div>
                        </div>
                        <div className="flex flex-row md:flex-col gap-2 justify-center shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4 w-full md:w-32">
                          <button
                            onClick={() => reviewWithdraw(item.id, true)}
                            disabled={processingId === item.id}
                            className="flex-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium shadow-md shadow-amber-500/20 disabled:opacity-50 transition-colors"
                          >
                            Duyệt Rút
                          </button>
                          <button
                            onClick={() => reviewWithdraw(item.id, false)}
                            disabled={processingId === item.id}
                            className="flex-1 px-4 py-2 rounded-xl bg-white border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-0 text-sm font-medium disabled:opacity-50 transition-colors"
                          >
                            Từ chối
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* RECONCILIATION */}
              <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
                <h3 className="font-medium text-xl text-slate-600 mb-6 flex items-center gap-2">
                  <RefreshCw size={22} className="text-slate-500" /> Nhật ký Đối soát (Reconciliation)
                </h3>
                <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {reconciliation.length === 0 ? (
                    <div className="text-center py-10 bg-white/50 border border-dashed border-slate-300 rounded-2xl">
                      <p className="text-slate-500 font-medium">Không có sự kiện đối soát nào gần đây.</p>
                    </div>
                  ) : (
                    reconciliation.map((event) => (
                      <div key={event.id} className="p-4 rounded-2xl border border-slate-200 bg-white/80 shadow-sm text-sm flex flex-col gap-1">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-medium text-slate-800">{event.provider}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] ${event.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600 border border-emerald-300' : 'bg-slate-200 text-slate-600 border border-slate-300'}`}>
                            {event.status}
                          </span>
                        </div>
                        <p className="text-slate-600">Số tiền: <strong className="text-slate-800">{Number(event.amount).toLocaleString()} đ</strong></p>
                        <div className="flex gap-4 text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                          <p>Order ID: {event.matchedOrderId || 'UNMATCHED'}</p>
                          <p>Txn ID: {event.providerTxnId || '-'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </main>

        <style
          dangerouslySetInnerHTML={{
            __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
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