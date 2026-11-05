import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { UserRoleConst } from 'src/domain/auth/userRole.const';
import type { Company } from '@prisma/client';
import type { CreateCompanyDto } from '../dto/create-company.dto';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class CreateCompanyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(
    dto: CreateCompanyDto,
    user: AuthenticatedUser,
  ): Promise<Company> {
    const created = await this.prisma.company.create({
      data: { ...dto },
    });

    if (user.roleName !== UserRoleConst.ADMIN) {
      await this.prisma.membership.create({
        data: {
          userId: user.id,
          companyId: created.id,
          canSeeCommercials: true,
          canComment: true,
        },
      });
    }

    await this.loggingService.create(
      {
        module: 'COMPANY',
        action: LogActions.CREATE,
        message: `Company criado: ${created.name}`,
        metadata: { companyId: created.id },
      },
      user.id,
    );

    return created;
  }
}
