import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import * as unzipper from 'unzipper';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { StorageService } from '../../storage/storage.service';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import {
  UploadArtifactUseCase,
  type UploadArtifactFile,
} from './upload-artifact.use-case';

vi.mock('unzipper', () => ({
  Open: { buffer: vi.fn() },
}));

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  roleId: 'role-admin',
  roleName: 'ADMIN',
};

function buildFile(
  overrides: Partial<UploadArtifactFile> = {},
): UploadArtifactFile {
  return {
    buffer: Buffer.from('conteudo'),
    originalname: 'demo.html',
    mimetype: 'text/html',
    size: 1024,
    ...overrides,
  };
}

function buildZipFile(
  overrides: Partial<UploadArtifactFile> = {},
): UploadArtifactFile {
  return buildFile({
    originalname: 'site.zip',
    mimetype: 'application/zip',
    ...overrides,
  });
}

function buildZipEntry(overrides: {
  path: string;
  type?: string;
  uncompressedSize?: number;
  externalFileAttributes?: number;
  content?: string;
}) {
  return {
    path: overrides.path,
    type: overrides.type ?? 'File',
    uncompressedSize: overrides.uncompressedSize ?? 10,
    externalFileAttributes: overrides.externalFileAttributes ?? 0,
    buffer: vi.fn().mockResolvedValue(Buffer.from(overrides.content ?? 'c')),
  };
}

function mockZip(entries: ReturnType<typeof buildZipEntry>[]) {
  (unzipper.Open.buffer as ReturnType<typeof vi.fn>).mockResolvedValue({
    files: entries,
  });
}

const mockPrisma = { artifact: { create: vi.fn() } };
const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };
const mockLogging = { create: vi.fn() };
const mockStorage = {
  buildKey: vi.fn(),
  buildFolderKey: vi.fn(),
  upload: vi.fn(),
};
const mockSystemConfig = { getValueOrNull: vi.fn() };

describe('UploadArtifactUseCase', () => {
  let useCase: UploadArtifactUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UploadArtifactUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: StorageService, useValue: mockStorage },
        { provide: SystemConfigurationService, useValue: mockSystemConfig },
      ],
    }).compile();
    useCase = module.get(UploadArtifactUseCase);

    vi.clearAllMocks();
    mockSystemConfig.getValueOrNull.mockResolvedValue(null);
    mockStorage.buildKey.mockImplementation(
      (prefix: string, ext: string) => `app/${prefix}/generated-uuid.${ext}`,
    );
    mockStorage.buildFolderKey.mockImplementation(
      (prefix: string) => `app/${prefix}/generated-uuid/`,
    );
    mockStorage.upload.mockResolvedValue(undefined);
    mockPrisma.artifact.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        id: 'artifact-1',
        archivedAt: null,
        ...data,
      }),
    );
  });

  it('recusa quando nenhum arquivo é enviado', async () => {
    await expect(useCase.execute(undefined, admin)).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('arquivo único', () => {
    it('recusa contentType fora da allowlist', async () => {
      await expect(
        useCase.execute(
          buildFile({ mimetype: 'application/x-executable' }),
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockStorage.upload).not.toHaveBeenCalled();
    });

    it('recusa arquivo acima do tamanho máximo configurado', async () => {
      mockSystemConfig.getValueOrNull.mockResolvedValue('1000');

      await expect(
        useCase.execute(buildFile({ size: 1001 }), admin),
      ).rejects.toThrow(BadRequestException);
      expect(mockStorage.upload).not.toHaveBeenCalled();
    });

    it('sobe o arquivo e grava kind FILE', async () => {
      const created = await useCase.execute(buildFile(), admin);

      expect(created.kind).toBe('FILE');
      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.stringContaining('artifacts/generated-uuid.html'),
        expect.any(Buffer),
        'text/html',
      );
    });
  });

  describe('pasta (.zip)', () => {
    it('recusa .zip acima do tamanho comprimido configurado, sem abrir o central directory', async () => {
      mockSystemConfig.getValueOrNull.mockResolvedValue('100');

      await expect(
        useCase.execute(buildZipFile({ size: 200 }), admin),
      ).rejects.toThrow(BadRequestException);
      expect(unzipper.Open.buffer).not.toHaveBeenCalled();
    });

    it('recusa entrada com path traversal, sem subir nada', async () => {
      mockZip([
        buildZipEntry({ path: 'index.html' }),
        buildZipEntry({ path: '../../etc/passwd' }),
      ]);

      await expect(useCase.execute(buildZipFile(), admin)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockStorage.upload).not.toHaveBeenCalled();
    });

    it('recusa quando a soma descomprimida excede o teto, sem subir nada', async () => {
      mockSystemConfig.getValueOrNull.mockImplementation((key: string) =>
        key.includes('FOLDER') ? Promise.resolve('100') : Promise.resolve(null),
      );
      mockZip([buildZipEntry({ path: 'index.html', uncompressedSize: 500 })]);

      await expect(useCase.execute(buildZipFile(), admin)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockStorage.upload).not.toHaveBeenCalled();
    });

    it('recusa extensão fora da allowlist', async () => {
      mockZip([
        buildZipEntry({ path: 'index.html' }),
        buildZipEntry({ path: 'app.exe' }),
      ]);

      await expect(useCase.execute(buildZipFile(), admin)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockStorage.upload).not.toHaveBeenCalled();
    });

    it('recusa entrada symlink', async () => {
      mockZip([
        buildZipEntry({ path: 'index.html' }),
        // S_IFLNK (0xA000) nos 16 bits altos de externalFileAttributes.
        buildZipEntry({ path: 'link', externalFileAttributes: 0xa1ff0000 }),
      ]);

      await expect(useCase.execute(buildZipFile(), admin)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockStorage.upload).not.toHaveBeenCalled();
    });

    it('recusa .zip sem index.html', async () => {
      mockZip([buildZipEntry({ path: 'style.css' })]);

      await expect(useCase.execute(buildZipFile(), admin)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockStorage.upload).not.toHaveBeenCalled();
    });

    it('ignora .DS_Store silenciosamente', async () => {
      mockZip([
        buildZipEntry({ path: 'index.html' }),
        buildZipEntry({ path: '.DS_Store' }),
      ]);

      const created = await useCase.execute(buildZipFile(), admin);
      expect((created.files as unknown[]).length).toBe(1);
    });

    it('sobe cada entrada válida e grava kind FOLDER', async () => {
      mockZip([
        buildZipEntry({ path: 'index.html', uncompressedSize: 10 }),
        buildZipEntry({ path: 'style.css', uncompressedSize: 5 }),
      ]);

      const created = await useCase.execute(buildZipFile(), admin);

      expect(created.kind).toBe('FOLDER');
      expect(created.entryFileName).toBe('index.html');
      expect(mockStorage.upload).toHaveBeenCalledTimes(2);
      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.stringContaining('index.html'),
        expect.any(Buffer),
        'text/html',
      );
      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.stringContaining('style.css'),
        expect.any(Buffer),
        'text/css',
      );
    });
  });
});
