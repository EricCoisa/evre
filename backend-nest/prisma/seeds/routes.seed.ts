import { PrismaClient, User } from '@prisma/client';
import { RoutePathConst } from '../../src/domain/route/route-path.const';

export async function seedRoutes(
  prisma: PrismaClient,
  roleMap: Record<string, string>,
  adminUser: User,
  regularUser: User,
) {
  const homeRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.HOME },
    update: {},
    create: {
      path: RoutePathConst.HOME,
      labelKey: 'ROUTE_HOME',
      icon: 'Home',
      ordem: 1,
      isActive: true,
    },
  });

  const dashboardRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.DASHBOARD },
    update: {},
    create: {
      path: RoutePathConst.DASHBOARD,
      labelKey: 'ROUTE_DASHBOARD',
      icon: 'LayoutDashboard',
      ordem: 2,
      isActive: true,
    },
  });

  const usersRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.USER },
    update: {},
    create: {
      path: RoutePathConst.USER,
      labelKey: 'ROUTE_USERS',
      icon: 'Users',
      ordem: 3,
      isActive: true,
    },
  });

  const cmsRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.CMS },
    update: {},
    create: {
      path: RoutePathConst.CMS,
      labelKey: 'ROUTE_CMS',
      icon: 'FileBox',
      ordem: 4,
      isActive: true,
    },
  });

  const accessRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.ACCESS },
    update: {},
    create: {
      path: RoutePathConst.ACCESS,
      labelKey: 'ROUTE_ACCESS',
      icon: 'FolderTree',
      ordem: 5,
      isActive: true,
    },
  });

  const logsRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.LOGGING },
    update: {},
    create: {
      path: RoutePathConst.LOGGING,
      labelKey: 'ROUTE_LOGGING',
      icon: 'Logs',
      ordem: 6,
      isActive: true,
    },
  });

  const profileRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.PROFILE },
    update: {},
    create: {
      path: RoutePathConst.PROFILE,
      labelKey: 'ROUTE_PROFILE',
      icon: 'CircleUser',
      ordem: 7,
      isActive: true,
    },
  });

  const settingsRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.SETTINGS },
    update: {},
    create: {
      path: RoutePathConst.SETTINGS,
      labelKey: 'ROUTE_SETTINGS',
      icon: 'Settings',
      ordem: 8,
      isActive: true,
    },
  });

  const proposalRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.PROPOSAL },
    update: {
      icon: 'FileText',
    },
    create: {
      path: RoutePathConst.PROPOSAL,
      labelKey: 'ROUTE_PROPOSAL',
      icon: 'FileText',
      ordem: 13,
      isActive: true,
    },
  });
  const companyRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.COMPANY },
    update: {
      icon: 'Building2',
    },
    create: {
      path: RoutePathConst.COMPANY,
      labelKey: 'ROUTE_COMPANY',
      icon: 'Building2',
      ordem: 12,
      isActive: true,
    },
  });
  const artifactRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.ARTIFACT },
    update: {},
    create: {
      path: RoutePathConst.ARTIFACT,
      labelKey: 'ROUTE_ARTIFACT',
      icon: 'Files',
      ordem: 14,
      isActive: true,
    },
  });
  const featureFlagsRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.FEATURE_FLAGS },
    update: {},
    create: {
      path: RoutePathConst.FEATURE_FLAGS,
      labelKey: 'ROUTE_FEATURE_FLAGS',
      icon: 'ToggleLeft',
      ordem: 9,
      isActive: true,
    },
  });

  // Agent route
  const agentRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.AGENT },
    update: {},
    create: {
      path: RoutePathConst.AGENT,
      labelKey: 'ROUTE_AGENT',
      icon: 'Bot',
      ordem: 10,
      isActive: true,
    },
  });

  const projectRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.PROJECT },
    update: {},
    create: {
      path: RoutePathConst.PROJECT,
      labelKey: 'ROUTE_PROJECT',
      icon: 'FolderKanban',
      ordem: 15,
      isActive: true,
    },
  });

  const myProjectRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.MY_PROJECT },
    update: {},
    create: {
      path: RoutePathConst.MY_PROJECT,
      labelKey: 'ROUTE_MY_PROJECT',
      icon: 'FolderKanban',
      ordem: 16,
      isActive: true,
    },
  });

  const communicationRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.COMMUNICATION },
    update: {},
    create: {
      path: RoutePathConst.COMMUNICATION,
      labelKey: 'ROUTE_COMMUNICATION',
      icon: 'MessagesSquare',
      ordem: 11,
      isActive: true,
    },
  });

  // Sub-item da sidebar: a subrota cadastrada decide por si (não herda o acesso de /comunicacao),
  // por isso entra no array `adminRoutes` abaixo — ver check-access.use-case.ts.
  const communicationTemplatesRoute = await prisma.route.upsert({
    where: { path: RoutePathConst.COMMUNICATION_TEMPLATES },
    update: {},
    create: {
      path: RoutePathConst.COMMUNICATION_TEMPLATES,
      labelKey: 'ROUTE_COMMUNICATION_TEMPLATES',
      icon: 'FileText',
      parentId: communicationRoute.id,
      ordem: 1,
      isActive: true,
      showSideBar: true,
    },
  });

  console.log('✅ Routes created');

  // Role-based route access
  const adminRoutes = [
    homeRoute,
    dashboardRoute,
    usersRoute,
    cmsRoute,
    accessRoute,
    logsRoute,
    profileRoute,
    settingsRoute,
    featureFlagsRoute,
    agentRoute,
    communicationRoute,
    communicationTemplatesRoute,
    companyRoute, proposalRoute, artifactRoute, projectRoute];
  for (const route of adminRoutes) {
    await prisma.roleRouteAccess.upsert({
      where: {
        roleId_routeId: { roleId: roleMap['ADMIN'], routeId: route.id },
      },
      update: {},
      create: { roleId: roleMap['ADMIN'], routeId: route.id },
    });
  }

  // usersRoute fica fora: seu teto em RouteCeilingRegistry (['ADMIN']) não inclui MODERATOR.
  const moderatorRoutes = [
    homeRoute,
    dashboardRoute,
    profileRoute,
    logsRoute,
    cmsRoute,
    artifactRoute,
    projectRoute,
    companyRoute,
    proposalRoute,
  ];
  for (const route of moderatorRoutes) {
    await prisma.roleRouteAccess.upsert({
      where: {
        roleId_routeId: { roleId: roleMap['MODERATOR'], routeId: route.id },
      },
      update: {},
      create: { roleId: roleMap['MODERATOR'], routeId: route.id },
    });
  }

  const userRoutes = [homeRoute, profileRoute, myProjectRoute];
  for (const route of userRoutes) {
    await prisma.roleRouteAccess.upsert({
      where: { roleId_routeId: { roleId: roleMap['USER'], routeId: route.id } },
      update: {},
      create: { roleId: roleMap['USER'], routeId: route.id },
    });
  }

  console.log('✅ Role route accesses created');

  // Personal user route access for admin (explicit grant)
  for (const route of adminRoutes) {
    await prisma.userRouteAccess.upsert({
      where: { userId_routeId: { userId: adminUser.id, routeId: route.id } },
      update: {},
      create: {
        userId: adminUser.id,
        routeId: route.id,
        grantedBy: adminUser.id,
      },
    });
  }

  await prisma.userRouteAccess.upsert({
    where: {
      userId_routeId: { userId: regularUser.id, routeId: profileRoute.id },
    },
    update: {},
    create: {
      userId: regularUser.id,
      routeId: profileRoute.id,
      grantedBy: adminUser.id,
    },
  });

  console.log('✅ User route accesses created');
}
