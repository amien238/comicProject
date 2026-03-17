const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

// 1. KIỂM TRA BIẾN MÔI TRƯỜNG
if (!process.env.DATABASE_URL) {
  console.error("LỖI: Không tìm thấy biến DATABASE_URL trong file .env!");
  process.exit(1);
}

// 2. KHỞI TẠO PRISMA (Dùng Adapter cho v7+)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;