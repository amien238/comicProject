"use client";
import React, { createContext, useState, useEffect, useContext } from 'react';
import { authApi } from '../services/api';

// Định nghĩa khung dữ liệu
interface AuthContextType {
  user: any;
  token: string | null;
  login: (token: string, userData: any) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

// Tạo Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider bọc ngoài ứng dụng
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  // Khi web vừa load, kiểm tra xem có token trong máy không
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      // Gọi API lấy lại thông tin user từ token này
      authApi.getMe()
        .then(userData => setUser(userData))
        .catch(() => logout()); // Token hỏng thì tự động đăng xuất
    }
  }, []);

  // Hàm xử lý khi user đăng nhập thành công
  const login = (newToken: string, userData: any) => {
    localStorage.setItem('token', newToken); // Lưu token vào trình duyệt
    setToken(newToken);
    setUser(userData);
  };

  // Hàm xử lý đăng xuất
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  // Hàm cập nhật lại số Point (sau khi nạp tiền hoặc mua truyện)
  const refreshUser = async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch (error) {
      console.error("Lỗi cập nhật user", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook tùy chỉnh để các component khác lấy dữ liệu ra dùng dễ dàng
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được dùng trong AuthProvider");
  return context;
};