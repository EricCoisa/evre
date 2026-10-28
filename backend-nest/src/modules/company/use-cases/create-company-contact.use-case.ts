import { Injectable } from '@nestjs/common';
import type { Contact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { CreateContactDto } from '../dto/create-contact.dto';

/** Cria um contato na empresa; nega antes de escrever quem não tem Membership nela. */
@Injectable()
export class CreateCompanyContactUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  async execute(
    companyId: string,
    dto: CreateContactDto,
    user: AuthenticatedUser,
  ): Promise<Contact> {
    await this.resourceAccess.assertCanRead(user, { companyId });

    const created = await this.prisma.contact.create({
      data: { ...dto, companyId },
    });

    await this.loggingService.create(
      {
        module: 'COMPANY',
        action: LogActions.CREATE,
        message: `Contato criado: ${created.name}`,
        metadata: { companyId, contactId: created.id },
      },
      user.id,
    );

    return created;
  }
}
