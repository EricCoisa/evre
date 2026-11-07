import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from 'src/modules/logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class DeleteTimeEntryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logging: LoggingService,
  ) {}

  async execute(id: string, user: AuthenticatedUser) {
    const existing = await this.prisma.timeEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Registro de tempo não encontrado');
    }

    if (user.roleName !== 'ADMIN' && existing.userId !== user.id) {
      throw new ForbiddenException('Você não tem permissão para excluir este registro de tempo');
    }

    await this.prisma.timeEntry.delete({
      where: { id },
    });

    await this.logging.create(
      {
        module: 'TIME_TRACKING',
        action: LogActions.DELETE,
        message: `Registro de tempo ${id} excluído por ${user.email ?? user.id}`,
        metadata: {
          entryId: id,
          deletedEntry: existing,
        },
      },
      user.id,
    );

    return { success: true };
  }
}
