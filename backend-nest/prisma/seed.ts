import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Senha padrão para seed (pode ser alterada via env)
  const defaultPassword = process.env.SEED_USER_PASSWORD || 'admin123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // Criar usuário ADMIN
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user created:', adminUser);

  // Criar usuário MODERATOR
  const moderatorUser = await prisma.user.upsert({
    where: { email: 'moderator@example.com' },
    update: {},
    create: {
      email: 'moderator@example.com',
      password: hashedPassword,
      name: 'Moderator User',
      role: 'MODERATOR',
    },
  });
  console.log('✅ Moderator user created:', moderatorUser);

  // Criar usuário comum (USER)
  const regularUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      password: hashedPassword,
      name: 'Regular User',
      role: 'USER',
    },
  });
  console.log('✅ Regular user created:', regularUser);

  // Criar logs de sistema de exemplo
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
        metadata: JSON.stringify({ email: adminUser.email, role: 'ADMIN' }),
        performedById: adminUser.id,
      },
      {
        module: 'USER',
        action: 'CREATE',
        message: 'Usuário moderator criado',
        metadata: JSON.stringify({
          email: moderatorUser.email,
          role: 'MODERATOR',
        }),
        performedById: adminUser.id,
      },
      {
        module: 'USER',
        action: 'CREATE',
        message: 'Usuário comum criado',
        metadata: JSON.stringify({ email: regularUser.email, role: 'USER' }),
        performedById: adminUser.id,
      },
    ],
  });

  console.log('✅ System logs created');

  // Criar rotas de exemplo
  const homeRoute = await prisma.route.upsert({
    where: { path: '/home' },
    update: {},
    create: {
      path: '/home',
      labelKey: 'ROUTE_HOME',
      icon: 'Home',
      ordem: 1,
      isHome: true,
      isActive: true,
    },
  });

  const dashboardRoute = await prisma.route.upsert({
    where: { path: '/dashboard' },
    update: {},
    create: {
      path: '/dashboard',
      labelKey: 'ROUTE_DASHBOARD',
      icon: 'LayoutDashboard',
      ordem: 2,
      isHome: false,
      isActive: true,
    },
  });

  const usersRoute = await prisma.route.upsert({
    where: { path: '/user' },
    update: {},
    create: {
      path: '/user',
      labelKey: 'ROUTE_USERS',
      icon: 'Users',
      ordem: 3,
      isHome: false,
      isActive: true,
    },
  });

  const routesRoute = await prisma.route.upsert({
    where: { path: '/access' },
    update: {},
    create: {
      path: '/access',
      labelKey: 'ROUTE_ACCESS',
      icon: 'FolderTree',
      ordem: 4,
      isHome: false,
      isActive: true,
    },
  });

  const logsRoute = await prisma.route.upsert({
    where: { path: '/logging' },
    update: {},
    create: {
      path: '/logging',
      labelKey: 'ROUTE_LOGGING',
      icon: 'Logs',
      ordem: 5,
      isHome: false,
      isActive: true,
    },
  });

  const profileRoute = await prisma.route.upsert({
    where: { path: '/profile' },
    update: {},
    create: {
      path: '/profile',
      labelKey: 'ROUTE_PROFILE',
      icon: 'CircleUser',
      ordem: 6,
      isHome: false,
      isActive: true,
    },
  });

  const settingsRoute = await prisma.route.upsert({
    where: { path: '/settings' },
    update: {},
    create: {
      path: '/settings',
      labelKey: 'ROUTE_SETTINGS',
      icon: 'Settings',
      ordem: 7,
      isHome: false,
      isActive: true,
    },
  });

  const companyRoute = await prisma.route.upsert({
    where: { path: '/company' },
    update: {},
    create: {
      path: '/company',
      labelKey: 'ROUTE_COMPANY',
      icon: 'Building2',
      ordem: 8,
      isHome: false,
      isActive: true,
    },
  });

  const proposalRoute = await prisma.route.upsert({
    where: { path: '/proposal' },
    update: {},
    create: {
      path: '/proposal',
      labelKey: 'ROUTE_PROPOSAL',
      icon: 'Newspaper',
      ordem: 8,
      isHome: false,
      isActive: true,
    },
  });

  const projectRoute = await prisma.route.upsert({
    where: { path: '/project' },
    update: {},
    create: {
      path: '/project',
      labelKey: 'ROUTE_PROJECT',
      icon: 'Box',
      ordem: 8,
      isHome: false,
      isActive: true,
    },
  });

  const contactRoute = await prisma.route.upsert({
    where: { path: '/contact' },
    update: {},
    create: {
      path: '/contact',
      labelKey: 'ROUTE_CONTACT',
      icon: 'Contact',
      ordem: 8,
      isHome: false,
      isActive: true,
    },
  });
  

  // const systemConfigurationRoute = await prisma.route.upsert({
  //   where: { path: '/systemConfiguration' },
  //   update: {},
  //   create: {
  //     path: '/systemConfiguration',
  //     labelKey: 'ROUTE_SYSTEM_CONFIGURATION',
  //     icon: 'Computer',
  //     ordem: 1,
  //     isHome: false,
  //     isActive: true,
  //   },
  // });

  console.log('✅ Routes created');

  // Criar acessos padrão por role
  // ADMIN tem acesso a todas as rotas
  const adminRoleAccesses = [
    { roleId: 'ADMIN' as const, routeId: homeRoute.id },
    { roleId: 'ADMIN' as const, routeId: dashboardRoute.id },
    { roleId: 'ADMIN' as const, routeId: usersRoute.id },
    { roleId: 'ADMIN' as const, routeId: routesRoute.id },
    { roleId: 'ADMIN' as const, routeId: logsRoute.id },
    { roleId: 'ADMIN' as const, routeId: profileRoute.id },
    { roleId: 'ADMIN' as const, routeId: settingsRoute.id },
    { roleId: 'ADMIN' as const, routeId: companyRoute.id },
    { roleId: 'ADMIN' as const, routeId: proposalRoute.id },
    { roleId: 'ADMIN' as const, routeId: projectRoute.id },
    { roleId: 'ADMIN' as const, routeId: contactRoute.id },
    // { roleId: 'ADMIN' as const, routeId: systemConfigurationRoute.id },
  ];

  for (const access of adminRoleAccesses) {
    await prisma.roleRouteAccess.upsert({
      where: {
        roleId_routeId: {
          roleId: access.roleId,
          routeId: access.routeId,
        },
      },
      update: {},
      create: access,
    });
  }

  // MODERATOR tem acesso limitado
  const moderatorRoleAccesses = [
    { roleId: 'MODERATOR' as const, routeId: homeRoute.id },
    { roleId: 'MODERATOR' as const, routeId: dashboardRoute.id },
    { roleId: 'MODERATOR' as const, routeId: usersRoute.id },
    { roleId: 'MODERATOR' as const, routeId: logsRoute.id },
    { roleId: 'MODERATOR' as const, routeId: companyRoute.id },
    { roleId: 'MODERATOR' as const, routeId: proposalRoute.id },
    { roleId: 'MODERATOR' as const, routeId: projectRoute.id },
    { roleId: 'MODERATOR' as const, routeId: contactRoute.id },
  ];

  for (const access of moderatorRoleAccesses) {
    await prisma.roleRouteAccess.upsert({
      where: {
        roleId_routeId: {
          roleId: access.roleId,
          routeId: access.routeId,
        },
      },
      update: {},
      create: access,
    });
  }

  // USER tem acesso ao home
  await prisma.roleRouteAccess.upsert({
    where: {
      roleId_routeId: {
        roleId: 'USER',
        routeId: homeRoute.id,
      },
    },
    update: {},
    create: {
      roleId: 'USER',
      routeId: homeRoute.id,
    },
  });

  console.log('✅ Role route accesses created');

  // Dar acesso específico ao usuário admin para todas as rotas
  const adminUserAccesses = [
    { userId: adminUser.id, routeId: homeRoute.id },
    { userId: adminUser.id, routeId: dashboardRoute.id },
    { userId: adminUser.id, routeId: usersRoute.id },
    { userId: adminUser.id, routeId: routesRoute.id },
    { userId: adminUser.id, routeId: logsRoute.id },
    { userId: adminUser.id, routeId: profileRoute.id },
    { userId: adminUser.id, routeId: settingsRoute.id },
    { userId: adminUser.id, routeId: companyRoute.id },
    { userId: adminUser.id, routeId: proposalRoute.id },
    { userId: adminUser.id, routeId: projectRoute.id },
    { userId: adminUser.id, routeId: contactRoute.id },
    // { userId: adminUser.id, routeId: systemConfigurationRoute.id },
  ];

  for (const access of adminUserAccesses) {
    await prisma.userRouteAccess.upsert({
      where: {
        userId_routeId: {
          userId: access.userId,
          routeId: access.routeId,
        },
      },
      update: {},
      create: {
        userId: access.userId,
        routeId: access.routeId,
        grantedBy: adminUser.id,
      },
    });
  }

  // Dar acesso específico ao usuário comum para profile
  await prisma.userRouteAccess.upsert({
    where: {
      userId_routeId: {
        userId: regularUser.id,
        routeId: profileRoute.id,
      },
    },
    update: {},
    create: {
      userId: regularUser.id,
      routeId: profileRoute.id,
      grantedBy: adminUser.id,
    },
  });

  console.log('✅ User route accesses created');

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEM_APP_NAME' },
    update: {},
    create: {
      labelKey: 'SYSTEM_APP_NAME',
      valueType: 'string',
      value: 'EVRE',
    },
  });

  // Criar configurações do sistema
  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEMCONFIG_SUPORTURL' },
    update: {},
    create: {
      labelKey: 'SYSTEMCONFIG_SUPORTURL',
      valueType: 'String',
      value: 'http://localhost:3002',
    },
  });

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEMCONFIG_THEME' },
    update: {},
    create: {
      labelKey: 'SYSTEMCONFIG_THEME',
      valueType: '[light, dark]',
      value: 'light',
    },
  });

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEMCONFIG_LOG_LIMITE' },
    update: {},
    create: {
      labelKey: 'SYSTEMCONFIG_LOG_LIMITE',
      valueType: 'Numeric',
      value: '1000', // valor padrão, ajuste conforme necessário
    },
  });

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEMCONFIG_LOG_DELETE_DAY' },
    update: {},
    create: {
      labelKey: 'SYSTEMCONFIG_LOG_DELETE_DAY',
      valueType: 'Numeric',
      value: '30',
    },
  });

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEMTOUR' },
    update: {},
    create: {
      labelKey: 'SYSTEMTOUR',
      valueType: 'String',
      value:
        '[{"content":"Aqui é a Home","selectorId":"tour-nav-0","position":"right"},{"content":"Aqui é a DashBoard","selectorId":"tour-nav-1","position":"right"},{"content":"Aqui são os Acessos","selectorId":"tour-nav-3","position":"right"}]',
    },
  });

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEMCONFIG_CONTACT_EMAIL' },
    update: {},
    create: {
      labelKey: 'SYSTEMCONFIG_CONTACT_EMAIL',
      valueType: 'string',
      value: 'contact@evre.com.br',
    },
  });

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEM_USER_CREATE' },
    update: {},
    create: {
      labelKey: 'SYSTEM_USER_CREATE',
      valueType: 'boolean',
      value: 'false',
    },
  });

  console.log('System email configurations');

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEM_EMAIL_PROVIDER' },
    update: {},
    create: {
      labelKey: 'SYSTEM_EMAIL_PROVIDER',
      valueType: '[RESEND, SMTP]',
      value: 'RESEND',
    },
  });

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEM_EMAIL_PROVIDER_API_KEY' },
    update: {},
    create: {
      labelKey: 'SYSTEM_EMAIL_PROVIDER_API_KEY',
      valueType: 'string',
      value: 'aaaaaaaa-bbbb-cccc-dddd-aaaaaaaaaaaa',
    },
  });

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEM_EMAIL_DEFAULT_FROM' },
    update: {},
    create: {
      labelKey: 'SYSTEM_EMAIL_DEFAULT_FROM',
      valueType: 'string',
      value: 'no-reply@example.com',
    },
  });

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEM_EMAIL_SMTP_HOST' },
    update: {},
    create: {
      labelKey: 'SYSTEM_EMAIL_SMTP_HOST',
      valueType: 'string',
      value: 'smtp.example.com',
    },
  });

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEM_EMAIL_SMTP_PORT' },
    update: {},
    create: {
      labelKey: 'SYSTEM_EMAIL_SMTP_PORT',
      valueType: 'string',
      value: '587',
    },
  });

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEM_EMAIL_SMTP_USER' },
    update: {},
    create: {
      labelKey: 'SYSTEM_EMAIL_SMTP_USER',
      valueType: 'string',
      value: 'user@example.com',
    },
  });

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEM_EMAIL_SMTP_PASS' },
    update: {},
    create: {
      labelKey: 'SYSTEM_EMAIL_SMTP_PASS',
      valueType: 'string',
      value: 'pass123',
    },
  });

  await prisma.systemConfiguration.upsert({
    where: { labelKey: 'SYSTEM_EMAIL_SMTP_SECURE' },
    update: {},
    create: {
      labelKey: 'SYSTEM_EMAIL_SMTP_SECURE',
      valueType: 'boolean',
      value: 'false',
    },
  });

  console.log('✅ System configurations created');

  // Criar definições de configurações de usuário
  await prisma.userConfigurationDefinition.upsert({
    where: { labelKey: 'USERCONFIG_THEME' },
    update: {},
    create: {
      labelKey: 'USERCONFIG_THEME',
      valueType: '[light, dark]',
      defaultValue: 'light',
      isRequired: false,
    },
  });

  await prisma.userConfigurationDefinition.upsert({
    where: { labelKey: 'USERCONFIG_LANGUAGE' },
    update: {},
    create: {
      labelKey: 'USERCONFIG_LANGUAGE',
      valueType: 'string',
      defaultValue: 'pt-BR',
      isRequired: false,
    },
  });

  await prisma.userConfigurationDefinition.upsert({
    where: { labelKey: 'USERTOUR' },
    update: {},
    create: {
      labelKey: 'USERTOUR',
      valueType: 'boolean',
      defaultValue: 'false',
      isRequired: false,
    },
  });

  console.log('✅ User configuration definitions created');

  // Criar algumas configurações personalizadas para o admin

  console.log('✅ User configurations created');

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
