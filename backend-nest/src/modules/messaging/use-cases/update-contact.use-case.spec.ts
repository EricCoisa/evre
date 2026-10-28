import { NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateContactUseCase } from './update-contact.use-case';

describe('UpdateContactUseCase', () => {
  const contact = {
    id: 'contact-1',
    phone: '5511987654321',
    name: null,
    optOut: false,
    optOutAt: null,
  };
  const prisma = {
    messagingContact: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    messagingConversation: {
      count: vi.fn().mockResolvedValue(1),
      findFirst: vi
        .fn()
        .mockResolvedValue({ connectionId: 'conn-1', lastMessageAt: null }),
    },
  };
  let useCase: UpdateContactUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.messagingContact.findUnique.mockResolvedValue(contact);
    prisma.messagingContact.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...contact, ...data }),
    );
    prisma.messagingConversation.count.mockResolvedValue(1);
    prisma.messagingConversation.findFirst.mockResolvedValue({
      connectionId: 'conn-1',
      lastMessageAt: null,
    });
    useCase = new UpdateContactUseCase(
      prisma as unknown as PrismaService,
      { t: (key: string) => key } as never,
    );
  });

  // Telefone é identidade global agora: uma linha só por contato, sem varredura por outras.
  it('opt-out e nome são gravados numa única atualização do contato', async () => {
    await useCase.execute('contact-1', { name: 'Ana', optOut: true });
    expect(prisma.messagingContact.findUnique).toHaveBeenCalledWith({
      where: { id: 'contact-1' },
    });
    expect(prisma.messagingContact.update).toHaveBeenCalledWith({
      where: { id: 'contact-1' },
      data: { name: 'Ana', optOut: true, optOutAt: expect.any(Date) },
    });
  });

  it('limpa optOutAt ao reativar contato', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue({
      ...contact,
      optOut: true,
    });
    await useCase.execute('contact-1', { optOut: false });
    expect(prisma.messagingContact.update).toHaveBeenCalledWith({
      where: { id: 'contact-1' },
      data: { optOut: false, optOutAt: null },
    });
  });

  it('editar apenas o nome não toca em optOut/optOutAt', async () => {
    await useCase.execute('contact-1', { name: 'Ana' });
    expect(prisma.messagingContact.update).toHaveBeenCalledWith({
      where: { id: 'contact-1' },
      data: { name: 'Ana' },
    });
  });

  it('devolve quantas conversas o contato tem e a última atividade', async () => {
    prisma.messagingConversation.count.mockResolvedValue(2);
    const lastMessageAt = new Date();
    prisma.messagingConversation.findFirst.mockResolvedValue({
      connectionId: 'conn-2',
      lastMessageAt,
    });
    const result = await useCase.execute('contact-1', { name: 'Ana' });
    expect(result).toMatchObject({
      conversationCount: 2,
      lastMessageAt,
      lastConnectionId: 'conn-2',
    });
  });

  it('contato inexistente retorna 404', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue(null);
    await expect(useCase.execute('nope', { optOut: true })).rejects.toThrow(
      NotFoundException,
    );
    // Mensagem traduzível (antes era texto fixo em PT que ignorava o idioma da requisição).
    await expect(useCase.execute('nope', { optOut: true })).rejects.toThrow(
      'messaging.contact_not_found',
    );
    expect(prisma.messagingContact.update).not.toHaveBeenCalled();
  });
});
