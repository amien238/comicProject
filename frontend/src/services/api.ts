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
  getAllComics: async () => {
    const res = await fetch(`${BASE_URL}/comics`);
    return handleResponse(res);
  },

  getComicById: async (id: string) => {
    const res = await fetch(`${BASE_URL}/comics/${id}`);
    return handleResponse(res);
  },

  searchComics: async (query: string) => {
    const res = await fetch(`${BASE_URL}/comics?search=${encodeURIComponent(query)}`);
    return handleResponse(res);
  },

  getChapters: async (comicId: string) => {
    const res = await fetch(`${BASE_URL}/chapters/comic/${comicId}`);
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
  getAllTags: async () => {
    const res = await fetch(`${BASE_URL}/tags`);
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

  uploadMultiple: async (files: FileList) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i += 1) formData.append('images', files[i]);

    const res = await fetch(`${BASE_URL}/upload/multiple`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });

    return handleResponse(res);
  },
};

export const authorApi = {
  createComic: async (data: any) => {
    const res = await fetch(`${BASE_URL}/comics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(data),
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
};

export const adminApi = {
  getStats: async () => {
    const res = await fetch(`${BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return handleResponse(res);
  },

  getUsers: async () => {
    const res = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return handleResponse(res);
  },

  updateUserRole: async (userId: string, role: string) => {
    const res = await fetch(`${BASE_URL}/admin/users/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ userId, role }),
    });

    return handleResponse(res);
  },

  deleteComic: async (comicId: string) => {
    const res = await fetch(`${BASE_URL}/admin/comics/${comicId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return handleResponse(res);
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
