export type VerificationChannel = 'EMAIL' | 'WHATSAPP' | 'AUTHENTICATOR';

export interface VerificationChallenge {
  /** Chave de propósito definida pelo módulo dono do recurso (ex. "USER_PHONE_CONFIRMATION"). */
  purpose: string;
  channel: VerificationChannel;
  /** Email/telefone/etc. para o qual o código foi (ou será) enviado. */
  target: string;
}

export interface RequestVerificationInput {
  purpose: string;
  channel: VerificationChannel;
  target?: string;
}

export interface VerificationRequestResult {
  expiresAt: string;
}

export interface ConfirmVerificationInput {
  purpose: string;
  code: string;
}

/** "Pronto para enviar" — ver docs/backend/verification.md (não cobre aprovação de template por provider). */
export interface VerificationChannelHealth {
  operational: boolean;
  reason?: string;
}
