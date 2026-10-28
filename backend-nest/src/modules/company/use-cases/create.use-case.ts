import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { Company } from '@prisma/client';
import type { CreateCompanyDto } from '../dto/create-company.dto';

@Injectable()
export class CreateCompanyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(
    dto: CreateCompanyDto,
    performedById: string,
  ): Promise<Company> {
    const created = await this.prisma.company.create({
      data: { ...dto },
    });

    await this.loggingService.create(
      {
        module: 'COMPANY',
        action: LogActions.CREATE,
        message: `Company criado: ${created.name}`,
        metadata: { companyId: created.id },
      },
      performedById,
    );

    return created;
  }
}
