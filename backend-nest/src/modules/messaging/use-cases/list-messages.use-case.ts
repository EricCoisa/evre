import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { PaginationQuery } from 'src/common/schemas/pagination.schema';
import type { PaginatedResponse } from 'src/common/types/pagination.types';
import { paginate } from 'src/common/utils/paginate.util';
import { normalizePhone } from '../providers/phone.util';
import {
  toMessagingMessageDto,
  type MessagingMessageDto,
} from '../dto/messaging-message.dto';

@Injectable()
export class ListMessagesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: PaginationQuery & {
      connectionId?: string;
      phone?: string;
      direction?: 'INBOUND' | 'OUTBOUND';
    },
  ): Promise<PaginatedResponse<MessagingMessageDto> | MessagingMessageDto[]> {
    // `phone` não está mais na mensagem: resolve para o contato antes de filtrar.
    const contactId = query.phone
      ? await this.resolveContactId(normalizePhone(query.phone))
      : undefined;
    if (query.phone && !contactId) {
      return query.pagination
        ? {
            data: [],
            meta: {
              total: 0,
              page: query.page,
              limit: query.limit,
              totalPages: 0,
            },
          }
        : [];
    }

    const where = {
      ...(query.connectionId ? { connectionId: query.connectionId } : {}),
      ...(contactId ? { contactId } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
    };

    return paginate(query, {
      findMany: (p) =>
        this.prisma.messagingMessage.findMany({
          where,
          // `id` desempata mensagens do mesmo instante: sem ele, a ordem entre páginas não é estável.
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: { contact: { select: { phone: true } } },
          ...p,
        }),
      count: () => this.prisma.messagingMessage.count({ where }),
      map: toMessagingMessageDto,
    });
  }

  private async resolveContactId(phone: string): Promise<string | undefined> {
    const contact = await this.prisma.messagingContact.findUnique({
      where: { phone },
      select: { id: true },
    });
    return contact?.id;
  }
}
