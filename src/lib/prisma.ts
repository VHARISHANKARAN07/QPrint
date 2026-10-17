import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma client with delete protection middleware
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Middleware to block deletion of immutable records
  client.$use(async (params, next) => {
    const protectedModels = ['Order', 'Payment', 'QRHistory', 'AuditLog'];

    if (
      protectedModels.includes(params.model ?? '') &&
      (params.action === 'delete' || params.action === 'deleteMany')
    ) {
      throw new Error(
        `DELETE operation on ${params.model} is forbidden. ` +
        `Financial and audit records are immutable. Use status updates instead.`
      );
    }

    return next(params);
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
