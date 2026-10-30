import { ConflictException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { CompanyContact, MessagingContact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { CreateContactDto } from '../dto/create-contact.dto';
import { CreateContactUseCase } from '../../messaging/use-cases/create-contact.use-case';
import { normalizePhone } from '../../messaging/providers/phone.util';

export type CompanyContactWithMessaging = CompanyContact & {
  messagingContact: MessagingContact;
};

/** Vincula um MessagingContact a uma empresa, criando o MC se ainda não existir. */
@Injectable()
export class CreateCompanyContactUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly resourceAccess: ResourceAccessService,
    private readonly createMessagingContact: CreateContactUseCase,
  ) {}

  async execute(
    companyId: string,
    dto: CreateContactDto,
    user: AuthenticatedUser,
  ): Promise<CompanyContactWithMessaging> {
    await this.resourceAccess.assertCanRead(user, { companyId });

    const phone = normalizePhone(dto.phone);

    const existingMc = await this.prisma.messagingContact.findUnique({
      where: { phone },
      select: { id: true },
    });
    const mcId = existingMc?.id
      ?? (await this.createMessagingContact.execute({ phone: dto.phone, name: dto.name })).id;

    const existing = await this.prisma.companyContact.findUnique({
      where: { companyId_messagingContactId: { companyId, messagingContactId: mcId } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(this.i18n.t('company.contact_already_linked'));
    }

    const { phone: _phone, name: _name, ...contactFields } = dto;

    const created = await this.prisma.companyContact.create({
      data: { ...contactFields, companyId, messagingContactId: mcId },
      include: { messagingContact: true },
    });

    await this.loggingService.create(
      {
        module: 'COMPANY',
        action: LogActions.CREATE,
        message: `Contato criado: ${created.messagingContact.name ?? created.messagingContact.phone}`,
        metadata: { companyId, contactId: created.id },
      },
      user.id,
    );

    return created;
  }
}
