import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedRolesAndUsers } from './seeds/roles-and-users.seed';
import { seedPayloadAdmin } from './seeds/payload-admin.seed';
import { seedRoutes } from './seeds/routes.seed';
import { seedSystemLogs } from './seeds/system-logs.seed';
import { seedSystemConfigurations } from './seeds/system-config.seed';
import { seedFeatureFlags } from './seeds/feature-flags.seed';
import { seedMessagingTemplates } from './seeds/messaging-templates.seed';
import { seedUserConfigDefinitions } from './seeds/user-config-definitions.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const { roleMap, adminUser, moderatorUser, regularUser } =
    await seedRolesAndUsers(prisma);
  await seedPayloadAdmin(prisma);
  await seedRoutes(prisma, roleMap, adminUser, regularUser);
  await seedSystemLogs(prisma, adminUser, moderatorUser, regularUser);
  await seedSystemConfigurations(prisma);
  await seedFeatureFlags(prisma, roleMap);
  await seedMessagingTemplates(prisma);
  await seedUserConfigDefinitions(prisma);

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
