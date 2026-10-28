import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { LoggingService } from '../../logging/logging.service';

@Injectable()
export class ConnectionsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  /** Conectores ativos do usuário — o que a aba "Conectores" do perfil lista. */
  async list(userId: string) {
    const grants = await this.prisma.oAuthGrant.findMany({
      where: {
        userId,
        revokedAt: null,
        // Sem refresh a linha é um /authorize que ninguém concluiu: mostrar isso
        // como "conectado" só confundiria.
        refreshHash: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { name: true } } },
    });

    return grants.map((g) => ({
      id: g.id,
      clientName: g.client.name,
      scopes: g.scopes,
      createdAt: g.createdAt,
      lastUsedAt: g.lastUsedAt,
    }));
  }

  async revoke(id: string, userId: string) {
    // `userId` no where, não só no id: sem isso qualquer usuário revogaria a
    // conexão de outro só sabendo o uuid.
    const grant = await this.prisma.oAuthGrant.findFirst({
      where: { id, userId },
      include: { client: { select: { name: true } } },
    });
    if (!grant) throw new NotFoundException();

    await this.prisma.oAuthGrant.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        accessHash: null,
        refreshHash: null,
        codeHash: null,
      },
    });

    await this.loggingService.create(
      {
        module: 'MCP',
        action: LogActions.MCP_CONNECTION_REVOKED,
        message: `Conector MCP revogado: ${grant.client.name}`,
        metadata: { grantId: id, clientId: grant.clientId },
      },
      userId,
    );

    return { id, revoked: true };
  }
}
