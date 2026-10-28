import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type MessagingConnection } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { CryptoService } from 'src/common/infrastructure/crypto/crypto.service';
import type { IMessagingProvider } from 'src/domain/interface/messaging-provider.interface';
import type { MessagingProvider } from 'src/domain/messaging/messaging.const';
import { MessagingProviderRegistry } from './messaging-provider.registry';

/** Índice único parcial que garante, no banco, no máximo uma conexão padrão (ver a migration). */
const SINGLE_DEFAULT_INDEX = 'messaging_connections_single_default';

/** Índice ou campos que um erro de unicidade (P2002) violou; `null` se o erro não for esse. */
function violatedIndex(error: unknown): string | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return null;
  }
  const meta = error.meta as
    { target?: unknown; constraint?: unknown } | undefined;
  const field = meta?.target ?? meta?.constraint;
  if (typeof field === 'string') return field;
  if (Array.isArray(field) && field.every((f) => typeof f === 'string')) {
    return field.join(', ');
  }
  return '';
}

/** Valores de `config` já decifrados, no formato que o schema do provider espera. */
export type PlainConfig = Record<string, string>;

/** O que a API pode mostrar de uma conexão: campos comuns e, dos segredos, só se estão preenchidos. */
export interface ConnectionView {
  id: string;
  provider: MessagingProvider;
  phone: string | null;
  isDefault: boolean;
  /** Arquivada: fora de uso, mantida só para o histórico ser legível. */
  archived: boolean;
  config: Record<string, string>;
  secrets: Record<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
}

