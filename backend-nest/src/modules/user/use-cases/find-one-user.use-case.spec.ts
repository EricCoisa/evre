import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FindOneUserUseCase } from './find-one-user.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

const mockPrisma = { user: { findFirst: vi.fn() } };
const mockI18n = { t: vi.fn((k: string) => k) };

const user = {
  id: 'u1',
  email: 'a@b.com',
  name: 'Test',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('FindOneUserUseCase', () => {
  let useCase: FindOneUserUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        FindOneUserUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = mod.get(FindOneUserUseCase);
    vi.clearAllMocks();
  });

  it('retorna usuário encontrado', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(user);

    const result = await useCase.execute('u1');
    expect(result).toMatchObject({ id: 'u1', email: 'a@b.com' });
  });

  it('inclui phone no select', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ ...user, phone: '+5511999998888' });

    const result = await useCase.execute('u1');

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.objectContaining({ phone: true }) }),
    );
    expect(result).toMatchObject({ phone: '+5511999998888' });
  });

  it('lança NotFoundException quando usuário não existe', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('ghost')).rejects.toThrow(NotFoundException);
  });

  it('busca apenas usuários não deletados (deletedAt: null)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(user);

    await useCase.execute('u1');

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });
});
