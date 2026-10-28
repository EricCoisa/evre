import { ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContactUseCase } from './create-contact.use-case';

describe('CreateContactUseCase', () => {
  const prisma = {
    messagingContact: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
  let useCase: CreateContactUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.messagingContact.findUnique.mockResolvedValue(null);
    prisma.messagingContact.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'contact-1',
        phone: data.phone,
        name: data.name,
        pushName: null,
        profilePictureUrl: null,
        optOut: false,
        optOutAt: null,
        createdAt: new Date(),
      }),
    );
    useCase = new CreateContactUseCase(
      prisma as unknown as PrismaService,
      { t: (key: string) => key } as never,
    );
  });

  it('cria o contato sem conversa nenhuma, já normalizando o telefone', async () => {
    const result = await useCase.execute({
      phone: '(55) 11 98765-4321',
      name: 'Ana',
    });
    expect(prisma.messagingContact.create).toHaveBeenCalledWith({
      data: { phone: '5511987654321', name: 'Ana' },
    });
    expect(result).toMatchObject({
      phone: '5511987654321',
      name: 'Ana',
      conversationCount: 0,
      lastMessageAt: null,
      lastConnectionId: '',
    });
  });

  it('telefone sem nome grava null', async () => {
    await useCase.execute({ phone: '5511987654321' });
    expect(prisma.messagingContact.create).toHaveBeenCalledWith({
      data: { phone: '5511987654321', name: null },
    });
  });

  it('telefone já cadastrado gera conflito em vez de duplicar', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue({ id: 'contact-1' });
    await expect(
      useCase.execute({ phone: '5511987654321' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      useCase.execute({ phone: '5511987654321' }),
    ).rejects.toThrow('messaging.contact_exists');
    expect(prisma.messagingContact.create).not.toHaveBeenCalled();
  });
});
