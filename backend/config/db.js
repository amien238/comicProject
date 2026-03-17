const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL in environment.');
  process.exit(1);
}

const globalForPrisma = global;

if (!globalForPrisma.__pgPool) {
  globalForPrisma.__pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
}

if (!globalForPrisma.__prismaClient) {
  const adapter = new PrismaPg(globalForPrisma.__pgPool);
  globalForPrisma.__prismaClient = new PrismaClient({ adapter });
}

const prisma = globalForPrisma.__prismaClient;

module.exports = prisma;