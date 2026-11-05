export const RoutePathConst = {
  HOME: '/home',
  DASHBOARD: '/dashboard',
  USER: '/user',
  CMS: '/cms',
  ACCESS: '/access',
  LOGGING: '/logging',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  FEATURE_FLAGS: '/feature-flags',
  AGENT: '/agent',
  COMMUNICATION: '/comunicacao',
  COMMUNICATION_TEMPLATES: '/comunicacao/templates',
  COMPANY: '/company',
  PROPOSAL: '/proposal',
  ARTIFACT: '/artifacts',
  PROJECT: '/project',
} as const;

export type RoutePath = (typeof RoutePathConst)[keyof typeof RoutePathConst];
