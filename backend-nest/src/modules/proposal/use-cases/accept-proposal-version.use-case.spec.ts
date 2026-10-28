import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { NotificationService } from '../../notification/notification.service';
import { AcceptProposalVersionUseCase } from './accept-proposal-version.use-case';

const mockTx = {
  proposalVersion: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  proposal: {
    update: vi.fn(),
  },
};

const mockPrisma = {
  $transaction: vi.fn((operation: (tx: typeof mockTx) => Promise<unknown>) =>
    operation(mockTx),
  ),
};

const mockI18n = { t: vi.fn((key: string) => key) };
const mockLogging = { create: vi.fn() };
const mockNotification = { notify: vi.fn() };

function version(overrides: Record<string, unknown> = {}) {
  return {
    id: 'version-1',
    proposalId: 'proposal-1',
    acceptedAt: null as Date | null,
    revokedAt: null as Date | null,
    validUntil: null as Date | null,
    proposal: { ownerId: 'owner-1', name: 'Proposta X' },
    ...overrides,
  };
}

describe('AcceptProposalVersionUseCase', () => {
  let useCase: AcceptProposalVersionUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AcceptProposalVersionUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();
    useCase = module.get(AcceptProposalVersionUseCase);

    vi.clearAllMocks();
    mockTx.proposalVersion.findFirst.mockResolvedValue(null);
    mockTx.proposalVersion.updateMany.mockResolvedValue({ count: 1 });
  });

  it('caminho feliz (LINK): grava evidência, vira ACCEPTED e notifica o dono', async () => {
    mockTx.proposalVersion.findUnique.mockResolvedValue(version());

    const result = await useCase.execute({
      versionId: 'version-1',
      source: 'LINK',
      name: 'Cliente',
      email: 'cliente@example.com',
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
    });

    expect(mockTx.proposalVersion.updateMany).toHaveBeenCalledWith({
      where: { id: 'version-1', acceptedAt: null },
      data: expect.objectContaining({
        acceptedByName: 'Cliente',
        acceptedByEmail: 'cliente@example.com',
        acceptanceSource: 'LINK',
        acceptanceIp: '1.2.3.4',
        acceptanceAgent: 'Mozilla/5.0',
      }),
    });
    expect(mockTx.proposal.update).toHaveBeenCalledWith({
      where: { id: 'proposal-1' },
      data: { status: 'ACCEPTED' },
    });
    expect(mockNotification.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: { userIds: ['owner-1'] },
        channels: { whatsapp: true },
      }),
    );
    expect(result.alreadyAccepted).toBe(false);
  });

  it('OFFLINE grava a nota e registra quem registrou no SystemLog, nunca notify duplo', async () => {
    mockTx.proposalVersion.findUnique.mockResolvedValue(version());

    await useCase.execute({
      versionId: 'version-1',
      source: 'OFFLINE',
      note: 'Aceito por telefone',
      acceptedById: 'admin-1',
    });

    expect(mockTx.proposalVersion.updateMany).toHaveBeenCalledWith({
      where: { id: 'version-1', acceptedAt: null },
      data: expect.objectContaining({
        acceptanceSource: 'OFFLINE',
        acceptanceNote: 'Aceito por telefone',
      }),
    });
    expect(mockLogging.create).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'PROPOSAL' }),
      'admin-1',
    );
    expect(mockNotification.notify).toHaveBeenCalledTimes(1);
  });

  it('OFFLINE sem note é recusado antes de abrir a transação', async () => {
    await expect(
      useCase.execute({ versionId: 'version-1', source: 'OFFLINE' }),
    ).rejects.toThrow(BadRequestException);

    expect(mockI18n.t).toHaveBeenCalledWith('proposal.acceptance_note_required');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('aceitar duas vezes → um registro, a segunda chamada devolve sucesso sem gravar', async () => {
    mockTx.proposalVersion.findUnique.mockResolvedValueOnce(version());

    const first = await useCase.execute({
      versionId: 'version-1',
      source: 'LINK',
      name: 'Cliente',
      email: 'cliente@example.com',
    });
    expect(first.alreadyAccepted).toBe(false);
    expect(mockTx.proposalVersion.updateMany).toHaveBeenCalledTimes(1);
    expect(mockNotification.notify).toHaveBeenCalledTimes(1);

    mockTx.proposalVersion.findUnique.mockResolvedValueOnce(
      version({ acceptedAt: new Date('2026-01-01T00:00:00Z') }),
    );

    const second = await useCase.execute({
      versionId: 'version-1',
      source: 'LINK',
      name: 'Cliente',
      email: 'cliente@example.com',
    });

    expect(second.alreadyAccepted).toBe(true);
    expect(second.acceptedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    // Nenhuma escrita nem notificação extra na segunda chamada.
    expect(mockTx.proposalVersion.updateMany).toHaveBeenCalledTimes(1);
    expect(mockNotification.notify).toHaveBeenCalledTimes(1);
  });

  it('duas chamadas concorrentes → um acceptedAt (guarda atômica do updateMany)', async () => {
    // As duas leituram acceptedAt: null antes de qualquer commit — só o updateMany decide.
    mockTx.proposalVersion.findUnique.mockResolvedValue(version());
    mockTx.proposalVersion.updateMany.mockResolvedValueOnce({ count: 0 }); // perdeu a corrida
    mockTx.proposalVersion.findUniqueOrThrow.mockResolvedValueOnce({
      acceptedAt: new Date('2026-03-03T00:00:00Z'),
    });

    const result = await useCase.execute({
      versionId: 'version-1',
      source: 'LINK',
      name: 'Cliente',
      email: 'cliente@example.com',
    });

    expect(result.alreadyAccepted).toBe(true);
    expect(result.acceptedAt).toEqual(new Date('2026-03-03T00:00:00Z'));
    expect(mockTx.proposal.update).not.toHaveBeenCalled();
    expect(mockNotification.notify).not.toHaveBeenCalled();
  });

  it('versão revogada é recusada', async () => {
    mockTx.proposalVersion.findUnique.mockResolvedValue(
      version({ revokedAt: new Date('2026-01-01T00:00:00Z') }),
    );

    await expect(
      useCase.execute({
        versionId: 'version-1',
        source: 'LINK',
        name: 'Cliente',
        email: 'cliente@example.com',
      }),
    ).rejects.toThrow(GoneException);
    expect(mockI18n.t).toHaveBeenCalledWith('proposal.acceptance_revoked');
    expect(mockTx.proposalVersion.updateMany).not.toHaveBeenCalled();
  });

  it('versão expirada (validUntil no passado) é recusada', async () => {
    mockTx.proposalVersion.findUnique.mockResolvedValue(
      version({ validUntil: new Date(Date.now() - 10000) }),
    );

    await expect(
      useCase.execute({
        versionId: 'version-1',
        source: 'LINK',
        name: 'Cliente',
        email: 'cliente@example.com',
      }),
    ).rejects.toThrow(GoneException);
    expect(mockI18n.t).toHaveBeenCalledWith('proposal.acceptance_expired');
    expect(mockTx.proposalVersion.updateMany).not.toHaveBeenCalled();
  });

  it('proposta com outra versão já aceita é recusada', async () => {
    mockTx.proposalVersion.findUnique.mockResolvedValue(version());
    mockTx.proposalVersion.findFirst.mockResolvedValue({ id: 'version-2' });

    await expect(
      useCase.execute({
        versionId: 'version-1',
        source: 'LINK',
        name: 'Cliente',
        email: 'cliente@example.com',
      }),
    ).rejects.toThrow(ConflictException);
    expect(mockI18n.t).toHaveBeenCalledWith(
      'proposal.acceptance_other_version_accepted',
    );
    expect(mockTx.proposalVersion.updateMany).not.toHaveBeenCalled();
  });

  // "Nada de empresa/contrato/projeto é criado" é garantido por inspeção: a implementação só
  // chama `tx.proposalVersion`/`tx.proposal`, `LoggingService.create` e
  // `NotificationService.notify` — não há `company`/`contract`/`project` no mock porque o
  // use-case nunca referencia essas tabelas.
});
