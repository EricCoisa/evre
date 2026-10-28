import { ConflictException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { normalizePhone } from '../providers/phone.util';
import {
  toMessagingContactDto,
  type MessagingContactDto,
} from '../dto/messaging-responses.dto';

export interface CreateContactInput {
  phone: string;
  name?: string | null;
}

/** Cria o contato isolado (sem conversa): a pessoa existe antes de qualquer mensagem trocada. */
@Injectable()
export class CreateContactUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(input: CreateContactInput): Promise<MessagingContactDto> {
    const phone = normalizePhone(input.phone);
    const existing = await this.prisma.messagingContact.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(this.i18n.t('messaging.contact_exists'));
    }

    const created = await this.prisma.messagingContact.create({
      data: { phone, name: input.name ?? null },
    });
    return toMessagingContactDto(created, {
      conversationCount: 0,
      lastMessageAt: null,
      lastConnectionId: '',
    });
  }
}
