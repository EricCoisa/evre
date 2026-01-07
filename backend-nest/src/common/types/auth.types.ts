import { UserRole } from 'src/domain/auth/userRole.const';

/**
 * Interface para o usuário autenticado retornado pelo @CurrentUser() decorator
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Interface completa do payload do usuário com todos os dados
 */
export interface UserPayload extends AuthenticatedUser {
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}
