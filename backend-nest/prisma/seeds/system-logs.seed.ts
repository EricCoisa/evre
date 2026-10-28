import { PrismaClient, User } from '@prisma/client';

export async function seedSystemLogs(
  prisma: PrismaClient,
  adminUser: User,
  moderatorUser: User,
  regularUser: User,
) {
  await prisma.systemLog.createMany({
    data: [
      {
        module: 'SYSTEM',
        action: 'STARTUP',
        message: 'Sistema inicializado',
        metadata: JSON.stringify({ version: '1.0.0' }),
        performedById: adminUser.id,
      },
      {
        module: 'USER',
        action: 'CREATE',
        message: 'Usuário admin criado',
        metadata: JSON.stringify({ email: adminUser.email }),
        performedById: adminUser.id,
      },
      {
        module: 'USER',
        action: 'CREATE',
        message: 'Usuário moderator criado',
        metadata: JSON.stringify({ email: moderatorUser.email }),
        performedById: adminUser.id,
      },
      {
        module: 'USER',
        action: 'CREATE',
        message: 'Usuário comum criado',
        metadata: JSON.stringify({ email: regularUser.email }),
        performedById: adminUser.id,
      },
    ],
  });
  console.log('✅ System logs created');
}
