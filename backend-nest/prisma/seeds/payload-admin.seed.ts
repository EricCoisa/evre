import { PrismaClient } from '@prisma/client';
import { generatePasswordHash } from './password';

async function payloadUsersTableExists(prisma: PrismaClient): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'payload' AND table_name = 'users'
      ) as "exists"`;
    return result[0]?.exists ?? false;
  } catch {
    return false;
  }
}

export async function seedPayloadAdmin(prisma: PrismaClient) {
  const tableExists = await payloadUsersTableExists(prisma);
  if (!tableExists) {
    console.log('⚠️ payload.users table not found — skipping payload user seed');
    return;
  }

  const { hash, salt } = await generatePasswordHash(
    process.env.PAYLOAD_CMS_PASSWORD || 'admin123',
  );
  const now = new Date();
  await prisma.$queryRaw`
    INSERT INTO payload.users (email, salt, hash, login_attempts, created_at, updated_at)
    VALUES (${'admin@example.com'}, ${salt}, ${hash}, ${0}, ${now}, ${now})
    ON CONFLICT (email) DO NOTHING`;
  console.log('✅ Payload CMS admin user created (or already exists)');
}
