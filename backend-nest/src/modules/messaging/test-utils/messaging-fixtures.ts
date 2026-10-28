import { MessagingConnectionService } from '../messaging-connection.service';
import { MessagingProviderRegistry } from '../messaging-provider.registry';
import { EvolutionApiProvider } from '../providers/evolution-api.provider';
import { EvolutionGoProvider } from '../providers/evolution-go.provider';
import { MetaProvider } from '../providers/meta.provider';

export type ConnectionRow = {
  id: string;
  provider: 'EVOLUTION_API' | 'EVOLUTION_GO' | 'META';
  phone: string | null;
  isDefault: boolean;
  archivedAt: Date | null;
  config: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
};

const base = {
  phone: null,
  isDefault: false,
  archivedAt: null,
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-01'),
};

export const EVO: ConnectionRow = {
  ...base,
  id: 'conn-evo',
  provider: 'EVOLUTION_API',
  config: {
    baseUrl: 'http://evolution:8080',
    token: 'enc:tok',
    instance: 'inst',
  },
};
/** Config do Evolution Go em texto claro, para specs que instanciam o provider direto. */
export const GO_PLAIN_CONFIG = {
  baseUrl: 'http://go:8080',
  token: 'global-key-go',
  instanceId: 'inst-go',
  instanceToken: 'instance-tok-go',
};

export const GO_CONNECTION: ConnectionRow = {
  ...base,
  id: 'conn-go',
  provider: 'EVOLUTION_GO',
  createdAt: new Date('2026-10-02'),
  config: {
    baseUrl: GO_PLAIN_CONFIG.baseUrl,
    token: `enc:${GO_PLAIN_CONFIG.token}`,
    instanceId: GO_PLAIN_CONFIG.instanceId,
    instanceToken: `enc:${GO_PLAIN_CONFIG.instanceToken}`,
  },
};
export const META: ConnectionRow = {
  ...base,
  id: 'conn-meta',
  provider: 'META',
  createdAt: new Date('2026-10-03'),
  config: {
    phoneNumberId: '123',
    accessToken: 'enc:tok-meta',
    wabaId: 'waba-1',
  },
};

/** Cifra de mentira, reversível e inspecionável: `enc:` + texto. Faz o papel do CryptoService. */
export const fakeCrypto = {
  encryptString: (plain: string) => `enc:${plain}`,
  tryDecrypt: (payload: string) =>
    payload.startsWith('enc:') ? payload.slice(4) : payload,
};

/** Filtro do `where` que o serviço de conexões usa de verdade (nada de Prisma genérico). */
type Where = {
  id?: string;
  phone?: string;
  provider?: string;
  archivedAt?: null | { not: null };
  isDefault?: boolean;
  NOT?: { id?: string };
};

function matches(row: ConnectionRow, where: Where = {}): boolean {
  if (where.id !== undefined && row.id !== where.id) return false;
  if (where.phone !== undefined && row.phone !== where.phone) return false;
  if (where.provider !== undefined && row.provider !== where.provider) {
    return false;
  }
  if (where.archivedAt === null && row.archivedAt !== null) return false;
  if (
    where.archivedAt &&
    typeof where.archivedAt === 'object' &&
    where.archivedAt.not === null &&
    row.archivedAt === null
  ) {
    return false;
  }
  if (where.isDefault !== undefined && row.isDefault !== where.isDefault) {
    return false;
  }
  if (where.NOT?.id !== undefined && row.id === where.NOT.id) return false;
  return true;
}

/** Prisma de conexões em memória o bastante para o serviço de conexões (get/list/create/update). */
export function connectionPrisma(rows: ConnectionRow[]) {
  // Cópia de cada linha, não só do array: `update` faz `Object.assign` na linha, e sem isto um
  // teste que arquiva ou troca a padrão mutaria as constantes EVO/GO_CONNECTION/META para os seguintes.
  const store = rows.map((row) => ({ ...row }));
  const oldestFirst = (list: ConnectionRow[]) =>
    [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return {
    store,
    $transaction: vi.fn((ops: Array<Promise<unknown>>) => Promise.all(ops)),
    messagingConnection: {
      findMany: vi.fn(({ where }: { where?: Where } = {}) =>
        Promise.resolve(
          oldestFirst(store.filter((row) => matches(row, where))),
        ),
      ),
      count: vi.fn(({ where }: { where?: Where } = {}) =>
        Promise.resolve(store.filter((row) => matches(row, where)).length),
      ),
      updateMany: vi.fn(({ data }: { data: Partial<ConnectionRow> }) => {
        store
          .filter((row) => row.isDefault)
          .forEach((row) => Object.assign(row, data));
        return Promise.resolve({ count: 1 });
      }),
      findUnique: vi.fn(({ where }: { where: Where }) =>
        Promise.resolve(store.find((row) => matches(row, where)) ?? null),
      ),
      findFirst: vi.fn(({ where }: { where?: Where } = {}) =>
        Promise.resolve(
          oldestFirst(store).find((row) => matches(row, where)) ?? null,
        ),
      ),
      create: vi.fn(({ data }: { data: Partial<ConnectionRow> }) => {
        const row = {
          ...base,
          id: `conn-${store.length + 1}`,
          config: {},
          ...data,
        } as ConnectionRow;
        store.push(row);
        return Promise.resolve(row);
      }),
      update: vi.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<ConnectionRow>;
        }) => {
          const row = store.find((r) => r.id === where.id)!;
          Object.assign(row, data);
          return Promise.resolve(row);
        },
      ),
    },
  };
}

/** Serviço de conexões real, com providers reais e a cifra falsa, sobre as linhas dadas. */
export function realConnections(rows: ConnectionRow[]) {
  const prisma = connectionPrisma(rows);
  const registry = new MessagingProviderRegistry(
    new EvolutionApiProvider(),
    new EvolutionGoProvider(),
    new MetaProvider(),
  );
  const service = new MessagingConnectionService(
    prisma as never,
    fakeCrypto as never,
    registry,
    { t: (key: string) => key } as never,
  );
  return { service, registry, prisma };
}
