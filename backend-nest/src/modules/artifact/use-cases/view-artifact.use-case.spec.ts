import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ViewArtifactUseCase } from './view-artifact.use-case';

const fileArtifact = {
  id: 'artifact-1',
  kind: 'FILE',
  storageKey: 'app/artifacts/uuid.html',
  entryFileName: null,
  files: [{ path: 'demo.html', contentType: 'text/html', sizeBytes: 10 }],
  archivedAt: null as Date | null,
};

const folderArtifact = {
  id: 'artifact-2',
  kind: 'FOLDER',
  storageKey: 'app/artifacts/uuid/',
  entryFileName: 'index.html',
  files: [
    { path: 'index.html', contentType: 'text/html', sizeBytes: 10 },
    { path: 'style.css', contentType: 'text/css', sizeBytes: 5 },
  ],
  archivedAt: null as Date | null,
};

const mockPrisma = { artifact: { findUnique: vi.fn() } };
const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };
const mockStorage = { getPresignedUrl: vi.fn() };

describe('ViewArtifactUseCase', () => {
  let useCase: ViewArtifactUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ViewArtifactUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();
    useCase = module.get(ViewArtifactUseCase);

    vi.clearAllMocks();
    mockStorage.getPresignedUrl.mockImplementation((key: string) =>
      Promise.resolve(`https://signed/${key}`),
    );
  });

  it('404 quando o artefato não existe', async () => {
    mockPrisma.artifact.findUnique.mockResolvedValue(null);
    await expect(useCase.execute('missing', undefined)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('404 quando o artefato está arquivado', async () => {
    mockPrisma.artifact.findUnique.mockResolvedValue({
      ...fileArtifact,
      archivedAt: new Date(),
    });
    await expect(
      useCase.execute('artifact-1', undefined),
    ).rejects.toThrow(NotFoundException);
  });

  it('FILE ignora subPath e usa a storageKey direto', async () => {
    mockPrisma.artifact.findUnique.mockResolvedValue({ ...fileArtifact });

    const url = await useCase.execute('artifact-1', 'qualquer/coisa');

    expect(mockStorage.getPresignedUrl).toHaveBeenCalledWith(
      fileArtifact.storageKey,
    );
    expect(url).toBe(`https://signed/${fileArtifact.storageKey}`);
  });

  it('FOLDER sem subPath usa o entryFileName', async () => {
    mockPrisma.artifact.findUnique.mockResolvedValue({ ...folderArtifact });

    await useCase.execute('artifact-2', undefined);

    expect(mockStorage.getPresignedUrl).toHaveBeenCalledWith(
      `${folderArtifact.storageKey}index.html`,
    );
  });

  it('FOLDER com subPath presente no manifesto resolve aquele arquivo', async () => {
    mockPrisma.artifact.findUnique.mockResolvedValue({ ...folderArtifact });

    await useCase.execute('artifact-2', 'style.css');

    expect(mockStorage.getPresignedUrl).toHaveBeenCalledWith(
      `${folderArtifact.storageKey}style.css`,
    );
  });

  it('FOLDER com subPath fora do manifesto é 404, não path traversal', async () => {
    mockPrisma.artifact.findUnique.mockResolvedValue({ ...folderArtifact });

    await expect(
      useCase.execute('artifact-2', '../../etc/passwd'),
    ).rejects.toThrow(NotFoundException);
    expect(mockStorage.getPresignedUrl).not.toHaveBeenCalled();
  });
});
