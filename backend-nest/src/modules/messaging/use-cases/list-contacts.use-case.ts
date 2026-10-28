import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContactProfileSyncService } from '../contact-profile-sync.service';
import type { PaginationQuery } from 'src/common/schemas/pagination.schema';
import type { PaginatedResponse } from 'src/common/types/pagination.types';
import { normalizePhone } from '../providers/phone.util';
import { MessagingContactSendingConst } from 'src/domain/messaging/messaging.const';
import {
  toMessagingContactDto,
  type MessagingContactDto,
} from '../dto/messaging-responses.dto';

interface Activity {
  conversationCount: number;
  lastMessageAt: Date | null;
  /** Conexão da conversa mais recente — a tela abre direto nela quando só há uma. */
  lastConnectionId: string;
}

/** Lista contatos da atividade mais recente para a mais antiga, ordenando e paginando no banco. */
const INBOX_ORDER: Prisma.MessagingContactOrderByWithRelationInput[] = [
  { lastMessageAt: { sort: 'desc', nulls: 'last' } },
  { createdAt: 'desc' },
  { id: 'desc' },
];

@Injectable()
export class ListContactsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ContactProfileSyncService,
  ) {}

  async execute(
    query: PaginationQuery & { search?: string; connectionId?: string },
  ): Promise<PaginatedResponse<MessagingContactDto> | MessagingContactDto[]> {
    const { search, filter, connectionId, page, limit, pagination } = query;
    const searchTrim = search?.trim();
    const phoneSearch = searchTrim ? normalizePhone(searchTrim) : '';

    const where: Prisma.MessagingContactWhereInput = {};
    if (connectionId) where.conversations = { some: { connectionId } };
    if (searchTrim) {
      where.OR = [
        ...(phoneSearch ? [{ phone: { contains: phoneSearch } }] : []),
        { name: { contains: searchTrim, mode: 'insensitive' } },
        { pushName: { contains: searchTrim, mode: 'insensitive' } },
      ];
    }
    if (filter?.optOut) {
      where.optOut = filter.optOut === MessagingContactSendingConst.BLOCKED;
    }

    const [rows, total] = await Promise.all([
      this.prisma.messagingContact.findMany({
        where,
        orderBy: INBOX_ORDER,
        ...(pagination ? { skip: (page - 1) * limit, take: limit } : {}),
      }),
      pagination ? this.prisma.messagingContact.count({ where }) : 0,
    ]);
    const activity = await this.loadActivity(rows.map((row) => row.id));

    const pendingProfiles: string[] = [];
    const data = rows.map((row) => {
      if (!row.profileSyncedAt) pendingProfiles.push(row.id);
      return toMessagingContactDto(
        row,
        // Falta para contato criado sem mensagem trocada ainda (ver `CreateContactUseCase`).
        activity.get(row.id) ?? {
          conversationCount: 0,
          lastMessageAt: null,
          lastConnectionId: '',
        },
      );
    });

    this.profiles.syncInBackground(pendingProfiles);

    if (!pagination) return data;
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      filter: { optOut: Object.values(MessagingContactSendingConst) },
    };
  }

  /** Resumo das conversas dos contatos da página: quantas são e qual a conexão da mais recente. */
  private async loadActivity(
    contactIds: string[],
  ): Promise<Map<string, Activity>> {
    if (contactIds.length === 0) return new Map();
    const conversations = await this.prisma.messagingConversation.findMany({
      where: { contactId: { in: contactIds } },
      select: { contactId: true, connectionId: true, lastMessageAt: true },
    });

    const byContact = new Map<string, Activity>();
    for (const conversation of conversations) {
      const current = byContact.get(conversation.contactId);
      const isLatest =
        !current ||
        (conversation.lastMessageAt?.getTime() ?? -1) >
          (current.lastMessageAt?.getTime() ?? -1);
      byContact.set(conversation.contactId, {
        conversationCount: (current?.conversationCount ?? 0) + 1,
        lastMessageAt: isLatest
          ? conversation.lastMessageAt
          : current.lastMessageAt,
        lastConnectionId: isLatest
          ? conversation.connectionId
          : current.lastConnectionId,
      });
    }
    return byContact;
  }
}
