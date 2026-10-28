import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { StorageService } from '../../storage/storage.service';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import {
  UploadProposalArtifactUseCase,
  type UploadProposalArtifactFile,
} from './upload-proposal-artifact.use-case';
import { FindOneProposalUseCase } from './find-one.use-case';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  roleId: 'role-admin',
  roleName: 'ADMIN',
};

const proposalRow = {
  id: 'proposal-1',
  companyId: null as string | null,
  ownerId: 'user-1',
  name: 'Exemplo',
  status: 'DRAFT',
};

function buildFile(
  overrides: Partial<UploadProposalArtifactFile> = {},
): UploadProposalArtifactFile {
  return {
    buffer: Buffer.from('conteudo'),
    originalname: 'demo.html',
    mimetype: 'text/html',
    size: 1024,
    ...overrides,
  };
}

const mockPrisma = {
  proposal: { findUnique: vi.fn() },
  proposalArtifact: { create: vi.fn() },
};

const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };
const mockLogging = { create: vi.fn() };
const mockResourceAccess = { assertCanRead: vi.fn() };
const mockStorage = { buildKey: vi.fn(), upload: vi.fn() };
const mockSystemConfig = { getValueOrNull: vi.fn() };

describe('UploadProposalArtifactUseCase', () => {
  let useCase: UploadProposalArtifactUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UploadProposalArtifactUseCase,
        FindOneProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: StorageService, useValue: mockStorage },
        { provide: SystemConfigurationService, useValue: mockSystemConfig },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get(UploadProposalArtifactUseCase);

    vi.clearAllMocks();
    mockPrisma.proposal.findUnique.mockResolvedValue({ ...proposalRow });
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockSystemConfig.getValueOrNull.mockResolvedValue(null);
    mockStorage.buildKey.mockImplementation(
      (prefix: string, ext: string) => `app/${prefix}/generated-uuid.${ext}`,
    );
    mockStorage.upload.mockResolvedValue(undefined);
    mockPrisma.proposalArtifact.create.mockImplementation(({ data }) => ({
      id: 'artifact-1',
      archivedAt: null,
      ...data,
    }));
  });

  it('recusa contentType fora da allowlist', async () => {
    await expect(
      useCase.execute(
        'proposal-1',
        buildFile({ mimetype: 'application/zip' }),
        admin,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockStorage.upload).not.toHaveBeenCalled();
    expect(mockPrisma.proposalArtifact.create).not.toHaveBeenCalled();
  });

  it('recusa arquivo acima do tamanho máximo configurado', async () => {
    mockSystemConfig.getValueOrNull.mockResolvedValue('1000');

    await expect(
      useCase.execute('proposal-1', buildFile({ size: 1001 }), admin),
    ).rejects.toThrow(BadRequestException);
    expect(mockStorage.upload).not.toHaveBeenCalled();
  });

  it('aceita quando está exatamente no limite configurado', async () => {
    mockSystemConfig.getValueOrNull.mockResolvedValue('1000');

    await expect(
      useCase.execute('proposal-1', buildFile({ size: 1000 }), admin),
    ).resolves.toBeDefined();
  });

  it('grava a chave no padrão proposals/<id>/artifacts/<uuid>.<ext>', async () => {
    const created = await useCase.execute('proposal-1', buildFile(), admin);

    expect(mockStorage.buildKey).toHaveBeenCalledWith(
      'proposals/proposal-1/artifacts',
      'html',
    );
    expect(created.storageKey).toMatch(
      /proposals\/proposal-1\/artifacts\/generated-uuid\.html$/,
    );
    expect(mockStorage.upload).toHaveBeenCalledWith(
      created.storageKey,
      expect.any(Buffer),
      'text/html',
    );
  });

  it('substituir o artefato gera uma chave NOVA, nunca reaproveita a anterior', async () => {
    let call = 0;
    mockStorage.buildKey.mockImplementation(
      (prefix: string, ext: string) => `app/${prefix}/uuid-${++call}.${ext}`,
    );

    const first = await useCase.execute('proposal-1', buildFile(), admin);
    const second = await useCase.execute('proposal-1', buildFile(), admin);

    expect(first.storageKey).not.toBe(second.storageKey);
    expect(mockStorage.upload).toHaveBeenCalledTimes(2);
  });
});
