import { ListContactsUseCase } from './list-contacts.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import type { ContactProfileSyncService } from '../contact-profile-sync.service';

interface Row {
  id: string;
  phone: string;
  name: string | null;
  pushName: string | null;
  optOut: boolean;
  optOutAt: Date | null;
  profilePictureUrl: string | null;
  profileSyncedAt: Date | null;
  metadata?: unknown;
  createdAt: Date;
  lastMessageAt?: Date | null;
}

const ROW: Row = {
  id: 'contact-1',
  phone: '5511987654321',
  name: null,
  pushName: null,
  optOut: false,
  optOutAt: null,
  profilePictureUrl: null,
  profileSyncedAt: new Date(),
  createdAt: new Date('2026-01-01'),
};

describe('ListContactsUseCase', () => {
  const prisma = {
    messagingContact: { findMany: vi.fn(), count: vi.fn() },
    messagingConversation: { findMany: vi.fn() },
  };
  const profiles = { syncInBackground: vi.fn() };
  let useCase: ListContactsUseCase;

  /** O banco devolve a página já ordenada e recortada: o use-case não reordena nem fatia. */
  function setRows(rows: Row[], total = rows.length) {
    prisma.messagingContact.findMany.mockResolvedValue(rows);
    prisma.messagingContact.count.mockResolvedValue(total);
  }

  /** Uma conversa (`conn-1`) por contato, salvo override. */
  function setActivity(
    entries: Array<{
      contactId: string;
      connectionId?: string;
      lastMessageAt?: Date | null;
    }>,
  ) {
    prisma.messagingConversation.findMany.mockResolvedValue(
      entries.map((e) => ({
        contactId: e.contactId,
        connectionId: e.connectionId ?? 'conn-1',
        lastMessageAt: e.lastMessageAt ?? null,
      })),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setRows([ROW]);
    setActivity([{ contactId: ROW.id }]);
    useCase = new ListContactsUseCase(
      prisma as unknown as PrismaService,
      profiles as unknown as ContactProfileSyncService,
    );
  });

  it('busca telefone canonizado, nome e pushName, e devolve meta de paginação', async () => {
    const result = await useCase.execute({
      page: 1,
      limit: 5,
      search: '+55 11 98765-4321',
      pagination: true,
    });

    expect(prisma.messagingContact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { phone: { contains: '5511987654321' } },
            {
              name: { contains: '+55 11 98765-4321', mode: 'insensitive' },
            },
            {
              pushName: {
                contains: '+55 11 98765-4321',
                mode: 'insensitive',
              },
            },
          ],
        },
      }),
    );
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          phone: '5511987654321',
          hasProfilePicture: false,
          conversationCount: 1,
          lastConnectionId: 'conn-1',
        }),
      ],
      meta: { total: 1, page: 1, limit: 5, totalPages: 1 },
      filter: { optOut: ['ALLOWED', 'BLOCKED'] },
    });
  });

  it.each([
    ['BLOCKED', true],
    ['ALLOWED', false],
  ])('filtro de envio %s consulta optOut=%s', async (value, optOut) => {
    await useCase.execute({
      page: 1,
      limit: 10,
      pagination: true,
      filter: { optOut: value },
    });
    expect(prisma.messagingContact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { optOut } }),
    );
  });

  it('sem search retorna where vazio', async () => {
    await useCase.execute({ page: 1, limit: 10, pagination: true });
    expect(prisma.messagingContact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  // Contato deixou de pertencer a uma conexão; filtrar por conexão passa pela conversa.
  it('connectionId filtra por quem tem conversa nessa conexão', async () => {
    await useCase.execute({
      page: 1,
      limit: 10,
      pagination: true,
      connectionId: 'conn-1',
    });
    expect(prisma.messagingContact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversations: { some: { connectionId: 'conn-1' } } },
      }),
    );
  });

  // Ordenar e paginar no banco: antes carregava TODOS os contatos para ordenar em memória (custo e
  // memória proporcionais ao total, mesmo pedindo 10 itens).
  it('ordena e pagina no banco: atividade mais recente primeiro, só a página é lida', async () => {
    await useCase.execute({ page: 3, limit: 10, pagination: true });

    expect(prisma.messagingContact.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.messagingContact.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      skip: 20,
      take: 10,
    });
  });

  it('o total da paginação vem de um count com o mesmo filtro, não do tamanho da lista', async () => {
    setRows([ROW], 137);
    const result = (await useCase.execute({
      page: 2,
      limit: 10,
      pagination: true,
      connectionId: 'conn-1',
    })) as unknown as { meta: unknown };

    expect(prisma.messagingContact.count).toHaveBeenCalledWith({
      where: { conversations: { some: { connectionId: 'conn-1' } } },
    });
    expect(result.meta).toEqual({ total: 137, page: 2, limit: 10, totalPages: 14 });
  });

  it('o resumo das conversas só é buscado para os contatos da página', async () => {
    const page = [
      { ...ROW, id: 'p1' },
      { ...ROW, id: 'p2' },
    ];
    setRows(page, 5_000);
    setActivity([{ contactId: 'p1' }, { contactId: 'p2' }]);

    await useCase.execute({ page: 1, limit: 2, pagination: true });

    expect(prisma.messagingConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contactId: { in: ['p1', 'p2'] } } }),
    );
  });

  it('sem paginação devolve a lista inteira sem recorte nem count', async () => {
    const result = await useCase.execute({
      page: 1,
      limit: 10,
      pagination: false,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(prisma.messagingContact.count).not.toHaveBeenCalled();
    expect(prisma.messagingContact.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: expect.any(Array),
    });
  });

  it('página vazia não consulta conversas', async () => {
    setRows([], 0);
    await useCase.execute({ page: 1, limit: 10, pagination: true });
    expect(prisma.messagingConversation.findMany).not.toHaveBeenCalled();
  });

  it('lastConnectionId é o da conversa com o maior lastMessageAt, não a primeira linha', async () => {
    prisma.messagingConversation.findMany.mockResolvedValue([
      { contactId: ROW.id, connectionId: 'conn-antiga', lastMessageAt: new Date('2025-01-01') },
      { contactId: ROW.id, connectionId: 'conn-recente', lastMessageAt: new Date('2026-01-01') },
    ]);

    const result = (await useCase.execute({
      page: 1,
      limit: 10,
      pagination: true,
    })) as unknown as { data: Array<{ conversationCount: number; lastConnectionId: string }> };

    expect(result.data[0]).toMatchObject({
      conversationCount: 2,
      lastConnectionId: 'conn-recente',
    });
  });

  describe('perfil (nome e foto)', () => {
    it('só contatos nunca sincronizados vão para a sincronização em segundo plano', async () => {
      setRows([
        { ...ROW, id: 'c1', profileSyncedAt: null },
        { ...ROW, id: 'c2', profileSyncedAt: new Date() },
        { ...ROW, id: 'c3', profileSyncedAt: null },
      ]);
      setActivity([
        { contactId: 'c1' },
        { contactId: 'c2' },
        { contactId: 'c3' },
      ]);
      await useCase.execute({ page: 1, limit: 10, pagination: true });
      expect(profiles.syncInBackground).toHaveBeenCalledWith([
        'c1',
        'c3',
      ]);
    });

    it('a URL do WhatsApp e o metadata interno não saem pela API; só o hasProfilePicture', async () => {
      setRows([
        {
          ...ROW,
          profilePictureUrl: 'https://pps.whatsapp.net/x.jpg',
          metadata: { interno: true },
        },
      ]);
      const result = (await useCase.execute({
        page: 1,
        limit: 10,
        pagination: true,
      })) as unknown as {
        data: Array<Record<string, unknown>>;
      };
      expect(result.data[0].hasProfilePicture).toBe(true);
      expect(result.data[0]).not.toHaveProperty('profilePictureUrl');
      expect(result.data[0]).not.toHaveProperty('metadata');
    });
  });
});
