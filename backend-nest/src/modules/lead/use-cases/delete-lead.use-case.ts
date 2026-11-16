import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from 'src/modules/logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class DeleteLeadUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logging: LoggingService,
  ) {}

  async execute(id: string, user: AuthenticatedUser) {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');

    await this.prisma.lead.delete({ where: { id } });

    await this.logging.create(
      {
        module: 'LEAD',
        action: LogActions.DELETE,
        message: `Lead ${id} excluído por ${user.email ?? user.id}`,
        metadata: { leadId: id, deletedLead: existing },
      },
      user.id,
    );
  }
}
