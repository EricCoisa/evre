import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { ArchiveArtifactUseCase } from './archive-artifact.use-case';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  roleId: 'role-admin',
  roleName: 'ADMIN',
};

const artifactRow = {
  id: 'artifact-1',
  kind: 'FILE',
  storageKey: 'app/artifacts/uuid.html',
  fileName: 'demo.html',
  archivedAt: null as Date | null,
};

const mockPrisma = {
  artifact: { findUnique: vi.fn(), update: vi.fn() },
};
const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };
const mockLogging = { create: vi.fn() };

describe('ArchiveArtifactUseCase', () => {
  let useCase: ArchiveArtifactUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ArchiveArtifactUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
      ],
    }).compile();
    useCase = module.get(ArchiveArtifactUseCase);

    vi.clearAllMocks();
    mockPrisma.artifact.findUnique.mockResolvedValue({ ...artifactRow });
    mockPrisma.artifact.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...artifactRow,
        ...data,
      }),
    );
  });

  it('arquiva sem apagar a linha nem trocar a storageKey', async () => {
    const result = await useCase.execute('artifact-1', admin);

    expect(mockPrisma.artifact.update).toHaveBeenCalledWith({
      where: { id: 'artifact-1' },
      data: { archivedAt: expect.any(Date) },
    });
    expect(result.storageKey).toBe(artifactRow.storageKey);
  });

  it('recusa artefato inexistente', async () => {
    mockPrisma.artifact.findUnique.mockResolvedValue(null);

    await expect(useCase.execute('missing', admin)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.artifact.update).not.toHaveBeenCalled();
  });

  it('arquivar duas vezes é idempotente, sem log duplicado', async () => {
    mockPrisma.artifact.findUnique.mockResolvedValue({
      ...artifactRow,
      archivedAt: new Date('2026-01-01'),
    });

    const result = await useCase.execute('artifact-1', admin);

    expect(mockPrisma.artifact.update).not.toHaveBeenCalled();
    expect(mockLogging.create).not.toHaveBeenCalled();
    expect(result.archivedAt).toEqual(new Date('2026-01-01'));
  });
});
