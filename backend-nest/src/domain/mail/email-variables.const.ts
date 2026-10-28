import {
  EmailTemplateType,
  EMAIL_TEMPLATE_TYPES,
} from './email-template-type.const';

export interface EmailTemplateVariable {
  /** Token aceito no HTML, usado como `{{ name }}`. */
  name: string;
  /** Chave i18n do rótulo mostrado ao operador (namespace `settings` no front). */
  labelKey: string;
  /** Valor fictício usado no preview do editor. */
  dummy: string;
}

const COMMON: EmailTemplateVariable[] = [
  {
    name: 'name',
    labelKey: 'emailVariable_name',
    dummy: 'Maria Silva',
  },
  {
    name: 'organization',
    labelKey: 'emailVariable_organization',
    dummy: 'Acme',
  },
  {
    name: 'message',
    labelKey: 'emailVariable_message',
    dummy: 'Texto gerado pelo sistema para este envio.',
  },
  {
    name: 'action_url',
    labelKey: 'emailVariable_action_url',
    dummy: 'https://exemplo.com/acao?token=abc123',
  },
];

/** Um template para todo o sistema de notificação — `title`/`message` vêm do evento, não do tipo. */
const NOTIFICATION: EmailTemplateVariable[] = [
  {
    name: 'name',
    labelKey: 'emailVariable_name',
    dummy: 'Maria Silva',
  },
  {
    name: 'title',
    labelKey: 'emailVariable_title',
    dummy: 'Aviso do sistema',
  },
  {
    name: 'message',
    labelKey: 'emailVariable_message',
    dummy: 'Texto gerado pelo sistema para este envio.',
  },
  {
    name: 'action_url',
    labelKey: 'emailVariable_action_url',
    dummy: 'https://exemplo.com/acao?token=abc123',
  },
];

/** Código de verificação (OTP) — qualquer propósito/chamador, variável `code` livre. */
const VERIFICATION_CODE: EmailTemplateVariable[] = [
  {
    name: 'name',
    labelKey: 'emailVariable_name',
    dummy: 'Maria Silva',
  },
  {
    name: 'code',
    labelKey: 'emailVariable_code',
    dummy: '482910',
  },
];

/** Registro único das variáveis de cada tipo de email, lido pelo editor, preview e validação. */
export const EMAIL_TEMPLATE_VARIABLES: Record<
  EmailTemplateType,
  EmailTemplateVariable[]
> = {
  INVITATION: COMMON,
  PASSWORD_RESET: COMMON,
  NOTIFICATION,
  VERIFICATION_CODE,
  SIGNUP_WELCOME: COMMON,
};

export function variablesFor(type: EmailTemplateType): EmailTemplateVariable[] {
  return EMAIL_TEMPLATE_VARIABLES[type] ?? [];
}

export { EMAIL_TEMPLATE_TYPES };
