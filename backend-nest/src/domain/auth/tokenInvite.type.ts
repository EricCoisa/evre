export type InviteTokenPayload = {
  /** Nulo quando channel=WHATSAPP (destinatário fornece email no cadastro). */
  email: string | null;
  /** Número E.164; nulo quando channel=EMAIL. */
  phone?: string | null;
  channel: 'EMAIL' | 'WHATSAPP';
  role: string;
  roleId: string;
  /** Admin responsável por emitir o convite. */
  createdById: string;
  createdAt: string;
  /** Nome opcional informado ao criar o convite. */
  name?: string | null;
  companyId?: string | null;
};
