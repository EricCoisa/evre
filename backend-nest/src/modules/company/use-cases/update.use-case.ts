import { Injectable } from '@nestjs/common';
import type { Company } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { UpdateCompanyDto } from '../dto/update-company.dto';
import { FindOneCompanyUseCase } from './find-one.use-case';

@Injectable()
export class UpdateCompanyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneCompanyUseCase,
  ) {}

  async execute(
    id: string,
    dto: UpdateCompanyDto,
    user: AuthenticatedUser,
  ): Promise<Company> {
    // Prisma num id inexistente estoura P2025 (500, não 404).
    await this.findOne.execute(id, user);

    const updated = await this.prisma.company.update({
      where: { id },
      data: { ...dto },
    });

    await this.loggingService.create(
      {
        module: 'COMPANY',
        action: LogActions.UPDATE,
        message: `Company atualizado: ${updated.name}`,
        metadata: { companyId: id },
      },
      user.id,
    );

    return updated;
  }
}
