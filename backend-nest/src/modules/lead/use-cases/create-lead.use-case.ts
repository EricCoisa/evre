import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { NotificationService } from '../../notification/notification.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { LeadNotificationType } from 'src/domain/lead/lead-notification-type.const';
import { UserRoleConst } from 'src/domain/auth/userRole.const';
import type { Lead } from 'src/domain/lead/lead.entity';
import type { CreateLeadDto } from '../dto/create-lead.dto';
import { normalizePhone } from '../../messaging/providers/phone.util';

@Injectable()
export class CreateLeadUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(dto: CreateLeadDto): Promise<Lead> {
    let messagingContactId: string | null = null;

    if (dto.phone) {
      const phone = normalizePhone(dto.phone);
      const contact = await this.prisma.messagingContact.upsert({
        where: { phone },
        create: { phone, name: dto.name },
        update: {},
        select: { id: true },
      });
      messagingContactId = contact.id;
    }

    const lead = await this.prisma.lead.create({
      data: {
        name: dto.name,
        phone: dto.phone ? normalizePhone(dto.phone) : null,
        email: dto.email ?? null,
        message: dto.message,
        messagingContactId,
      },
    });

    await this.loggingService.create(
      {
        module: 'LEAD',
        action: LogActions.CREATE,
        message: `Lead recebido: ${lead.name}`,
        metadata: { leadId: lead.id },
      },
      null,
    );

    await this.notificationService.notify({
      type: LeadNotificationType.LEAD_RECEIVED,
      recipients: { roleNames: [UserRoleConst.ADMIN] },
      title: 'Novo contato recebido',
      message: `${lead.name} entrou em contato${lead.phone ? ` — ${lead.phone}` : ''}${lead.email ? ` — ${lead.email}` : ''}`,
      actionUrl: '/lead',
      channels: { whatsapp: true },
    });

    return lead;
  }
}
