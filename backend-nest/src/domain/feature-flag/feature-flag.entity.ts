import type { FeatureFlagCategory } from './feature-flag.const';

export type FeatureFlagWithRoles = {
  id: string;
  key: string;
  description: string | null;
  category: FeatureFlagCategory;
  isSystem: boolean;
  enabled: boolean;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  roles: { id: string; roleId: string; role: { name: string } }[];
};

/** `include` que todo read/write de flag usa — era 5 cópias. */
export const FeatureFlagInclude = {
  roles: {
    select: { id: true, roleId: true, role: { select: { name: true } } },
  },
};
