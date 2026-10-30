import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { CompanyContact, MessagingContact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { UpdateContactDto } from '../dto/update-contact.dto';

export type CompanyContactWithMessaging = CompanyContact & {
  messagingContact: MessagingContact;
};

/** Atualiza metadata do vínculo empresa-contato; nega antes de ler ou escrever quem não tem Membership nela. */
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
  ): Promise<CompanyContactWithMessaging> {
    await this.resourceAccess.assertCanRead(user, { companyId });

    const found = await this.prisma.companyContact.findFirst({
      where: { id: contactId, companyId },
      include: { messagingContact: true },
    });
    if (!found) {
      throw new NotFoundException(this.i18n.t('company.contact_not_found'));
    }

    const updated = await this.prisma.companyContact.update({
      where: { id: contactId },
      data: { ...dto },
      include: { messagingContact: true },
    });

    await this.loggingService.create(
      {
        module: 'COMPANY',
        action: LogActions.UPDATE,
        message: `Contato atualizado: ${found.messagingContact.name ?? found.messagingContact.phone}`,
        metadata: { companyId, contactId },
      },
      user.id,
    );

    return updated;
  }
}
