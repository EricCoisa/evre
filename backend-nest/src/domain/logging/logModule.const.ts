export const LogModuleConst = {
  USER: 'USER',
  AUTH: 'AUTH',
  SYSTEM: 'SYSTEM',
  HEALTH: 'HEALTH',
  USER_ROUTE_ACCESS: 'USER_ROUTE_ACCESS',
  SYSTEM_CONFIGURATION: 'SYSTEM_CONFIGURATION',
  ROUTE: 'ROUTE',
  ROLE_ROUTE_ACCESS: 'ROLE_ROUTE_ACCESS',
  USER_CONFIGURATION: 'USER_CONFIGURATION',
  USER_CONFIGURATION_DEFINITION: 'USER_CONFIGURATION_DEFINITION',
};

export type LogModule = keyof typeof LogModuleConst;
export type LogModuleValue =
  (typeof LogModuleConst)[keyof typeof LogModuleConst];
