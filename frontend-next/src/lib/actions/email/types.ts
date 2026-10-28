import type { SaveEmailConfigDto } from '@/lib/generated/schemas';
export interface EmailProviderResponse {
  status: boolean;
  data: string;
}

export interface EmailHealthStatus {
  operational: boolean;
  reason?: string;
}

/** Corpo de `PUT /email/config`. Segredo vazio = manter o já gravado. */
export type SaveEmailConfigPayload = SaveEmailConfigDto;

// Mirrors backend's src/domain/mail/email-template-type.const.ts
export const EmailTemplateType = {
  INVITATION: 'INVITATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;

export type EmailTemplateType = (typeof EmailTemplateType)[keyof typeof EmailTemplateType];

/** Mirrors backend's src/domain/mail/email-variables.const.ts — o backend é a fonte de verdade. */
export interface EmailTemplateVariable {
  name: string;
  labelKey: string;
  dummy: string;
}

/** Item de `GET /email/templates`. */
export interface EmailTemplateInfo {
  type: EmailTemplateType;
  html: string;
  isDefault: boolean;
  defaultHtml: string;
  variables: EmailTemplateVariable[];
}
