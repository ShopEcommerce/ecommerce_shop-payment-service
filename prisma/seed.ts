import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import pino from 'pino';

dotenv.config();

const logger = pino();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL must be defined');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  logger.info('Seeding Payment Service Database...');

  await prisma.outboxEvent.deleteMany({});
  await prisma.processedEvent.deleteMany({});
  await prisma.paymentTransaction.deleteMany({});

  await prisma.paymentTransaction.create({
    data: {
      id: '00000000-0000-0000-0000-000000000501',
      orderId: '00000000-0000-0000-0000-000000000401',
      userId: '00000000-0000-0000-0000-000000000003',
      amount: new Prisma.Decimal('45480000'),
      currency: 'VND',
      provider: 'VNPAY',
      providerTransactionId: 'SEED-VNPAY-0001',
      status: 'SUCCESS',
    },
  });

  logger.info('Payment seed complete: one successful payment transaction created.');
}

main()
  .catch((error) => {
    logger.error(error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
