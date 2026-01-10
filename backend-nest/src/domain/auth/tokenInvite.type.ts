export type InviteTokenPayload = {
  email: string;
  role: string;
  createdById: string;
  createdAt: string;
  companyId?: string; // Presente apenas em convites de empresa
};
