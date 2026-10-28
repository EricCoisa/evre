import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/** `/a/b/c` → `['/a/b/c', '/a/b', '/a']` — do mais específico para o mais genérico. */
export function pathCandidates(path: string): string[] {
  const segments = path.split('/').filter(Boolean);
  return segments
    .map((_, i) => `/${segments.slice(0, i + 1).join('/')}`)
    .reverse();
}

@Injectable()
export class CheckAccessUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /** Verifica se o usuário tem acesso a uma rota, considerando acessos individuais e da role. */
  async execute(
    userId: string,
    path: string,
    roleId?: string | null,
  ): Promise<boolean> {
    // Guard against empty or undefined path to prevent Prisma errors
    if (!path || path.trim() === '') {
      return false;
    }

    const candidates = pathCandidates(decodeURIComponent(path));
    if (candidates.length === 0) {
      return false;
    }

    // Usa o roleId já resolvido quando informado; senão busca a role do usuário no banco.
    let resolvedRoleId = roleId ?? null;
    if (roleId === undefined) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { roleId: true },
      });
      if (!user) return false;
      resolvedRoleId = user.roleId;
    }

    const routes = await this.prisma.route.findMany({
      where: { path: { in: candidates } },
      include: {
        userRouteAccesses: {
          where: { userId },
          select: { id: true, denied: true },
        },
        roleRouteAccesses: {
          where: { roleId: resolvedRoleId ?? '' },
          select: { roleId: true },
        },
      },
    });

    // A subrota cadastrada decide por si: '/settings/x' não herda o acesso de
    // '/settings'. Segmento dinâmico ('/user/<id>') não tem linha própria e cai
    // no ancestral mais próximo.
    const route = candidates
      .map((candidate) => routes.find((r) => r.path === candidate))
      .find((r) => r !== undefined);

    if (!route || !route.isActive) {
      return false;
    }

    // Override individual tem precedência sobre a role
    const userOverride = route.userRouteAccesses[0];
    if (userOverride) return !userOverride.denied;
    return route.roleRouteAccesses.length > 0;
  }
}
