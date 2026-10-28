import { Injectable } from '@nestjs/common';
import type { Company } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneCompanyUseCase } from './find-one.use-case';

/** "Remover" uma empresa é arquivar — nada é apagado (histórico de propostas/contratos depende dela). */
@Injectable()
export class RemoveCompanyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneCompanyUseCase,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Company> {
    const found = await this.findOne.execute(id, user);

    const archived = found.archivedAt
      ? found
      : await this.prisma.company.update({
          where: { id },
          data: { archivedAt: new Date() },
        });

    if (!found.archivedAt) {
      await this.loggingService.create(
        {
          module: 'COMPANY',
          action: LogActions.ARCHIVE,
          message: `Company arquivado: ${found.name}`,
          metadata: { companyId: id },
        },
        user.id,
      );
    }

    return archived;
  }
}
