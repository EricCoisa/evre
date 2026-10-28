import type { SystemConfigurationDto } from '@/lib/generated/schemas';
import type { ConfigurationRequirements } from '@/types/capabilities';

// Tipo de configuração do sistema com `value` tipado genericamente. `requirements` sobrescrito:
// o Orval gera `{[key:string]: unknown}` por falta de schema estruturado no ApiProperty.
export type SystemConfiguration<T = unknown> = Omit<SystemConfigurationDto, 'value' | 'requirements'> & {
  value: T;
  requirements?: ConfigurationRequirements;
};

export interface UpdateSystemConfigurationDto<T> {
  labelKey: string;
  value: T;
}

// Not in openapi spec — kept locally
export enum EmailProvider {
  RESEND = 'RESEND',
  SMTP = 'SMTP'
}

export enum StorageProvider {
  S3 = 'S3',
  LOCAL = 'LOCAL',
}
