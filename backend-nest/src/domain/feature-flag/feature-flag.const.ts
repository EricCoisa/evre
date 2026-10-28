/** Registro único das categorias de feature flag da aplicação. */
export const FeatureFlagCategoryConst = {
  GENERAL: 'GENERAL',
  AI: 'AI',
  CONNECTORS: 'CONNECTORS',
  MESSAGING: 'MESSAGING',
  SYSTEM: 'SYSTEM',
  AUTH: 'AUTH',
  DASHBOARD: 'DASHBOARD',
  REPORTS: 'REPORTS',
  NOTIFICATIONS: 'NOTIFICATIONS',
} as const;

export type FeatureFlagCategory =
  (typeof FeatureFlagCategoryConst)[keyof typeof FeatureFlagCategoryConst];

export const FEATURE_FLAG_CATEGORIES = Object.values(
  FeatureFlagCategoryConst,
) as [FeatureFlagCategory, ...FeatureFlagCategory[]];
