import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { Contact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { UpdateContactDto } from '../dto/update-contact.dto';

/** Atualiza um contato da empresa; nega antes de ler ou escrever quem não tem Membership nela. */
@Injectable()
export class UpdateCompanyContactUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  async execute(
    companyId: string,
    contactId: string,
    dto: UpdateContactDto,
    user: AuthenticatedUser,
  ): Promise<Contact> {
    await this.resourceAccess.assertCanRead(user, { companyId });

    // Filtra por companyId também: contato de outra empresa não aparece nem como 404 genérico.
    const found = await this.prisma.contact.findFirst({
      where: { id: contactId, companyId },
    });
    if (!found) {
      throw new NotFoundException(this.i18n.t('company.contact_not_found'));
    }

    const updated = await this.prisma.contact.update({
      where: { id: contactId },
      data: { ...dto },
    });

    await this.loggingService.create(
      {
        module: 'COMPANY',
        action: LogActions.UPDATE,
        message: `Contato atualizado: ${updated.name}`,
        metadata: { companyId, contactId },
      },
      user.id,
    );

    return updated;
  }
}
