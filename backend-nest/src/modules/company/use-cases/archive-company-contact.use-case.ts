import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { CompanyContact, MessagingContact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

export type CompanyContactWithMessaging = CompanyContact & {
  messagingContact: MessagingContact;
};

/** Arquiva um vínculo empresa-contato (nada é apagado); nega antes de ler ou escrever quem não tem Membership nela. */
@Injectable()
export class ArchiveCompanyContactUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  async execute(
    companyId: string,
    contactId: string,
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

    const archived = found.archivedAt
      ? found
      : await this.prisma.companyContact.update({
          where: { id: contactId },
          data: { archivedAt: new Date() },
          include: { messagingContact: true },
        });

    if (!found.archivedAt) {
      await this.loggingService.create(
        {
          module: 'COMPANY',
          action: LogActions.ARCHIVE,
          message: `Contato arquivado: ${found.messagingContact.name ?? found.messagingContact.phone}`,
          metadata: { companyId, contactId },
        },
        user.id,
      );
    }

    return archived;
  }
}
