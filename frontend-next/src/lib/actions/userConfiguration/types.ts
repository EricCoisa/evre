import type { UserConfigurationDto } from '@/lib/generated/schemas';
import type { ConfigurationRequirements } from '@/types/capabilities';

// `value` genérico local; `requirements` sobrescrito (Orval gera `{[key:string]: unknown}` por
// falta de schema estruturado no ApiProperty). `options` e `isSecret` vêm do schema gerado.
export type UserConfiguration<T = unknown> = Omit<UserConfigurationDto, 'value' | 'requirements'> & {
  value: T;
  requirements?: ConfigurationRequirements;
};

export interface SetUserConfigurationDto<T = unknown> {
  definitionId: string;
  value: T;
}

// Not in openapi spec — kept locally
export const userRoleColors: Record<string, React.CSSProperties> = {
  ADMIN: { backgroundColor: 'var(--warning)', color: 'var(--warning-foreground)' },
  MODERATOR: { backgroundColor: 'var(--info)', color: 'var(--info-foreground)' },
  USER: { backgroundColor: 'var(--success)', color: 'var(--success-foreground)' },
};
