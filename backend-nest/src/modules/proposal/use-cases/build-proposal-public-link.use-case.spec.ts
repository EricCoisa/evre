import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { ShortUrlService } from '../../short-url/short-url.service';
import { BuildProposalPublicLinkUseCase } from './build-proposal-public-link.use-case';

const mockPrisma = {
  proposalVersion: { findUnique: vi.fn(), update: vi.fn() },
};
const mockShortUrl = {
  shorten: vi.fn(),
  buildShortUrl: vi.fn((code: string) => `http://localhost:3000/s/${code}`),
};
const mockConfig = { get: vi.fn(() => undefined) };
const mockI18n = { t: vi.fn((key: string) => key) };

describe('BuildProposalPublicLinkUseCase', () => {
  let useCase: BuildProposalPublicLinkUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BuildProposalPublicLinkUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ShortUrlService, useValue: mockShortUrl },
        { provide: ConfigService, useValue: mockConfig },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = module.get(BuildProposalPublicLinkUseCase);

    vi.clearAllMocks();
    mockConfig.get.mockReturnValue(undefined);
  });

  it('recusa versão sem publicToken', async () => {
    mockPrisma.proposalVersion.findUnique.mockResolvedValue({
      publicToken: null,
      shortUrlCode: null,
      validUntil: null,
    });

    await expect(useCase.execute({ versionId: 'version-1' })).rejects.toThrow(
      BadRequestException,
    );
    expect(mockShortUrl.shorten).not.toHaveBeenCalled();
  });

  it('gera e grava o código quando a versão ainda não tem shortUrlCode', async () => {
    mockPrisma.proposalVersion.findUnique.mockResolvedValue({
      publicToken: 'a'.repeat(16),
      shortUrlCode: null,
      validUntil: null,
    });
    mockShortUrl.shorten.mockResolvedValue({
      code: 'abc123',
      shortUrl: 'http://localhost:3000/s/abc123',
    });

    const result = await useCase.execute({
      versionId: 'version-1',
      createdById: 'user-1',
    });

    expect(mockShortUrl.shorten).toHaveBeenCalledWith({
      targetUrl: expect.stringContaining('/p/'),
      purpose: 'proposal',
      expiresAt: undefined,
      createdById: 'user-1',
    });
    expect(mockPrisma.proposalVersion.update).toHaveBeenCalledWith({
      where: { id: 'version-1' },
      data: { shortUrlCode: 'abc123' },
    });
    expect(result.code).toBe('abc123');
  });

  it('idempotente: versão que já tem shortUrlCode reusa — não chama shorten() de novo', async () => {
    mockPrisma.proposalVersion.findUnique.mockResolvedValue({
      publicToken: 'a'.repeat(16),
      shortUrlCode: 'existing-code',
      validUntil: null,
    });

    const result = await useCase.execute({ versionId: 'version-1' });

    expect(mockShortUrl.shorten).not.toHaveBeenCalled();
    expect(mockPrisma.proposalVersion.update).not.toHaveBeenCalled();
    expect(result.code).toBe('existing-code');
    expect(result.shortUrl).toContain('existing-code');
  });
});
