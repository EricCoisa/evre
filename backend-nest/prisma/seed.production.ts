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
  let adminUser = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  });

  if (!adminUser) {
    adminUser = await prisma.user.upsert({
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
  }

  let homeRoute = await prisma.route.findUnique({
    where: { path: '/home' },
  });

  if (!homeRoute) {
    homeRoute = await prisma.route.upsert({
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
  }

  let dashboardRoute = await prisma.route.findUnique({
    where: { path: '/dashboard' },
  });

  if (!dashboardRoute) {
    dashboardRoute = await prisma.route.upsert({
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
  }

  let usersRoute = await prisma.route.findUnique({
    where: { path: '/user' },
  });

  if (!usersRoute) {
    usersRoute = await prisma.route.upsert({
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
  }

  let routesRoute = await prisma.route.findUnique({
    where: { path: '/access' },
  });

  if (!routesRoute) {
    routesRoute = await prisma.route.upsert({
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
  }

  let logsRoute = await prisma.route.findUnique({
    where: { path: '/logging' },
  });

  if (!logsRoute) {
    logsRoute = await prisma.route.upsert({
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
  }

  let profileRoute = await prisma.route.findUnique({
    where: { path: '/profile' },
  });

  if (!profileRoute) {
    profileRoute = await prisma.route.upsert({
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
  }

  let settingsRoute = await prisma.route.findUnique({
    where: { path: '/settings' },
  });

  if (!settingsRoute) {
    settingsRoute = await prisma.route.upsert({
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
  }

  let companyRoute = await prisma.route.findUnique({
    where: { path: '/company' },
  });

  if (!companyRoute) {
    companyRoute = await prisma.route.upsert({
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
  }

  let proposalRoute = await prisma.route.findUnique({
    where: { path: '/proposal' },
  });

  if (!proposalRoute) {
    proposalRoute = await prisma.route.upsert({
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
  }

  let projectRoute = await prisma.route.findUnique({
    where: { path: '/project' },
  });
  if (!projectRoute) {
    projectRoute = await prisma.route.upsert({
      where: { path: '/project' },
      update: {},
      create: {
        path: '/project',
        labelKey: 'ROUTE_PROJECT',
        icon: 'Box',
        ordem: 9,
        isHome: false,
        isActive: true,
      },
    });
  }

  let contactRoute = await prisma.route.findUnique({
    where: { path: '/contact' },
  });
  if (!contactRoute) {
    contactRoute = await prisma.route.upsert({
      where: { path: '/contact' },
      update: {},
      create: {
        path: '/contact',
        labelKey: 'ROUTE_CONTACT',
        icon: 'Contact',
        ordem: 9,
        isHome: false,
        isActive: true,
      },
    });
  }

  let clientLogRoute = await prisma.route.findUnique({
    where: { path: '/clientLog' },
  });
  if (!clientLogRoute) {
    clientLogRoute = await prisma.route.upsert({
      where: { path: '/clientLog' },
      update: {},
      create: {
        path: '/clientLog',
        labelKey: 'ROUTE_CLIENT_LOG',
        icon: 'Newspaper',
        ordem: 9,
        isHome: false,
        isActive: true,
      },
    });
  }

  let contractRoute = await prisma.route.findUnique({
    where: { path: '/contract-document' },
  });
  if (!contractRoute) {
    contractRoute = await prisma.route.upsert({
      where: { path: '/contract-document' },
      update: {},
      create: {
        path: '/contract-document',
        labelKey: 'ROUTE_CONTRACT_DOCUMENT',
        icon: 'Signature',
        ordem: 10,
        isHome: false,
        isActive: true,
      },
    });
  }

  let dashboardCompanyRoute = await prisma.route.findUnique({
    where: { path: '/company/dashboard' },
  });
  if (!dashboardCompanyRoute) {
    dashboardCompanyRoute = await prisma.route.upsert({
      where: { path: '/company/dashboard' },
      update: {},
      create: {
        path: '/company/dashboard',
        labelKey: 'ROUTE_COMPANY_DASHBOARD',
        icon: 'LayoutDashboard',
        ordem: 11,
        isHome: false,
        isActive: true,
      },
    });
  }

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
    { roleId: 'ADMIN' as const, routeId: clientLogRoute.id },
    { roleId: 'ADMIN' as const, routeId: contractRoute.id },
    { roleId: 'ADMIN' as const, routeId: dashboardCompanyRoute.id },
    // { roleId: 'ADMIN' as const, routeId: systemConfigurationRoute.id },
  ];

  for (const access of adminRoleAccesses) {
    const accessFor = await prisma.roleRouteAccess.findUnique({
      where: {
        roleId_routeId: { roleId: access.roleId, routeId: access.routeId },
      },
    });

    if (!accessFor) {
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
  }

  // USER tem acesso ao home e dashboard da empresa
  const userRoute = await prisma.roleRouteAccess.findUnique({
    where: { roleId_routeId: { roleId: 'USER', routeId: homeRoute.id } },
  });

  if (!userRoute) {
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
  }

  const userDashboardRoute = await prisma.roleRouteAccess.findUnique({
    where: {
      roleId_routeId: { roleId: 'USER', routeId: dashboardCompanyRoute.id },
    },
  });

  if (!userDashboardRoute) {
    await prisma.roleRouteAccess.upsert({
      where: {
        roleId_routeId: {
          roleId: 'USER',
          routeId: dashboardCompanyRoute.id,
        },
      },
      update: {},
      create: {
        roleId: 'USER',
        routeId: dashboardCompanyRoute.id,
      },
    });
  }

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
    { userId: adminUser.id, routeId: clientLogRoute.id },
    { userId: adminUser.id, routeId: contractRoute.id },
    { userId: adminUser.id, routeId: dashboardCompanyRoute.id },
    // { userId: adminUser.id, routeId: systemConfigurationRoute.id },
  ];

  for (const access of adminUserAccesses) {
    const accessFor = await prisma.userRouteAccess.findUnique({
      where: {
        userId_routeId: { userId: access.userId, routeId: access.routeId },
      },
    });

    if (!accessFor) {
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
  }

  // Criar configurações do sistema
  const SYSTEM_APP_NAME = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'SYSTEM_APP_NAME' },
  });
  if (!SYSTEM_APP_NAME) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEM_APP_NAME' },
      update: {},
      create: {
        labelKey: 'SYSTEM_APP_NAME',
        valueType: 'string',
        value: 'EVRE',
      },
    });
  }

  const SYSTEMCONFIG_SUPORTURL = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'SYSTEMCONFIG_SUPORTURL' },
  });
  if (!SYSTEMCONFIG_SUPORTURL) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEMCONFIG_SUPORTURL' },
      update: {},
      create: {
        labelKey: 'SYSTEMCONFIG_SUPORTURL',
        valueType: 'String',
        value: 'http://localhost:3002',
      },
    });
  }

  const SYSTEMCONFIG_THEME = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'SYSTEMCONFIG_THEME' },
  });
  if (!SYSTEMCONFIG_THEME) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEMCONFIG_THEME' },
      update: {},
      create: {
        labelKey: 'SYSTEMCONFIG_THEME',
        valueType: '[light, dark]',
        value: 'light',
      },
    });
  }

  const SYSTEMCONFIG_LOG_LIMITE = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'SYSTEMCONFIG_LOG_LIMITE' },
  });
  if (!SYSTEMCONFIG_LOG_LIMITE) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEMCONFIG_LOG_LIMITE' },
      update: {},
      create: {
        labelKey: 'SYSTEMCONFIG_LOG_LIMITE',
        valueType: 'Numeric',
        value: '1000', // valor padrão, ajuste conforme necessário
      },
    });
  }

  const SYSTEMCONFIG_LOG_DELETE_DAY =
    await prisma.systemConfiguration.findUnique({
      where: { labelKey: 'SYSTEMCONFIG_LOG_DELETE_DAY' },
    });
  if (!SYSTEMCONFIG_LOG_DELETE_DAY) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEMCONFIG_LOG_DELETE_DAY' },
      update: {},
      create: {
        labelKey: 'SYSTEMCONFIG_LOG_DELETE_DAY',
        valueType: 'Numeric',
        value: '30',
      },
    });
  }

  const SYSTEMTOUR = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'SYSTEMTOUR' },
  });
  if (!SYSTEMTOUR) {
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
  }

  const SYSTEM_CONTACT_EMAIL = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'SYSTEM_CONTACT_EMAIL' },
  });
  if (!SYSTEM_CONTACT_EMAIL) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEM_CONTACT_EMAIL' },
      update: {},
      create: {
        labelKey: 'SYSTEM_CONTACT_EMAIL',
        valueType: 'string',
        value: 'contact@evre.com.br',
      },
    });
  }

  const SYSTEM_USER_CREATE = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'SYSTEM_USER_CREATE' },
  });
  if (!SYSTEM_USER_CREATE) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEM_USER_CREATE' },
      update: {},
      create: {
        labelKey: 'SYSTEM_USER_CREATE',
        valueType: 'boolean',
        value: 'false',
      },
    });
  }

  const SYSTEM_EMAIL_PROVIDER = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'SYSTEM_EMAIL_PROVIDER' },
  });
  if (!SYSTEM_EMAIL_PROVIDER) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEM_EMAIL_PROVIDER' },
      update: {},
      create: {
        labelKey: 'SYSTEM_EMAIL_PROVIDER',
        valueType: '[RESEND, SMTP]',
        value: 'RESEND',
      },
    });
  }

  const SYSTEM_EMAIL_PROVIDER_API_KEY =
    await prisma.systemConfiguration.findUnique({
      where: { labelKey: 'SYSTEM_EMAIL_PROVIDER_API_KEY' },
    });
  if (!SYSTEM_EMAIL_PROVIDER_API_KEY) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEM_EMAIL_PROVIDER_API_KEY' },
      update: {},
      create: {
        labelKey: 'SYSTEM_EMAIL_PROVIDER_API_KEY',
        valueType: 'string',
        value: 'aaaaaaaa-bbbb-cccc-dddd-aaaaaaaaaaaa',
      },
    });
  }

  const SYSTEM_EMAIL_DEFAULT_FROM = await prisma.systemConfiguration.findUnique(
    {
      where: { labelKey: 'SYSTEM_EMAIL_DEFAULT_FROM' },
    },
  );
  if (!SYSTEM_EMAIL_DEFAULT_FROM) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEM_EMAIL_DEFAULT_FROM' },
      update: {},
      create: {
        labelKey: 'SYSTEM_EMAIL_DEFAULT_FROM',
        valueType: 'string',
        value: 'no-reply@example.com',
      },
    });
  }

  // Configurações SMTP
  const SYSTEM_EMAIL_SMTP_HOST = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'SYSTEM_EMAIL_SMTP_HOST' },
  });
  if (!SYSTEM_EMAIL_SMTP_HOST) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEM_EMAIL_SMTP_HOST' },
      update: {},
      create: {
        labelKey: 'SYSTEM_EMAIL_SMTP_HOST',
        valueType: 'string',
        value: 'smtp.example.com',
      },
    });
  }

  const SYSTEM_EMAIL_SMTP_PORT = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'SYSTEM_EMAIL_SMTP_PORT' },
  });
  if (!SYSTEM_EMAIL_SMTP_PORT) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEM_EMAIL_SMTP_PORT' },
      update: {},
      create: {
        labelKey: 'SYSTEM_EMAIL_SMTP_PORT',
        valueType: 'string',
        value: '587',
      },
    });
  }

  const SYSTEM_EMAIL_SMTP_USER = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'SYSTEM_EMAIL_SMTP_USER' },
  });
  if (!SYSTEM_EMAIL_SMTP_USER) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEM_EMAIL_SMTP_USER' },
      update: {},
      create: {
        labelKey: 'SYSTEM_EMAIL_SMTP_USER',
        valueType: 'string',
        value: 'user@example.com',
      },
    });
  }

  const SYSTEM_EMAIL_SMTP_PASS = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'SYSTEM_EMAIL_SMTP_PASS' },
  });
  if (!SYSTEM_EMAIL_SMTP_PASS) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEM_EMAIL_SMTP_PASS' },
      update: {},
      create: {
        labelKey: 'SYSTEM_EMAIL_SMTP_PASS',
        valueType: 'string',
        value: 'pass123',
      },
    });
  }

  const SYSTEM_EMAIL_SMTP_SECURE = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'SYSTEM_EMAIL_SMTP_SECURE' },
  });
  if (!SYSTEM_EMAIL_SMTP_SECURE) {
    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEM_EMAIL_SMTP_SECURE' },
      update: {},
      create: {
        labelKey: 'SYSTEM_EMAIL_SMTP_SECURE',
        valueType: 'boolean',
        value: 'false',
      },
    });
  }

  console.log('✅ System configurations created');

  // Criar definições de configurações de usuário
  const USERCONFIG_THEME = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'USERCONFIG_THEME' },
  });
  if (!USERCONFIG_THEME) {
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
  }

  const USERCONFIG_LANGUAGE = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'USERCONFIG_LANGUAGE' },
  });
  if (!USERCONFIG_LANGUAGE) {
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
  }

  const USERTOUR = await prisma.systemConfiguration.findUnique({
    where: { labelKey: 'USERTOUR' },
  });
  if (!USERTOUR) {
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
  }

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
