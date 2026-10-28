import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { IMessagingProvider } from 'src/domain/interface/messaging-provider.interface';
import { MessagingConnectionService } from './messaging-connection.service';
import { MessagingEventsService } from './messaging-events.service';
import { maskPhone } from './providers/phone.util';

/** Nome e foto mudam pouco: buscar no provider no máximo uma vez por dia por contato. */
const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
/** Se a busca falhou (provider fora do ar), tenta de novo em 10 minutos, não em 24 horas. */
const PROFILE_RETRY_MS = 10 * 60 * 1000;

/** Completa nome e foto do contato pelo provider (quando o provider sabe), sem nunca derrubar quem pediu. */
@Injectable()
export class ContactProfileSyncService {
  private readonly logger = new Logger(ContactProfileSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: MessagingConnectionService,
    private readonly events: MessagingEventsService,
  ) {}

  /** Completa nome e foto do contato pelo provider; `force` ignora o intervalo de sincronização. */
  async sync(contactId: string, force = false): Promise<void> {
    const contact = await this.prisma.messagingContact.findUnique({
      where: { id: contactId },
    });
    if (!contact) return;
    const syncedAt = contact.profileSyncedAt?.getTime() ?? 0;
    if (!force && Date.now() - syncedAt < PROFILE_TTL_MS) return;

    const contactProfile = await this.pickFetcher();
    if (!contactProfile) {
      this.logger.warn(
        `Nenhuma conexão viva suporta perfil de contato; ${maskPhone(contact.phone)} não sincronizado`,
      );
      return;
    }

    let profile: Awaited<
      ReturnType<NonNullable<IMessagingProvider['contactProfile']>>
    > = null;
    let failed = false;
    try {
      profile = await contactProfile(contact.phone);
    } catch (error) {
      failed = true;
      this.logger.warn(
        `Provider não devolveu o perfil de ${maskPhone(contact.phone)}: ${String((error as Error)?.message ?? error)}`,
      );
    }

    await this.prisma.messagingContact.update({
      where: { id: contactId },
      data: {
        // Falha: adia só 10 minutos, não 24 horas, e não apaga a foto que já temos.
        profileSyncedAt: new Date(
          failed ? Date.now() - PROFILE_TTL_MS + PROFILE_RETRY_MS : Date.now(),
        ),
        ...(failed
          ? {}
          : { profilePictureUrl: profile?.profilePictureUrl ?? null }),
        ...(profile?.pushName && !contact.pushName
          ? { pushName: profile.pushName }
          : {}),
      },
    });
    this.events.emit({ type: 'contacts' });
  }

  /** Dispara `sync` sem esperar e sem lançar: para quem só quer o perfil em dia, em segundo plano. */
  syncQuietly(contactId: string): void {
    void this.sync(contactId).catch((error) =>
      this.logger.warn(
        `Perfil ${contactId} não sincronizado: ${String((error as Error)?.message ?? error)}`,
      ),
    );
  }

  /** Para a lista de contatos: completa, em segundo plano, quem nunca foi sincronizado. */
  syncInBackground(contactIds: string[]): void {
    if (contactIds.length === 0) return;
    void (async () => {
      // Nenhuma conexão viva suporta perfil (ex.: só Meta): sai sem ler o banco contato a contato.
      if (!(await this.pickFetcher())) return;
      for (const contactId of contactIds) {
        await this.sync(contactId);
      }
    })().catch((error) =>
      this.logger.warn(
        `Sincronização de perfis falhou: ${String((error as Error)?.message ?? error)}`,
      ),
    );
  }

  /** Função de perfil da primeira conexão viva que a declara; `null` se nenhuma declarar. */
  private async pickFetcher(): Promise<NonNullable<
    IMessagingProvider['contactProfile']
  > | null> {
    for (const connection of await this.connections.list()) {
      try {
        const provider = this.connections.use(connection);

        if (provider.contactProfile) {
          return provider.contactProfile.bind(provider) as NonNullable<
            IMessagingProvider['contactProfile']
          >;
        }
      } catch (error) {
        this.logger.warn(
          `Conexão ${connection.id} inválida ao procurar suporte a perfil: ${String((error as Error)?.message ?? error)}`,
        );
      }
    }
    return null;
  }
}
