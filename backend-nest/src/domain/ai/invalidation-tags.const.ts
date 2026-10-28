// Fonte única das tags de invalidação usadas em AiToolDefinition.invalidates.
export const InvalidationTags = {
  USER: 'user',
  ROUTE: 'route',
  FEATURE_FLAGS: 'feature-flags',
  AUTH: 'auth',
  ROLE: 'role',
  ROLE_ROUTE_ACCESS: 'role-route-access',
  SYSTEM_CONFIGURATION: 'system-configuration',
  USER_CONFIGURATION_DEFINITIONS: 'user-configuration-definitions',
  USER_CONFIGURATION: 'user-configuration',
  AI: 'ai',
  USER_ROUTE_ACCESS: 'user-route-access',
  API_KEYS: 'api-keys',
  CMS: 'cms',
  STORAGE: 'storage',
  EMAIL: 'email',
  CAPTCHA: 'captcha',
  MESSAGING: 'messaging',
  NOTIFICATION: 'notification',
} as const;
export type InvalidationTag =
  (typeof InvalidationTags)[keyof typeof InvalidationTags];
