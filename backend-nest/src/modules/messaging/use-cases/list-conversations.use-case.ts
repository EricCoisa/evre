import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { normalizePhone } from '../providers/phone.util';
import {
  toMessagingConversationSummaryDto,
  type MessagingConversationSummaryDto,
} from '../dto/messaging-responses.dto';

/** As threads de um telefone, para o seletor decidir entre abrir direto, listar ou escolher a conexão que envia. */
@Injectable()
export class ListConversationsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(phone: string): Promise<MessagingConversationSummaryDto[]> {
    const normalized = normalizePhone(phone);
    const contact = await this.prisma.messagingContact.findUnique({
      where: { phone: normalized },
      select: { id: true },
    });
    if (!contact) return [];

    const conversations = await this.prisma.messagingConversation.findMany({
      where: { contactId: contact.id },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        connection: {
          select: { provider: true, phone: true, archivedAt: true },
        },
      },
    });
    return conversations.map(toMessagingConversationSummaryDto);
  }
}