/** Conexões de mensageria: guarda a config de cada provider, cifrando os campos marcados como segredo. */
@Injectable()
export class MessagingConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly registry: MessagingProviderRegistry,
    private readonly i18n: I18nService,
  ) {}

  /** Conexões de mensageria. Sem filtro = apenas em uso; archived: true = apenas arquivadas. */
  list(filter?: { archived?: boolean }): Promise<MessagingConnection[]> {
    return this.prisma.messagingConnection.findMany({
      where: filter?.archived
        ? { archivedAt: { not: null } }
        : { archivedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Inclui conexão arquivada, pois o histórico dela continua sendo lido. */
  async get(id: string): Promise<MessagingConnection> {
    const connection = await this.prisma.messagingConnection.findUnique({
      where: { id },
    });
    if (!connection) {
      throw new NotFoundException(
        this.i18n.t('messaging.connection_not_found'),
      );
    }
    return connection;
  }

  /** Conexão em uso, exigida por toda rota que fala com o provider ou altera a conexão. */
  async getActive(id: string): Promise<MessagingConnection> {
    const connection = await this.get(id);
    if (connection.archivedAt) {
      throw new BadRequestException(
        this.i18n.t('messaging.connection_archived'),
      );
    }
    return connection;
  }

  /** Só conexão em uso: é o que decide se o provider ainda pode receber outra conexão. */
  findByProvider(provider: MessagingProvider) {
    return this.prisma.messagingConnection.findFirst({
      where: { provider, archivedAt: null },
    });
  }

  /** Conexão padrão a usar quando quem chama não escolheu; sem padrão marcada, a mais antiga. */
  async resolve(connectionId?: string | null): Promise<MessagingConnection> {
    if (connectionId) return this.getActive(connectionId);
    const all = await this.list();
    const chosen = all.find((connection) => connection.isDefault) ?? all[0];
    if (!chosen) {
      throw new BadRequestException(this.i18n.t('messaging.no_connection'));
    }
    return chosen;
  }

  /** Torna esta a conexão padrão (e só ela): uma transação, para nunca haver duas ou nenhuma no meio. */
  async setDefault(id: string): Promise<MessagingConnection> {
    await this.getActive(id);
    const [, updated] = await this.prisma.$transaction([
      this.prisma.messagingConnection.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      }),
      this.prisma.messagingConnection.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);
    return updated;
  }

  /** Tira a conexão de uso sem apagar o histórico; arquivar a padrão promove a mais antiga das que sobram. */
  async archive(id: string): Promise<MessagingConnection> {
    const connection = await this.get(id);
    if (connection.archivedAt) return connection;

    const heir = connection.isDefault
      ? ((await this.prisma.messagingConnection.findFirst({
          where: { archivedAt: null, NOT: { id } },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })) ?? null)
      : null;

    // A ordem importa: a padrão é desmarcada ANTES de promover a herdeira, senão as duas ficariam
    // `isDefault` no mesmo instante e o índice único parcial recusaria.
    const [archived] = await this.prisma.$transaction([
      this.prisma.messagingConnection.update({
        where: { id },
        data: { archivedAt: new Date(), isDefault: false },
      }),
      ...(heir
        ? [
            this.prisma.messagingConnection.update({
              where: { id: heir.id },
              data: { isDefault: true },
            }),
          ]
        : []),
    ]);

    return archived;
  }

  /** Restaura uma conexão arquivada para uso ativo. */
  async unarchive(
    id: string,
    config?: Record<string, string>,
    phone?: string | null,
  ): Promise<MessagingConnection> {
    const connection = await this.get(id);
    if (!connection.archivedAt) return connection;

    const hasActiveDefault =
      (await this.prisma.messagingConnection.count({
        where: { archivedAt: null, isDefault: true },
      })) > 0;

    return this.prisma.messagingConnection.update({
      where: { id },
      data: {
        archivedAt: null,
        isDefault: !hasActiveDefault,
        ...(config ? { config } : {}),
        ...(phone ? { phone } : {}),
      },
    });
  }

  /** Configuração em texto claro. Segredo que não decifra volta como está (`tryDecrypt`), como no SystemConfiguration. */
  plainConfig(connection: MessagingConnection): PlainConfig {
    const secrets = this.secretFields(connection.provider);
    const stored = (connection.config ?? {}) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(stored)
        .filter(([, value]) => typeof value === 'string' && value !== '')
        .map(([field, value]) => [
          field,
          secrets.includes(field)
            ? this.crypto.tryDecrypt(value as string)
            : (value as string),
        ]),
    );
  }

  /** Provider pronto para uso. Config incompleta estoura dizendo o campo que falta. */
  use(connection: MessagingConnection): IMessagingProvider {
    const adapter = this.adapter(connection.provider);
    const parsed = adapter.configSchema.safeParse(this.plainConfig(connection));
    if (!parsed.success) {
      throw new Error(
        `Configuração de mensageria inválida: ${parsed.error.issues
          .map(
            (issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`,
          )
          .join('; ')}`,
      );
    }
    return adapter.use(parsed.data);
  }

  /** Config pronta para gravar: só campos preenchidos, segredos cifrados. */
  encode(
    provider: MessagingProvider,
    plain: PlainConfig,
  ): Record<string, string> {
    const secrets = this.secretFields(provider);
    return Object.fromEntries(
      Object.entries(plain)
        .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
        .map(([field, value]) => [
          field,
          secrets.includes(field)
            ? this.crypto.encryptString(value.trim())
            : value.trim(),
        ]),
    );
  }

  /** Vista segura para a API: nenhum segredo sai, só se existe. */
  view(connection: MessagingConnection): ConnectionView {
    const secrets = this.secretFields(connection.provider);
    const plain = this.plainConfig(connection);
    return {
      id: connection.id,
      provider: connection.provider,
      phone: connection.phone,
      isDefault: connection.isDefault,
      archived: connection.archivedAt !== null,
      config: Object.fromEntries(
        Object.entries(plain).filter(([field]) => !secrets.includes(field)),
      ),
      secrets: Object.fromEntries(
        secrets.map((field) => [field, !!plain[field]]),
      ),
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }

  async create(
    provider: MessagingProvider,
    config: Record<string, string>,
    phone: string | null,
  ): Promise<MessagingConnection> {
    return this.guardPhone(phone, async () => {
      // A primeira conexão EM USO já nasce padrão: sem isso o envio sem `connectionId` não teria
      // alvo. Arquivada não conta — senão, quem arquivasse tudo e recomeçasse ficaria com uma
      // conexão sozinha e não-padrão, que é um estado sem saída pela tela.
      // Duas criações simultâneas leem "zero conexões" ao mesmo tempo; o índice único parcial deixa
      // passar uma só como padrão, e a que perde relê (agora há uma) e nasce não-padrão.
      for (let attempt = 1; ; attempt += 1) {
        const isDefault =
          (await this.prisma.messagingConnection.count({
            where: { archivedAt: null },
          })) === 0;
        try {
          return await this.prisma.messagingConnection.create({
            data: { provider, config, phone, isDefault },
          });
        } catch (error) {
          const lostDefaultRace =
            isDefault && violatedIndex(error) === SINGLE_DEFAULT_INDEX;
          if (!lostDefaultRace || attempt > 1) throw error;
        }
      }
    });
  }

  async updateConfig(
    id: string,
    config: Record<string, string>,
  ): Promise<MessagingConnection> {
    return this.prisma.messagingConnection.update({
      where: { id },
      data: { config },
    });
  }

  /** Fixa o número da conexão (primeiro pareamento/validação). Dois números iguais não coexistem entre conexões ativas. */
  async bindPhone(id: string, phone: string): Promise<MessagingConnection> {
    return this.guardPhone(
      phone,
      () =>
        this.prisma.messagingConnection.update({
          where: { id },
          data: { phone },
        }),
      id,
    );
  }

  secretFields(provider: MessagingProvider): readonly string[] {
    return this.adapter(provider).secretFields;
  }

  private adapter(provider: string) {
    const adapter = this.registry.find(provider);
    if (!adapter) throw new Error(`Provider desconhecido: ${provider}`);
    return adapter;
  }

  /** Garante phone único entre conexões ativas, orientando restaurar se já pertence a uma arquivada. */
  private async guardPhone<T>(
    phone: string | null,
    run: () => Promise<T>,
    connectionId?: string,
  ): Promise<T> {
    if (phone) {
      const archived = await this.prisma.messagingConnection.findFirst({
        where: {
          phone,
          archivedAt: { not: null },
          ...(connectionId ? { NOT: { id: connectionId } } : {}),
        },
        select: { provider: true },
      });
      if (archived) {
        throw new ConflictException(
          this.i18n.t('messaging.connection_phone_archived', {
            args: { provider: archived.provider },
          }),
        );
      }
    }

    try {
      return await run();
    } catch (error) {
      // Só a unicidade do telefone é "número em uso"; outro índice único não pode ser relatado assim.
      if (violatedIndex(error)?.includes('phone')) {
        let holder: { provider: string } | null = null;
        if (phone) {
          holder = await this.prisma.messagingConnection.findFirst({
            where: { phone, archivedAt: null },
            select: { provider: true },
          });
        }
        throw new ConflictException(
          this.i18n.t('messaging.connection_phone_in_use', {
            args: { provider: holder?.provider ?? '—' },
          }),
        );
      }
      throw error;
    }
  }
}
