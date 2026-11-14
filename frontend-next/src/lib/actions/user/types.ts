// Re-export generated schemas so screens get stable import paths
export type { UserDto as User, UpdateUserDto } from "@/lib/generated/schemas";

// Profile/password DTOs not fully covered by generated schema (image field is File)
export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  image?: File;
}

export interface UpdatePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export type SignUpDto = {
  /** Obrigatório no signup orgânico e convite WA (preenchido pelo usuário); opcional no convite EMAIL (pré-preenchido). */
  email?: string;
  name?: string;
  inviteToken?: string;
  /** Exigido só quando a conta é criada de fato — passo 1 do signup orgânico não envia isto. */
  password?: string;
  acceptTerms?: boolean;
};

// Auth types not covered by generated user schema
export interface ValidateInviteResponse {
  valid: boolean;
  token: string;
  /** Nulo quando channel=WHATSAPP (destinatário fornece email no cadastro). */
  email: string | null;
  /** Número E.164; presente quando channel=WHATSAPP. */
  phone?: string | null;
  channel?: 'EMAIL' | 'WHATSAPP';
  /** Convidado já tem conta: a tela oferece aceitar o convite, não cadastrar. */
  userExists: boolean;
  /** Nome opcional informado ao gerar o convite. */
  name?: string;
  /** Nome da empresa quando o convite é para membership. */
  companyName?: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  name?: string;
}

export interface CreateInviteDto {
  channel?: 'EMAIL' | 'WHATSAPP';
  email?: string;
  phone?: string;
  roleId?: string;
  name?: string;
}

export const UserStatusColors = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  SUSPENDED: "bg-red-100 text-red-800",
} as const;

export interface GrantUserRouteAccessResponse {
  id: string;
  userId: string;
  routeId: string;
  grantedBy: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
  route: { id: string; path: string; labelKey: string };
  grantedByUser: { id: string; email: string; name: string | null } | null;
}

export interface RevokeUserRouteAccessResponse {
  message: string;
}

export interface Invite {
  id: string;
  email: string | null;
  phone?: string | null;
  channel?: 'EMAIL' | 'WHATSAPP';
  name?: string | null;
  roleId: string;
  roleName: string;
  /** Null quando o convite nasceu do signup orgânico (sem admin por trás). */
  createdById: string | null;
  expiresAt: string;
  actionUrl: string | null;
  usedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RouteWithUserAccess {
  id: string;
  path: string;
  labelKey: string;
  isActive: boolean;
  hasAccess: boolean;
  accessInfo?: { createdAt: string; grantedBy: string | null } | null;
}
