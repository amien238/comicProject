"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, AlertTriangle, Users, BookOpen, MessageSquare, Tags } from 'lucide-react';

import Navbar from '../../src/components/NavBar';
import { useAuth } from '../../src/context/AuthContext';
import { adminApi, transactionApi } from '../../src/services/api';

type AdminTab = 'overview' | 'comics' | 'comments' | 'users' | 'tags' | 'accounting';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);

  const [overview, setOverview] = useState<any>(null);
  const [comics, setComics] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [accounting, setAccounting] = useState<any>(null);

  const isAdmin = user?.role === 'ADMIN';

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [ov, acc] = await Promise.all([
        adminApi.getOverview().catch(() => null),
        transactionApi.getAccountingSummary().catch(() => null),
      ]);
      setOverview(ov);
      setAccounting(acc);
    } finally {
      setLoading(false);
    }
  };

  const loadComics = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getComics({ limit: 100 }).catch(() => []);
      setComics(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getComments({ limit: 150 }).catch(() => []);
      setComments(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getUsers({ limit: 120 }).catch(() => []);
      setUsers(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getTags({ limit: 200 }).catch(() => []);
      setTags(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadOverview();
    loadComics();
    loadComments();
    loadUsers();
    loadTags();
  }, [isAdmin]);

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

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">
        <div className="bg-slate-800 p-8 rounded-3xl text-center border border-slate-700 shadow-xl">
          <h2 className="text-2xl font-bold mb-4">Ban khong co quyen vao Admin Dashboard</h2>
          <button onClick={() => router.push('/')} className="bg-blue-600 px-6 py-2 rounded-xl">
            Ve Trang Chu
          </button>
        </div>
      </div>
    );
  }

  const moderateComic = async (comicId: string, status: 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED') => {
    const hiddenReason = status === 'HIDDEN' ? window.prompt('Ly do an truyyen:') || undefined : undefined;
    try {
      await adminApi.moderateComic(comicId, { status, hiddenReason, reason: 'Moderated from dashboard' });
      await loadComics();
    } catch (error: any) {
      alert(error.message || 'Khong cap nhat duoc trang thai truyyen');
    }
  };

  const moderateComment = async (commentId: string, status: 'VISIBLE' | 'HIDDEN' | 'DELETED') => {
    try {
      await adminApi.moderateComment(commentId, {
        status,
        reason: 'Moderated from dashboard',
        warnUser: status !== 'VISIBLE',
      });
      await loadComments();
    } catch (error: any) {
      alert(error.message || 'Khong cap nhat duoc comment');
    }
  };

  const toggleSuspend = async (targetUserId: string, current: boolean) => {
    try {
      await adminApi.updateUserStatus(targetUserId, {
        isSuspended: !current,
        reason: 'Updated from dashboard',
      });
      await loadUsers();
    } catch (error: any) {
      alert(error.message || 'Khong cap nhat duoc trang thai user');
    }
  };

  const promoteRole = async (targetUserId: string, currentRole: string) => {
    const nextRole = currentRole === 'USER' ? 'AUTHOR' : currentRole === 'AUTHOR' ? 'ACCOUNTER' : 'USER';
    try {
      await adminApi.updateUserRole(targetUserId, nextRole, 'Updated from dashboard');
      await loadUsers();
    } catch (error: any) {
      alert(error.message || 'Khong cap nhat duoc role');
    }
  };

  const toggleTag = async (tagId: string, currentStatus: 'ACTIVE' | 'HIDDEN') => {
    try {
      await adminApi.updateTag(tagId, {
        status: currentStatus === 'ACTIVE' ? 'HIDDEN' : 'ACTIVE',
        reason: 'Updated from dashboard',
      });
      await loadTags();
    } catch (error: any) {
      alert(error.message || 'Khong cap nhat duoc tag');
    }
  };

  const showUserHistory = async (targetUserId: string) => {
    try {
      const detail = await adminApi.getUserHistory(targetUserId);
      const message = [
        `Transactions: ${detail?.transactions?.length || 0}`,
        `Audit logs: ${detail?.auditLogs?.length || 0}`,
        `Comments: ${detail?.comments?.length || 0}`,
        `Notifications: ${detail?.notifications?.length || 0}`,
      ].join('\\n');
      alert(message);
    } catch (error: any) {
      alert(error.message || 'Khong tai duoc lich su user');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 pb-10">
      <Navbar onGoHome={() => router.push('/')} onOpenAuthModal={() => {}} />

      <main className="max-w-7xl mx-auto p-4 sm:p-6 mt-4 animate-fade-in">
        <button onClick={() => router.back()} className="flex items-center text-slate-400 hover:text-white mb-6">
          <ArrowLeft size={20} className="mr-2" /> Quay lai
        </button>

        <h1 className="text-3xl font-bold text-white mb-8 flex items-center">
          <Shield className="mr-3 text-red-400" /> Admin Dashboard
        </h1>

        <div className="flex flex-wrap gap-3 mb-6">
          <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-xl font-bold ${activeTab === 'overview' ? 'bg-blue-600' : 'bg-slate-800 text-slate-400'}`}>Tong quan</button>
          <button onClick={() => setActiveTab('comics')} className={`px-4 py-2 rounded-xl font-bold ${activeTab === 'comics' ? 'bg-purple-600' : 'bg-slate-800 text-slate-400'}`}>Truyen</button>
          <button onClick={() => setActiveTab('comments')} className={`px-4 py-2 rounded-xl font-bold ${activeTab === 'comments' ? 'bg-amber-600' : 'bg-slate-800 text-slate-400'}`}>Comment</button>
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-xl font-bold ${activeTab === 'users' ? 'bg-emerald-600' : 'bg-slate-800 text-slate-400'}`}>Users</button>
          <button onClick={() => setActiveTab('tags')} className={`px-4 py-2 rounded-xl font-bold ${activeTab === 'tags' ? 'bg-pink-600' : 'bg-slate-800 text-slate-400'}`}>Tags</button>
          <button onClick={() => setActiveTab('accounting')} className={`px-4 py-2 rounded-xl font-bold ${activeTab === 'accounting' ? 'bg-cyan-600' : 'bg-slate-800 text-slate-400'}`}>Accounting</button>
        </div>

        {loading && <div className="text-sm text-slate-400 mb-4">Dang tai du lieu...</div>}

        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-1">User</p>
              <p className="text-lg font-bold flex items-center"><Users size={16} className="mr-2 text-blue-400" />{overview?.users?.USER || 0}</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-1">Comics Published</p>
              <p className="text-lg font-bold flex items-center"><BookOpen size={16} className="mr-2 text-purple-400" />{overview?.comics?.PUBLISHED || 0}</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-1">Reported/Hidden Comments</p>
              <p className="text-lg font-bold flex items-center"><MessageSquare size={16} className="mr-2 text-amber-400" />{overview?.comments?.HIDDEN || 0}</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-1">Unmatched Reconciliation</p>
              <p className="text-lg font-bold flex items-center"><AlertTriangle size={16} className="mr-2 text-red-400" />{overview?.unmatchedReconciliation || 0}</p>
            </div>
          </div>
        )}

        {activeTab === 'comics' && (
          <div className="space-y-3">
            {comics.map((comic) => (
              <div key={comic.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex flex-wrap justify-between gap-2 items-center">
                  <div>
                    <p className="font-bold">{comic.title}</p>
                    <p className="text-xs text-slate-500">Author: {comic.author?.name || 'Unknown'} | Status: {comic.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => moderateComic(comic.id, 'PUBLISHED')} className="px-3 py-1 rounded-lg bg-green-700 text-xs">Hien</button>
                    <button onClick={() => moderateComic(comic.id, 'HIDDEN')} className="px-3 py-1 rounded-lg bg-yellow-700 text-xs">An</button>
                    <button onClick={() => moderateComic(comic.id, 'ARCHIVED')} className="px-3 py-1 rounded-lg bg-slate-700 text-xs">Archive</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex flex-wrap justify-between gap-2 items-start">
                  <div className="max-w-3xl">
                    <p className="text-sm text-slate-300">{comment.content}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {comment.user?.name || 'User'} | Status: {comment.status} | Reported: {comment.reportedCount || 0}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => moderateComment(comment.id, 'VISIBLE')} className="px-3 py-1 rounded-lg bg-green-700 text-xs">Hien</button>
                    <button onClick={() => moderateComment(comment.id, 'HIDDEN')} className="px-3 py-1 rounded-lg bg-yellow-700 text-xs">An</button>
                    <button onClick={() => moderateComment(comment.id, 'DELETED')} className="px-3 py-1 rounded-lg bg-red-700 text-xs">Xoa</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex flex-wrap justify-between gap-2 items-center">
                  <div>
                    <p className="font-bold">{u.name} ({u.role})</p>
                    <p className="text-xs text-slate-500">{u.email} | Warnings: {u.warningCount} | Suspended: {String(u.isSuspended)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggleSuspend(u.id, Boolean(u.isSuspended))} className="px-3 py-1 rounded-lg bg-yellow-700 text-xs">
                      {u.isSuspended ? 'Bo khoa' : 'Khoa'}
                    </button>
                    <button onClick={() => promoteRole(u.id, u.role)} className="px-3 py-1 rounded-lg bg-blue-700 text-xs">Doi role</button>
                    <button onClick={() => showUserHistory(u.id)} className="px-3 py-1 rounded-lg bg-slate-700 text-xs">History</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'tags' && (
          <div className="space-y-3">
            {tags.map((tag) => (
              <div key={tag.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <p className="font-bold flex items-center"><Tags size={14} className="mr-2 text-pink-400" />{tag.name}</p>
                    <p className="text-xs text-slate-500">Creator: {tag.createdBy?.name || 'System'} | Status: {tag.status}</p>
                  </div>
                  <button onClick={() => toggleTag(tag.id, tag.status)} className="px-3 py-1 rounded-lg bg-slate-700 text-xs">
                    {tag.status === 'ACTIVE' ? 'An tag' : 'Hien tag'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'accounting' && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h3 className="font-bold mb-3">Bao cao Accounting (thang hien tai)</h3>
            {!accounting ? (
              <p className="text-sm text-slate-500">Chua co du lieu.</p>
            ) : (
              <div className="space-y-2 text-sm text-slate-300">
                <p>Deposited: {accounting.totals?.deposited || 0}</p>
                <p>Withdrawn paid: {accounting.totals?.withdrawnPaid || 0}</p>
                <p>Pending deposit requests: {accounting.totals?.pendingDepositRequests || 0}</p>
                <p>Pending withdraw requests: {accounting.totals?.pendingWithdrawRequests || 0}</p>
                <p>Wallet liability: {accounting.totals?.walletLiability || 0}</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
