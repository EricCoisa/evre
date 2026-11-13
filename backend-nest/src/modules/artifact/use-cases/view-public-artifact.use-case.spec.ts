import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ViewPublicArtifactUseCase } from './view-public-artifact.use-case';

const publishedArtifact = {
  id: 'artifact-1',
  kind: 'FILE',
  storageKey: 'app/artifacts/uuid.html',
  entryFileName: null,
  files: [{ path: 'demo.html', contentType: 'text/html', sizeBytes: 10 }],
  published: true,
  archivedAt: null as Date | null,
};

const mockPrisma = { artifact: { findUnique: vi.fn() } };
const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };
const mockStorage = { getPresignedUrl: vi.fn(), getShareableUrl: vi.fn() };

describe('ViewPublicArtifactUseCase', () => {
  let useCase: ViewPublicArtifactUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ViewPublicArtifactUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();
    useCase = module.get(ViewPublicArtifactUseCase);

    vi.clearAllMocks();
    mockStorage.getShareableUrl.mockImplementation((key: string) =>
      Promise.resolve(`https://signed/${key}`),
    );
  });

  it('resolve por publicToken quando publicado', async () => {
    mockPrisma.artifact.findUnique.mockResolvedValue({
      ...publishedArtifact,
    });

    const url = await useCase.execute('token-1', undefined);

    expect(mockPrisma.artifact.findUnique).toHaveBeenCalledWith({
      where: { publicToken: 'token-1' },
    });
    expect(url).toBe(`https://signed/${publishedArtifact.storageKey}`);
  });

  it('404 quando não publicado', async () => {
    mockPrisma.artifact.findUnique.mockResolvedValue({
      ...publishedArtifact,
      published: false,
    });

    await expect(useCase.execute('token-1', undefined)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('404 quando arquivado, mesmo publicado', async () => {
    mockPrisma.artifact.findUnique.mockResolvedValue({
      ...publishedArtifact,
      archivedAt: new Date(),
    });

    await expect(useCase.execute('token-1', undefined)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('404 quando o token não resolve nenhum artefato', async () => {
    mockPrisma.artifact.findUnique.mockResolvedValue(null);

    await expect(useCase.execute('token-inexistente', undefined)).rejects.toThrow(
      NotFoundException,
    );
  });
});
