import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RemoveUserUseCase } from './remove-user.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

const mockPrisma = {
  user: { findFirst: vi.fn(), update: vi.fn() },
  refreshToken: { deleteMany: vi.fn() },
  $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
};
const mockI18n = { t: vi.fn((k: string) => k) };

const user = {
  id: 'u1',
  email: 'a@b.com',
  deletedAt: null,
};

describe('RemoveUserUseCase', () => {
  let useCase: RemoveUserUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        RemoveUserUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = mod.get(RemoveUserUseCase);
    vi.clearAllMocks();
  });

  it('inativa e soft-deleta o usuário, revogando os refresh tokens', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(user);
    mockPrisma.user.update.mockResolvedValue({
      ...user,
      status: 'INACTIVE',
      deletedAt: new Date(),
    });

    await expect(useCase.execute('u1')).resolves.toBeUndefined();
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { status: 'INACTIVE', deletedAt: expect.any(Date) },
    });
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
  });

  it('lança NotFoundException quando usuário não existe', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('u1')).rejects.toThrow(NotFoundException);
    expect(mockI18n.t).toHaveBeenCalledWith('user.not_found');
  });

  it('lança NotFoundException quando usuário já foi deletado', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('u1')).rejects.toThrow(NotFoundException);
  });
});
