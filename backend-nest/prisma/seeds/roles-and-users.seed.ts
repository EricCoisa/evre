import { PrismaClient } from '@prisma/client';
import { generatePasswordHash } from './password';

export async function seedRolesAndUsers(prisma: PrismaClient) {
  const defaultPassword = process.env.SEED_USER_PASSWORD || 'admin123';
  const { hash, salt } = await generatePasswordHash(defaultPassword);

  const roleNames = ['ADMIN', 'USER', 'MODERATOR'];
  const roleMap: Record<string, string> = {};
  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, isSystem: true },
    });
    roleMap[name] = role.id;
  }
  console.log('✅ System roles loaded');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      salt,
      hash,
      name: 'Admin User',
      roleId: roleMap['ADMIN'],
    },
  });

  const moderatorUser = await prisma.user.upsert({
    where: { email: 'moderator@example.com' },
    update: {},
    create: {
      email: 'moderator@example.com',
      salt,
      hash,
      name: 'Moderator User',
      roleId: roleMap['MODERATOR'],
    },
  });

  const regularUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      salt,
      hash,
      name: 'Regular User',
      roleId: roleMap['USER'],
    },
  });
  console.log('✅ Users created');

  return { roleMap, adminUser, moderatorUser, regularUser };
}
