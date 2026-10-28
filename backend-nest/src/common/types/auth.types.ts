export interface AuthenticatedUser {
  id: string;
  email: string;
  roleId: string | null;
  roleName: string;
}

export interface UserPayload extends AuthenticatedUser {
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}
