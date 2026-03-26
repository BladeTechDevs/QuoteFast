import { PrismaClient } from '@prisma/client';

// Reuse client across warm Lambda invocations
let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}
