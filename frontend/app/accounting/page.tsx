"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Scale, RefreshCw } from 'lucide-react';

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
  const [transferAmount, setTransferAmount] = useState(0);

  const isAccounter = user?.role === 'ACCOUNTER' || user?.role === 'ADMIN';

  const loadAll = async () => {
    if (!isAccounter) return;

    setLoading(true);
    try {
      const [summaryData, deposits, withdraws, reconciliationEvents] = await Promise.all([
        transactionApi.getAccountingSummary().catch(() => null),
        transactionApi.getAudit({ type: 'DEPOSIT_REQUEST', limit: 100 }).catch(() => []),
        transactionApi.getAudit({ type: 'WITHDRAW_REQUEST', limit: 100 }).catch(() => []),
        transactionApi.getReconciliation({ limit: 100 }).catch(() => []),
      ]);

      setSummary(summaryData);
      setDepositRequests((Array.isArray(deposits) ? deposits : []).filter((item) => item.status === 'PENDING'));
      setWithdrawRequests((Array.isArray(withdraws) ? withdraws : []).filter((item) => item.status === 'PENDING'));
      setReconciliation(Array.isArray(reconciliationEvents) ? reconciliationEvents : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [isAccounter]);

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

  if (!isAccounter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">
        <div className="bg-slate-800 p-8 rounded-3xl text-center border border-slate-700 shadow-xl">
          <h2 className="text-2xl font-bold mb-4">Ban khong co quyen vao khu vuc ke toan</h2>
          <button onClick={() => router.push('/')} className="bg-blue-600 px-6 py-2 rounded-xl">
            Ve Trang Chu
          </button>
        </div>
      </div>
    );
  }

  const reviewDeposit = async (id: string, approve: boolean) => {
    try {
      await transactionApi.reviewDepositRequest({ transactionId: id, approve });
      await loadAll();
    } catch (error: any) {
      alert(error.message || 'Khong xu ly duoc yeu cau nap');
    }
  };

  const reviewWithdraw = async (id: string, approve: boolean) => {
    const payoutReference = approve ? window.prompt('Nhap ma giao dich chi tien (tuy chon):') || undefined : undefined;

    try {
      await transactionApi.reviewWithdrawRequest({ transactionId: id, approve, payoutReference });
      await loadAll();
    } catch (error: any) {
      alert(error.message || 'Khong xu ly duoc yeu cau rut');
    }
  };

  const handleTransfer = async () => {
    if (!fromUserId || !toUserId || transferAmount <= 0) {
      alert('Nhap day du fromUserId, toUserId va amount > 0');
      return;
    }

    try {
      await transactionApi.transferPoints({
        fromUserId,
        toUserId,
        amount: transferAmount,
        reason: 'Manual transfer from accounting screen',
      });
      alert('Transfer thanh cong');
      setFromUserId('');
      setToUserId('');
      setTransferAmount(0);
      await loadAll();
    } catch (error: any) {
      alert(error.message || 'Transfer that bai');
    }
  };

  const closeCurrentPeriod = async () => {
    if (!window.confirm('Dong ky ke toan hien tai?')) return;

    try {
      await transactionApi.closePeriod({ note: 'Closed from accounting dashboard' });
      await loadAll();
      alert('Dong ky thanh cong');
    } catch (error: any) {
      alert(error.message || 'Dong ky that bai');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 pb-10">
      <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => {}} />

      <main className="max-w-7xl mx-auto p-4 sm:p-6 mt-4 animate-fade-in">
        <button onClick={() => router.back()} className="flex items-center text-slate-400 hover:text-white mb-6">
          <ArrowLeft size={20} className="mr-2" /> Quay lai
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center">
            <Scale className="mr-3 text-cyan-400" /> Accounting Console
          </h1>
          <button onClick={loadAll} className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-bold">
            <RefreshCw size={14} className="inline mr-2" /> Refresh
          </button>
        </div>

        {loading && <div className="text-sm text-slate-400 mb-4">Dang tai du lieu...</div>}

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
            <h3 className="font-bold mb-3">Tong quan</h3>
            {summary ? (
              <div className="space-y-1 text-sm text-slate-300">
                <p>Deposited: {summary.totals?.deposited || 0}</p>
                <p>Withdrawn paid: {summary.totals?.withdrawnPaid || 0}</p>
                <p>Pending deposit requests: {summary.totals?.pendingDepositRequests || 0}</p>
                <p>Pending withdraw requests: {summary.totals?.pendingWithdrawRequests || 0}</p>
                <p>Wallet liability: {summary.totals?.walletLiability || 0}</p>
                <p>Period: {summary.period?.year}/{summary.period?.month} ({summary.period?.status})</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Chua co du lieu tong quan.</p>
            )}
            <button onClick={closeCurrentPeriod} className="mt-3 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-sm font-bold">
              Dong ky hien tai
            </button>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
            <h3 className="font-bold mb-3">Transfer points</h3>
            <div className="grid sm:grid-cols-3 gap-2">
              <input value={fromUserId} onChange={(e) => setFromUserId(e.target.value)} placeholder="fromUserId" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
              <input value={toUserId} onChange={(e) => setToUserId(e.target.value)} placeholder="toUserId" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
              <input type="number" value={transferAmount} onChange={(e) => setTransferAmount(Number(e.target.value))} placeholder="amount" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button onClick={handleTransfer} className="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-bold">
              Transfer
            </button>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
            <h3 className="font-bold mb-3">Pending deposit requests</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {depositRequests.length === 0 ? (
                <p className="text-sm text-slate-500">Khong co yeu cau nao.</p>
              ) : (
                depositRequests.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl border border-slate-700 bg-slate-900">
                    <p className="text-sm">User: {item.user?.name || item.userId} | Amount: {item.amount}</p>
                    <p className="text-xs text-slate-500">Ref: {item.referenceCode || '-'}</p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => reviewDeposit(item.id, true)} className="px-3 py-1 rounded-lg bg-green-700 text-xs">Approve</button>
                      <button onClick={() => reviewDeposit(item.id, false)} className="px-3 py-1 rounded-lg bg-red-700 text-xs">Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
            <h3 className="font-bold mb-3">Pending withdraw requests</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {withdrawRequests.length === 0 ? (
                <p className="text-sm text-slate-500">Khong co yeu cau nao.</p>
              ) : (
                withdrawRequests.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl border border-slate-700 bg-slate-900">
                    <p className="text-sm">User: {item.user?.name || item.userId} | Amount: {item.amount}</p>
                    <p className="text-xs text-slate-500">Ref: {item.referenceCode || '-'}</p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => reviewWithdraw(item.id, true)} className="px-3 py-1 rounded-lg bg-green-700 text-xs">Approve</button>
                      <button onClick={() => reviewWithdraw(item.id, false)} className="px-3 py-1 rounded-lg bg-red-700 text-xs">Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mt-6">
          <h3 className="font-bold mb-3">Reconciliation events</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {reconciliation.length === 0 ? (
              <p className="text-sm text-slate-500">Khong co su kien doi soat.</p>
            ) : (
              reconciliation.map((event) => (
                <div key={event.id} className="p-3 rounded-xl border border-slate-700 bg-slate-900 text-sm">
                  <p>
                    Provider: {event.provider} | Status: {event.status} | Amount: {event.amount}
                  </p>
                  <p className="text-xs text-slate-500">
                    Matched order: {event.matchedOrderId || 'UNMATCHED'} | providerTxnId: {event.providerTxnId || '-'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
