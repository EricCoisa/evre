import { ListConversationsUseCase } from './list-conversations.use-case';
import { PrismaService } from 'src/prisma/prisma.service';

describe('ListConversationsUseCase', () => {
  const prisma = {
    messagingContact: { findUnique: vi.fn() },
    messagingConversation: { findMany: vi.fn() },
  };
  let useCase: ListConversationsUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ListConversationsUseCase(prisma as unknown as PrismaService);
  });

  it('telefone sem contato devolve vazio sem consultar conversas', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue(null);
    const result = await useCase.execute('5511987654321');
    expect(result).toEqual([]);
    expect(prisma.messagingConversation.findMany).not.toHaveBeenCalled();
  });

  it('busca o contato pelo telefone normalizado', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.messagingConversation.findMany.mockResolvedValue([]);
    await useCase.execute('+55 11 98765-4321');
    expect(prisma.messagingContact.findUnique).toHaveBeenCalledWith({
      where: { phone: '5511987654321' },
      select: { id: true },
    });
  });

  it('uma conversa: devolve a conexão, o número e a última mensagem', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue({ id: 'c1' });
    const lastMessageAt = new Date();
    prisma.messagingConversation.findMany.mockResolvedValue([
      {
        connectionId: 'conn-1',
        lastMessageAt,
        connection: { provider: 'EVOLUTION_API', phone: '5511900000000', archivedAt: null },
      },
    ]);

    const result = await useCase.execute('5511987654321');

    expect(prisma.messagingConversation.findMany).toHaveBeenCalledWith({
      where: { contactId: 'c1' },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        connection: { select: { provider: true, phone: true, archivedAt: true } },
      },
    });
    expect(result).toEqual([
      {
        connectionId: 'conn-1',
        provider: 'EVOLUTION_API',
        connectionPhone: '5511900000000',
        archived: false,
        lastMessageAt,
      },
    ]);
  });

  it('conversa numa conexão arquivada vem marcada, não escondida', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.messagingConversation.findMany.mockResolvedValue([
      {
        connectionId: 'conn-old',
        lastMessageAt: new Date('2025-01-01'),
        connection: { provider: 'META', phone: null, archivedAt: new Date() },
      },
    ]);

    const result = await useCase.execute('5511987654321');
    expect(result[0]).toMatchObject({ archived: true, connectionPhone: null });
  });

  it('duas ou mais: mais recente primeiro (ordem já vem do Prisma, só repassa)', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.messagingConversation.findMany.mockResolvedValue([
      {
        connectionId: 'conn-novo',
        lastMessageAt: new Date('2026-01-01'),
        connection: { provider: 'EVOLUTION_GO', phone: '5511900000001', archivedAt: null },
      },
      {
        connectionId: 'conn-velho',
        lastMessageAt: new Date('2025-01-01'),
        connection: { provider: 'EVOLUTION_API', phone: '5511900000002', archivedAt: null },
      },
    ]);

    const result = await useCase.execute('5511987654321');
    expect(result.map((r) => r.connectionId)).toEqual(['conn-novo', 'conn-velho']);
  });
});
