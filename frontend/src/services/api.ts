const BASE_URL = 'http://localhost:5000/api';

const getToken = () => {
  if (typeof window !== 'undefined') return localStorage.getItem('token');
  return null;
};

// HÀM KIỂM SOÁT LỖI TẬP TRUNG (Phòng thủ sập Web do backend lỗi)
const handleResponse = async (res: Response) => {
  let data;
  try {
    data = await res.json();
  } catch (error) {
    if (!res.ok) throw new Error(`Lỗi kết nối máy chủ (${res.status})`);
    return null;
  }
  
  if (!res.ok) {
    throw new Error(data.error || data.message || `Lỗi HTTP: ${res.status}`);
  }
  return data;
};

// 1. API TRUYỆN TRANH
export const comicApi = {
  getAllComics: async () => {
    const res = await fetch(`${BASE_URL}/comics`);
    return handleResponse(res);
  },
  
  getComicById: async (id: string) => {
    // Lấy trực tiếp thông tin từ API Detail
    const res = await fetch(`${BASE_URL}/comics/${id}`);
    return handleResponse(res);
  },

  searchComics: async (query: string) => {
    const res = await fetch(`${BASE_URL}/comics?search=${encodeURIComponent(query)}`);
    const allComics = await handleResponse(res);
    return allComics?.filter((c: any) => 
      c.title.toLowerCase().includes(query.toLowerCase())
    ) || [];
  },

  getChapters: async (comicId: string) => {
    const res = await fetch(`${BASE_URL}/chapters/comic/${comicId}`);
    return handleResponse(res);
  },

  getChapterDetail: async (chapterId: string) => {
    const token = getToken();
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/chapters/${chapterId}/read`, { headers });
    return handleResponse(res);
  }
};

// 2. API GIAO DỊCH
export const transactionApi = {
  buyChapter: async (chapterId: string) => {
    const token = getToken();
    if (!token) throw new Error('Vui lòng đăng nhập');
    const res = await fetch(`${BASE_URL}/transactions/buy-chapter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ chapterId })
    });
    return handleResponse(res);
  },
  deposit: async (amount: number) => {
    const token = getToken();
    if (!token) throw new Error('Vui lòng đăng nhập');
    const res = await fetch(`${BASE_URL}/transactions/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount })
    });
    return handleResponse(res);
  }
};

// 3. API XÁC THỰC
export const authApi = {
  login: async (credentials: any) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    return handleResponse(res);
  },
  getMe: async () => {
    const token = getToken();
    if (!token) throw new Error('Chưa đăng nhập');
    const res = await fetch(`${BASE_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(res);
  }
};

// 4. API TƯƠNG TÁC
export const interactionApi = {
  incrementView: async (comicId: string) => {
    try { await fetch(`${BASE_URL}/interactions/view/${comicId}`, { method: 'POST' }); } catch (e) {}
  },
  toggleFavorite: async (comicId: string) => {
    const token = getToken();
    if (!token) throw new Error('Vui lòng đăng nhập!');
    const res = await fetch(`${BASE_URL}/interactions/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ comicId })
    });
    return handleResponse(res);
  },
  getComments: async (comicId: string) => {
    const res = await fetch(`${BASE_URL}/interactions/comment/${comicId}`);
    return handleResponse(res);
  },
  addComment: async (comicId: string, content: string, parentId?: string) => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/interactions/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ comicId, content, parentId })
    });
    return handleResponse(res);
  },
  rateComic: async (comicId: string, score: number) => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/interactions/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ comicId, score })
    });
    return handleResponse(res);
  }
};

// 5. API NGƯỜI DÙNG
export const userApi = {
  getUnlockedChapters: async () => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/users/me/unlocked-chapters`, { headers: { 'Authorization': `Bearer ${token}` } });
    return handleResponse(res);
  },
  getFavorites: async () => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/users/me/favorites`, { headers: { 'Authorization': `Bearer ${token}` } });
    return handleResponse(res);
  }
};

// 6. API UPLOAD & TAG
export const tagApi = {
  getAllTags: async () => {
    const res = await fetch(`${BASE_URL}/tags`);
    return handleResponse(res);
  }
};

export const uploadApi = {
  uploadSingle: async (file: File) => {
    const formData = new FormData(); formData.append('image', file);
    const res = await fetch(`${BASE_URL}/upload/single`, { method: 'POST', headers: { 'Authorization': `Bearer ${getToken()}` }, body: formData });
    return handleResponse(res);
  },
  uploadMultiple: async (files: FileList) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) formData.append('images', files[i]);
    const res = await fetch(`${BASE_URL}/upload/multiple`, { method: 'POST', headers: { 'Authorization': `Bearer ${getToken()}` }, body: formData });
    return handleResponse(res);
  }
};

export const authorApi = {
  createComic: async (data: any) => {
    const res = await fetch(`${BASE_URL}/comics`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify(data) });
    return handleResponse(res);
  },
  createChapter: async (data: any) => {
    const res = await fetch(`${BASE_URL}/chapters`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify(data) });
    return handleResponse(res);
  }
};

// 7. API QUẢN TRỊ (ADMIN)
export const adminApi = {
  getStats: async () => {
    const res = await fetch(`${BASE_URL}/admin/stats`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
    return handleResponse(res);
  },
  getUsers: async () => {
    const res = await fetch(`${BASE_URL}/admin/users`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
    return handleResponse(res);
  },
  updateUserRole: async (userId: string, role: string) => {
    const res = await fetch(`${BASE_URL}/admin/users/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ userId, role })
    });
    return handleResponse(res);
  },
  deleteComic: async (comicId: string) => {
    const res = await fetch(`${BASE_URL}/admin/comics/${comicId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  }
};

// 8. API LỊCH SỬ ĐỌC
export const historyApi = {
  updateHistory: async (comicId: string, chapterId: string) => {
    const token = getToken();
    if (!token) return; 
    const res = await fetch(`${BASE_URL}/history/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ comicId, chapterId })
    });
    return handleResponse(res);
  },
  getMyHistory: async () => {
    const token = getToken();
    if (!token) throw new Error('Chưa đăng nhập');
    const res = await fetch(`${BASE_URL}/history/me`, { headers: { 'Authorization': `Bearer ${token}` } });
    return handleResponse(res);
  }
};

// 9. API AI CHATBOT
export const aiApi = {
  chat: async (formattedHistory: any[]) => {
    const token = getToken();
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/ai/chat`, { method: 'POST', headers, body: JSON.stringify({ history: formattedHistory }) });
    return handleResponse(res);
  }
};