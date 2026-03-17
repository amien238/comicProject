/**
 * ComicNexus API Service
 * Cấu hình kết nối Backend và xử lý lỗi tập trung
 */

const BASE_URL = 'http://localhost:5000/api';

/**
 * Lấy mã Token từ trình duyệt để xác thực người dùng
 */
const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

/**
 * HÀM KIỂM SOÁT LỖI TẬP TRUNG (PHÒNG THỦ)
 * Chặn các trường hợp Backend trả về lỗi 404, 500 khiến Frontend bị sập
 */
const handleResponse = async (res: Response) => {
  let data;
  try {
    data = await res.json();
  } catch (error) {
    // Trường hợp Backend không trả về JSON (ví dụ lỗi Gateway hoặc chết Server)
    //if (!res.ok) throw new Error(`Máy chủ không phản hồi (${res.status})`);
    return null;
  }
  
  // Nếu mã HTTP không nằm trong khoảng 200-299
  if (!res.ok) {
    throw new Error(data.error || data.message || `Lỗi hệ thống: ${res.status}`);
  }
  
  return data;
};

// ==========================================
// 1. API XÁC THỰC (AUTH)
// ==========================================
export const authApi = {
  login: async (credentials: any) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    return handleResponse(res);
  },
  register: async (credentials: any) => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    return handleResponse(res);
  },
  getMe: async () => {
    const res = await fetch(`${BASE_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  }
};

// ==========================================
// 2. API TRUYỆN TRANH & CHƯƠNG
// ==========================================
export const comicApi = {
  getAllComics: async () => {
    const res = await fetch(`${BASE_URL}/comics`);
    return handleResponse(res);
  },
  getComicById: async (id: string) => {
    const res = await fetch(`${BASE_URL}/comics/${id}`);
    return handleResponse(res);
  },
  getChapters: async (comicId: string) => {
    const res = await fetch(`${BASE_URL}/chapters/comic/${comicId}`);
    return handleResponse(res);
  },
  getChapterDetail: async (chapterId: string) => {
    const res = await fetch(`${BASE_URL}/chapters/${chapterId}/read`, {
      headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
    });
    return handleResponse(res);
  }
};

// ==========================================
// 3. API KINH TẾ (NẠP TIỀN & MUA TRUYỆN)
// ==========================================
export const transactionApi = {
  deposit: async (amount: number) => {
    const res = await fetch(`${BASE_URL}/transactions/deposit`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify({ amount })
    });
    return handleResponse(res);
  },
  buyChapter: async (chapterId: string) => {
    const res = await fetch(`${BASE_URL}/transactions/buy-chapter`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify({ chapterId })
    });
    return handleResponse(res);
  }
};

// ==========================================
// 4. API DỮ LIỆU CÁ NHÂN (USER DATA)
// ==========================================
export const userApi = {
  getUnlockedChapters: async () => {
    const res = await fetch(`${BASE_URL}/users/me/unlocked-chapters`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  },
  getFavorites: async () => {
    const res = await fetch(`${BASE_URL}/users/me/favorites`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  }
};

// ==========================================
// 5. API TƯƠNG TÁC (VIEW, RATE, BÌNH LUẬN)
// ==========================================
export const interactionApi = {
  incrementView: async (comicId: string) => {
    const res = await fetch(`${BASE_URL}/interactions/view/${comicId}`, { 
      method: 'POST' 
    });
    return handleResponse(res);
  },
  rateComic: async (comicId: string, score: number, review?: string) => {
    const res = await fetch(`${BASE_URL}/interactions/rate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify({ comicId, score, review })
    });
    return handleResponse(res);
  },
  toggleFavorite: async (comicId: string) => {
    const res = await fetch(`${BASE_URL}/interactions/favorite`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify({ comicId })
    });
    return handleResponse(res);
  },
  getComments: async (comicId: string) => {
    const res = await fetch(`${BASE_URL}/interactions/comment/${comicId}`);
    return handleResponse(res);
  },
  // Hỗ trợ bình luận đa tầng (Reply) qua tham số parentId
  addComment: async (comicId: string, content: string, parentId?: string) => {
    const res = await fetch(`${BASE_URL}/interactions/comment`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify({ comicId, content, parentId })
    });
    return handleResponse(res);
  }
};

// ==========================================
// 6. API LỊCH SỬ ĐỌC & THÔNG BÁO
// ==========================================
export const historyApi = {
  updateHistory: async (comicId: string, chapterId: string) => {
    const res = await fetch(`${BASE_URL}/history/update`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify({ comicId, chapterId })
    });
    return handleResponse(res);
  },
  getMyHistory: async () => {
    const res = await fetch(`${BASE_URL}/history/me`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  }
};

export const notificationApi = {
  getNotifications: async () => {
    const res = await fetch(`${BASE_URL}/notifications`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  },
  markRead: async () => {
    const res = await fetch(`${BASE_URL}/notifications/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  }
};

// ==========================================
// 7. API TÁC GIẢ & UPLOAD (AUTHOR TOOLS)
// ==========================================
export const tagApi = {
  getAllTags: async () => {
    const res = await fetch(`${BASE_URL}/tags`);
    return handleResponse(res);
  }
};

export const uploadApi = {
  uploadSingle: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE_URL}/upload/single`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData
    });
    return handleResponse(res);
  },
  uploadMultiple: async (files: FileList) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }
    const res = await fetch(`${BASE_URL}/upload/multiple`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData
    });
    return handleResponse(res);
  }
};

export const authorApi = {
  createComic: async (data: any) => {
    const res = await fetch(`${BASE_URL}/comics`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  createChapter: async (data: any) => {
    const res = await fetch(`${BASE_URL}/chapters`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  }
};

// ==========================================
// 8. API QUẢN TRỊ (ADMIN DASHBOARD)
// ==========================================
export const adminApi = {
  getStats: async () => {
    const res = await fetch(`${BASE_URL}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  },
  getUsers: async () => {
    const res = await fetch(`${BASE_URL}/admin/users`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  },
  updateUserRole: async (userId: string, role: string) => {
    const res = await fetch(`${BASE_URL}/admin/users/role`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${getToken()}` 
      },
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

// ==========================================
// 9. API TRỢ LÝ AI (NEXUS BOT)
// ==========================================
export const aiApi = {
  chat: async (history: any[]) => {
    const res = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify({ history })
    });
    return handleResponse(res);
  }
};