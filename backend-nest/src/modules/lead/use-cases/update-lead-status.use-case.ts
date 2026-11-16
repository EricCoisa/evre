import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { Lead } from 'src/domain/lead/lead.entity';
import type { UpdateLeadStatusDto } from '../dto/update-lead-status.dto';

@Injectable()
export class UpdateLeadStatusUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(
    id: string,
    dto: UpdateLeadStatusDto,
    performedById: string,
  ): Promise<Lead> {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('lead.errors.not_found');

    const isResolving =
      dto.status === 'RESOLVED' && existing.status !== 'RESOLVED';

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        status: dto.status,
        resolvedById: isResolving ? performedById : existing.resolvedById,
        resolvedAt: isResolving ? new Date() : existing.resolvedAt,
      },
    });

    await this.loggingService.create(
      {
        module: 'LEAD',
        action: LogActions.UPDATE,
        message: `Status do lead atualizado para ${dto.status}`,
        metadata: { leadId: id, status: dto.status },
      },
      performedById,
    );

    return updated;
  }
}
