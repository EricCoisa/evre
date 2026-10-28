import { Test } from '@nestjs/testing';
import { LogoutUseCase } from './logout.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';

const mockPrisma = {
  refreshToken: { findUnique: vi.fn(), deleteMany: vi.fn() },
};
const mockLogging = { create: vi.fn() };
const mockI18n = { t: vi.fn((k: string) => k) };

const tokenRecord = {
  id: 'rt1',
  token: 'rt',
  familyId: 'fam1',
  user: { id: 'u1', email: 'a@b.com' },
};

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        LogoutUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggingService, useValue: mockLogging },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = mod.get(LogoutUseCase);
    vi.clearAllMocks();
    mockLogging.create.mockResolvedValue(undefined);
  });

  it('revoga a família inteira do token, não só a linha apresentada', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(tokenRecord);
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

    const result = await useCase.execute('rt');
    expect(result).toBe(3);
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { familyId: 'fam1' },
    });
  });

  it('cai para o token cru quando a linha não existe mais', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

    await useCase.execute('rt-desconhecido');
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'rt-desconhecido' },
    });
  });

  it('registra log quando token encontrado e deletado', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(tokenRecord);
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

    await useCase.execute('rt', 'performer-id');
    expect(mockLogging.create).toHaveBeenCalled();
  });

  it('não registra log quando token não existia', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

    const result = await useCase.execute('unknown-token');
    expect(result).toBe(0);
    expect(mockLogging.create).not.toHaveBeenCalled();
  });
});
