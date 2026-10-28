import { Injectable, Logger } from '@nestjs/common';
import type { UserRoleValue } from 'src/domain/auth/userRole.const';
import type { RoutePath } from 'src/domain/route/route-path.const';

/** Registro em código do teto de papéis que podem receber cada Route (path → allowedRoles). */
@Injectable()
export class RouteCeilingRegistry {
  private readonly logger = new Logger(RouteCeilingRegistry.name);
  private readonly ceilings = new Map<string, UserRoleValue[]>();

  /** Declara o teto de uma rota. Path duplicado é bug de boot, não runtime. */
  register(path: RoutePath, allowedRoles: UserRoleValue[]): () => void {
    if (this.ceilings.has(path)) {
      throw new Error(`Teto de rota duplicado: ${path}`);
    }
    this.ceilings.set(path, allowedRoles);
    this.logger.log(`Teto registrado: ${path} -> [${allowedRoles.join(', ')}]`);
    return () => {
      this.ceilings.delete(path);
    };
  }

  /** Teto da rota; sem registro devolve `[]` (sem restrição). */
  allowedRolesFor(path: string): string[] {
    return this.ceilings.get(path) ?? [];
  }
}
