const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

const getToken = () => {
  if (typeof window !== 'undefined') return localStorage.getItem('token');
  return null;
};

const handleResponse = async (res: Response) => {
  let data: any;

  try {
    data = await res.json();
  } catch (_error) {
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return null;
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }

  return data;
};

export const comicApi = {
  getAllComics: async (query?: { search?: string; includeHidden?: boolean; authorOnly?: boolean; status?: string }) => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.includeHidden) params.set('includeHidden', 'true');
    if (query?.authorOnly) params.set('authorOnly', 'true');
    if (query?.status) params.set('status', query.status);

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${BASE_URL}/comics${suffix}`, { headers });
    return handleResponse(res);
  },

  getComicById: async (id: string) => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}/comics/${id}`, { headers });
    return handleResponse(res);
  },

  searchComics: async (query: string) => {
    const res = await fetch(`${BASE_URL}/comics?search=${encodeURIComponent(query)}`);
    return handleResponse(res);
  },

  getChapters: async (comicId: string, query?: { includeHidden?: boolean }) => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const params = new URLSearchParams();
    if (query?.includeHidden) params.set('includeHidden', 'true');
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${BASE_URL}/chapters/comic/${comicId}${suffix}`, { headers });
    return handleResponse(res);
  },

  getChapterDetail: async (chapterId: string) => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}/chapters/${chapterId}/read`, { headers });
    return handleResponse(res);
  },
};

export const transactionApi = {
  buyChapter: async (chapterId: string) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/transactions/buy-chapter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chapterId }),
    });

    return handleResponse(res);
  },

  deposit: async (amount: number) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/transactions/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount }),
    });

    return handleResponse(res);
  },

  requestDeposit: async (payload: { amount: number; method: 'BANK_TRANSFER' | 'EWALLET'; referenceCode?: string }) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/transactions/deposit/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  createPaymentOrder: async (payload: {
    amount: number;
    method: 'BANK_TRANSFER' | 'EWALLET';
    provider?: string;
    accountTarget?: string;
    note?: string;
    expiresMinutes?: number;
  }) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/transactions/payment/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  getMyPaymentOrders: async (limit = 30) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/transactions/payment/orders/me?limit=${encodeURIComponent(String(limit))}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },

  reviewDepositRequest: async (payload: { transactionId: string; approve: boolean }) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/transactions/deposit/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  transferPoints: async (payload: { fromUserId: string; toUserId: string; amount: number; reason?: string }) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/transactions/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  getAudit: async (query?: { userId?: string; type?: string; limit?: number }) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const params = new URLSearchParams();
    if (query?.userId) params.set('userId', query.userId);
    if (query?.type) params.set('type', query.type);
    if (query?.limit) params.set('limit', String(query.limit));

    const res = await fetch(`${BASE_URL}/transactions/audit?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },

  requestWithdraw: async (payload: {
    amount: number;
    method: 'BANK_TRANSFER' | 'EWALLET';
    accountName?: string;
    accountNumber: string;
    note?: string;
  }) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/transactions/withdraw/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  reviewWithdrawRequest: async (payload: {
    transactionId: string;
    approve: boolean;
    payoutReference?: string;
    reviewNote?: string;
  }) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/transactions/withdraw/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  getPaymentOrders: async (query?: { status?: string; method?: string; userId?: string; limit?: number }) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.method) params.set('method', query.method);
    if (query?.userId) params.set('userId', query.userId);
    if (query?.limit) params.set('limit', String(query.limit));

    const res = await fetch(`${BASE_URL}/transactions/payment/orders?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },

  getReconciliation: async (query?: { status?: string; provider?: string; unmatchedOnly?: boolean; limit?: number }) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.provider) params.set('provider', query.provider);
    if (query?.unmatchedOnly) params.set('unmatchedOnly', 'true');
    if (query?.limit) params.set('limit', String(query.limit));

    const res = await fetch(`${BASE_URL}/transactions/reconciliation?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },

  closePeriod: async (payload: { year?: number; month?: number; note?: string }) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/transactions/period/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  getAccountingSummary: async (query?: { year?: number; month?: number }) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const params = new URLSearchParams();
    if (query?.year) params.set('year', String(query.year));
    if (query?.month) params.set('month', String(query.month));

    const res = await fetch(`${BASE_URL}/transactions/accounting/summary?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },

  reviewPaymentOrder: async (payload: { id: string; approve: boolean }) => {
    const token = getToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    const res = await fetch(`${BASE_URL}/transactions/payment/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },
};

export const authApi = {
  getOAuthStartUrl: (provider: 'google' | 'facebook' | 'apple') => `${BASE_URL}/auth/oauth/${provider}`,

  register: async (payload: { email: string; password: string; name: string; role?: string }) => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  login: async (credentials: any) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    return handleResponse(res);
  },

  socialAuth: async (payload: {
    provider: 'google' | 'facebook' | 'apple';
    email: string;
    name: string;
    avatar?: string;
  }) => {
    const res = await fetch(`${BASE_URL}/auth/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  getMe: async () => {
    const token = getToken();
    if (!token) throw new Error('Chua dang nhap');

    const res = await fetch(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },
};

export const interactionApi = {
  incrementView: async (comicId: string) => {
    try {
      await fetch(`${BASE_URL}/interactions/view/${comicId}`, { method: 'POST' });
    } catch (_e) {
      // no-op
    }
  },

  toggleFavorite: async (comicId: string) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/interactions/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ comicId }),
    });

    return handleResponse(res);
  },

  getComments: async (comicId: string) => {
    const res = await fetch(`${BASE_URL}/interactions/comment/comic/${comicId}`);
    return handleResponse(res);
  },

  getChapterComments: async (chapterId: string) => {
    const res = await fetch(`${BASE_URL}/interactions/comment/chapter/${chapterId}`);
    return handleResponse(res);
  },

  addComment: async (payload: { comicId?: string; chapterId?: string; content: string; parentId?: string }) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/interactions/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  reportComment: async (commentId: string) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/interactions/comment/${commentId}/report`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },

  rateComic: async (comicId: string, score: number) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/interactions/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ comicId, score }),
    });

    return handleResponse(res);
  },
};

export const userApi = {
  getUnlockedChapters: async () => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/users/me/unlocked-chapters`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },

  getFavorites: async () => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/users/me/favorites`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },
};

export const tagApi = {
  getAllTags: async (query?: { includeHidden?: boolean }) => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const params = new URLSearchParams();
    if (query?.includeHidden) params.set('includeHidden', 'true');
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${BASE_URL}/tags${suffix}`, { headers });
    return handleResponse(res);
  },

  getMyTags: async () => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/tags/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },

  createTag: async (payload: { name: string; description?: string }) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  updateTag: async (
    id: string,
    payload: { name?: string; description?: string; status?: 'ACTIVE' | 'HIDDEN'; isOfficial?: boolean },
  ) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/tags/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  deleteTag: async (id: string) => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/tags/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },
};

