import type { Metadata } from "next";
import "./globals.css";
// Import trạm quản lý user của chúng ta
import { AuthProvider } from "../src/context/AuthContext";

export const metadata: Metadata = {
  title: "AmienComic - Thế giới truyện tranh",
  description: "Nền tảng đọc truyện tranh bản quyền",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      {/* Đã thêm class màu nền gốc của dự án vào body */}
      <body className="bg-[#0f172a] text-slate-100 font-sans selection:bg-blue-500/30 antialiased">
        {/* Bọc toàn bộ web bằng AuthProvider */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}