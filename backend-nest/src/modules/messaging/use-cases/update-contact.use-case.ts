import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  toMessagingContactDto,
  type MessagingContactDto,
} from '../dto/messaging-responses.dto';

export interface UpdateContactInput {
  name?: string | null;
  optOut?: boolean;
}

@Injectable()
export class UpdateContactUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  /** Nome e opt-out são do contato: identidade global, uma linha só por telefone. */
  async execute(
    id: string,
    input: UpdateContactInput,
  ): Promise<MessagingContactDto> {
    const contact = await this.prisma.messagingContact.findUnique({
      where: { id },
    });
    if (!contact) {
      throw new NotFoundException(this.i18n.t('messaging.contact_not_found'));
    }

    const updated = await this.prisma.messagingContact.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.optOut !== undefined
          ? {
              optOut: input.optOut,
              optOutAt: input.optOut ? new Date() : null,
            }
          : {}),
      },
    });

    const [conversationCount, latest] = await Promise.all([
      this.prisma.messagingConversation.count({ where: { contactId: id } }),
      this.prisma.messagingConversation.findFirst({
        where: { contactId: id },
        orderBy: { lastMessageAt: 'desc' },
        select: { connectionId: true, lastMessageAt: true },
      }),
    ]);
    return toMessagingContactDto(updated, {
      conversationCount,
      lastMessageAt: latest?.lastMessageAt ?? null,
      lastConnectionId: latest?.connectionId ?? '',
    });
  }
}
