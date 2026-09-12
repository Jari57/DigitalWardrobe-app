import { PrismaClient } from '@prisma/client';

const globalDb = globalThis as unknown as { wardrobeDb?: PrismaClient };
export const db = globalDb.wardrobeDb ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalDb.wardrobeDb = db;
