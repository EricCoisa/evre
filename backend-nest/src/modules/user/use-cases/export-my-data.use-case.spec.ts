import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExportMyDataUseCase } from './export-my-data.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

const mockPrisma = { user: { findUnique: vi.fn() } };
const mockI18n = { t: vi.fn((k: string) => k) };

const rawUser = {
  id: 'u1',
  email: 'a@b.com',
  name: 'Test',
  hash: 'h',
  salt: 's',
  image: null,
  userConfigurations: [{ value: 'dark', definition: { labelKey: 'theme' } }],
  userRouteAccesses: [{ route: { path: '/dashboard' } }],
  systemLogs: [{ id: 'l1' }],
};

describe('ExportMyDataUseCase', () => {
  let useCase: ExportMyDataUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        ExportMyDataUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = mod.get(ExportMyDataUseCase);
    vi.clearAllMocks();
  });

  it('retorna dados do usuário sem hash/salt', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(rawUser);

    const result = await useCase.execute('u1');

    expect(result).not.toHaveProperty('hash');
    expect(result).not.toHaveProperty('salt');
    expect(result.email).toBe('a@b.com');
  });

  it('mapeia userConfigurations para labelKey/value', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(rawUser);

    const result = await useCase.execute('u1');

    expect(result.userConfigurations).toEqual([
      { labelKey: 'theme', value: 'dark' },
    ]);
  });

  it('mapeia userRouteAccesses para paths', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(rawUser);

    const result = await useCase.execute('u1');

    expect(result.userRouteAccesses).toEqual(['/dashboard']);
  });

  it('lança NotFoundException quando usuário não existe', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(useCase.execute('ghost')).rejects.toThrow(NotFoundException);
  });

  it('hasImage=false quando image é null', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(rawUser);

    const result = await useCase.execute('u1');
    expect(result.hasImage).toBe(false);
  });
});
