import type { UserConfigurationDefinitionsDto } from '@/lib/generated/schemas';

// Só o genérico em `defaultValue` é local; `options` vem do schema gerado.
export type UserConfigurationsDefinitions<T = unknown> = Omit<UserConfigurationDefinitionsDto, 'defaultValue'> & { defaultValue: T };

export interface UpdateUserConfigurationsDefinitionsDto<T> {
  labelKey: string;
  defaultValue: T;
}
