export type InviteTokenPayload = {
  email: string;
  role: string;
  roleId: string;
  /** Admin responsável por emitir o convite. */
  createdById: string;
  createdAt: string;
  /** Nome opcional informado ao criar o convite. */
  name?: string | null;
  companyId?: string | null;
};