export const uploadApi = {
  uploadSingle: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(`${BASE_URL}/upload/single`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });

    return handleResponse(res);
  },

  uploadMultiple: async (files: FileList | File[]) => {
    const formData = new FormData();
    const normalizedFiles = Array.isArray(files) ? files : Array.from(files);
    for (let i = 0; i < normalizedFiles.length; i += 1) formData.append('images', normalizedFiles[i]);

    const res = await fetch(`${BASE_URL}/upload/multiple`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });

    return handleResponse(res);
  },
};

export const authorApi = {
  getMyComics: async () => {
    const token = getToken();
    if (!token) throw new Error('Vui long dang nhap');

    const res = await fetch(`${BASE_URL}/comics/mine/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },

  createComic: async (data: any) => {
    const res = await fetch(`${BASE_URL}/comics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(data),
    });

    return handleResponse(res);
  },

  updateComic: async (comicId: string, data: any) => {
    const res = await fetch(`${BASE_URL}/comics/${comicId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(data),
    });

    return handleResponse(res);
  },

  deleteComic: async (comicId: string) => {
    const res = await fetch(`${BASE_URL}/comics/${comicId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return handleResponse(res);
  },

  createChapter: async (data: any) => {
    const res = await fetch(`${BASE_URL}/chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(data),
    });

    return handleResponse(res);
  },

  updateChapter: async (chapterId: string, data: any) => {
    const res = await fetch(`${BASE_URL}/chapters/${chapterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(data),
    });

    return handleResponse(res);
  },

  deleteChapter: async (chapterId: string) => {
    const res = await fetch(`${BASE_URL}/chapters/${chapterId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return handleResponse(res);
  },
};

export const adminApi = {
  getOverview: async () => {
    const res = await fetch(`${BASE_URL}/admin/overview`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return handleResponse(res);
  },

  getStats: async () => {
    return adminApi.getOverview();
  },

  getAuthors: async (query?: { search?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.limit) params.set('limit', String(query.limit));

    const res = await fetch(`${BASE_URL}/admin/authors?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return handleResponse(res);
  },

  getComics: async (query?: { status?: string; authorId?: string; search?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.authorId) params.set('authorId', query.authorId);
    if (query?.search) params.set('search', query.search);
    if (query?.limit) params.set('limit', String(query.limit));

    const res = await fetch(`${BASE_URL}/admin/comics?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return handleResponse(res);
  },

  moderateComic: async (
    comicId: string,
    payload: { status: 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED'; hiddenReason?: string; violationNote?: string; reason?: string },
  ) => {
    const res = await fetch(`${BASE_URL}/admin/comics/${comicId}/moderate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  getComments: async (query?: {
    status?: string;
    comicId?: string;
    chapterId?: string;
    search?: string;
    reportedOnly?: boolean;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.comicId) params.set('comicId', query.comicId);
    if (query?.chapterId) params.set('chapterId', query.chapterId);
    if (query?.search) params.set('search', query.search);
    if (query?.reportedOnly) params.set('reportedOnly', 'true');
    if (query?.limit) params.set('limit', String(query.limit));

    const res = await fetch(`${BASE_URL}/admin/comments?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return handleResponse(res);
  },

  moderateComment: async (
    commentId: string,
    payload: {
      status: 'VISIBLE' | 'HIDDEN' | 'DELETED';
      moderationNote?: string;
      reason?: string;
      warnUser?: boolean;
      suspendUser?: boolean;
    },
  ) => {
    const res = await fetch(`${BASE_URL}/admin/comments/${commentId}/moderate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  getUsers: async (query?: { search?: string; role?: string; suspended?: boolean; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.role) params.set('role', query.role);
    if (query?.suspended !== undefined) params.set('suspended', String(query.suspended));
    if (query?.limit) params.set('limit', String(query.limit));

    const res = await fetch(`${BASE_URL}/admin/users?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return handleResponse(res);
  },

  getUserHistory: async (userId: string) => {
    const res = await fetch(`${BASE_URL}/admin/users/${userId}/history`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return handleResponse(res);
  },

  updateUserStatus: async (
    userId: string,
    payload: { isSuspended?: boolean; warningCount?: number; warningDelta?: number; reason?: string },
  ) => {
    const res = await fetch(`${BASE_URL}/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  updateUserRole: async (userId: string, role: string, reason?: string) => {
    const res = await fetch(`${BASE_URL}/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ role, reason }),
    });

    return handleResponse(res);
  },

  getTags: async (query?: { status?: string; creatorId?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.creatorId) params.set('creatorId', query.creatorId);
    if (query?.limit) params.set('limit', String(query.limit));

    const res = await fetch(`${BASE_URL}/admin/tags?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return handleResponse(res);
  },

  updateTag: async (
    tagId: string,
    payload: { status?: 'ACTIVE' | 'HIDDEN'; isOfficial?: boolean; description?: string; name?: string; reason?: string },
  ) => {
    const res = await fetch(`${BASE_URL}/admin/tags/${tagId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  deleteComic: async (comicId: string) => {
    return adminApi.moderateComic(comicId, { status: 'ARCHIVED', reason: 'Archived by admin' });
  },
};

export const historyApi = {
  updateHistory: async (comicId: string, chapterId: string) => {
    const token = getToken();
    if (!token) return null;

    const res = await fetch(`${BASE_URL}/history/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ comicId, chapterId }),
    });

    return handleResponse(res);
  },

  getMyHistory: async () => {
    const token = getToken();
    if (!token) throw new Error('Chua dang nhap');

    const res = await fetch(`${BASE_URL}/history/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },
};

export const aiApi = {
  chat: async (formattedHistory: any[]) => {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ history: formattedHistory }),
    });

    return handleResponse(res);
  },
};

export const notificationApi = {
  getMyNotifications: async () => {
    const token = getToken();
    if (!token) throw new Error('Chua dang nhap');

    const res = await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return handleResponse(res);
  },

  markAsRead: async (id?: string) => {
    const token = getToken();
    if (!token) throw new Error('Chua dang nhap');

    const res = await fetch(`${BASE_URL}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(id ? { id } : {}),
    });

    return handleResponse(res);
  },
};
