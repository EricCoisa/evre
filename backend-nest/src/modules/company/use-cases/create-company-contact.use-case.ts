import { ConflictException, Injectable } from '@nestjs/common';
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

    // Usa o fluxo canônico de criação de MC (normalização, regras); se já existe, apenas busca.
    let mcId: string;
    try {
      const created = await this.createMessagingContact.execute({
        phone: dto.phone,
        name: dto.name,
      });
      mcId = created.id;
    } catch (e) {
      if (!(e instanceof ConflictException)) throw e;
      const existing = await this.prisma.messagingContact.findUniqueOrThrow({
        where: { phone },
        select: { id: true },
      });
      mcId = existing.id;
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
