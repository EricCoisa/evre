import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { MessagingService } from '../../messaging/messaging.service';
import { ReservedButtonKey } from 'src/domain/messaging/messaging-buttons.const';
import { SendProposalUseCase } from './send-proposal.use-case';
import { FindOneProposalUseCase } from './find-one.use-case';
import { BuildProposalPublicLinkUseCase } from './build-proposal-public-link.use-case';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  roleId: 'role-admin',
  roleName: 'ADMIN',
};

const activeVersion = {
  id: 'version-1',
  proposalId: 'proposal-1',
  publicToken: 'a'.repeat(16),
  revokedAt: null as Date | null,
  validUntil: null as Date | null,
  totalCents: 150000,
  currency: 'BRL',
};

const mockPrisma = {
  proposalVersion: { findFirst: vi.fn() },
  companyContact: { findFirst: vi.fn() },
  proposalSend: { create: vi.fn() },
};
const mockI18n = { t: vi.fn((key: string) => key) };
const mockFindOne = { execute: vi.fn() };
const mockBuildLink = { execute: vi.fn() };
const mockMessaging = { trySendTemplateNow: vi.fn() };

describe('SendProposalUseCase', () => {
  let useCase: SendProposalUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SendProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: FindOneProposalUseCase, useValue: mockFindOne },
        { provide: BuildProposalPublicLinkUseCase, useValue: mockBuildLink },
        { provide: MessagingService, useValue: mockMessaging },
      ],
    }).compile();
    useCase = module.get(SendProposalUseCase);

    vi.clearAllMocks();
    mockFindOne.execute.mockResolvedValue({
      id: 'proposal-1',
      companyId: 'company-1',
      name: 'Proposta Exemplo',
    });
    mockPrisma.proposalVersion.findFirst.mockResolvedValue({ ...activeVersion });
    mockPrisma.companyContact.findFirst.mockResolvedValue({
      id: 'contact-1',
      isPrimary: true,
      messagingContact: { name: 'Ana Souza', phone: '5511999999999' },
    });
    mockBuildLink.execute.mockResolvedValue({
      code: 'short1',
      shortUrl: 'http://localhost:3000/s/short1',
    });
    mockMessaging.trySendTemplateNow.mockResolvedValue({ providerMessageId: 'message-1', acceptedAt: new Date() });
    mockPrisma.proposalSend.create.mockResolvedValue({});
  });

  it('recusa sem versão publicada ativa', async () => {
    mockPrisma.proposalVersion.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute({ proposalId: 'proposal-1' }, admin),
    ).rejects.toThrow(BadRequestException);
    expect(mockMessaging.trySendTemplateNow).not.toHaveBeenCalled();
    expect(mockPrisma.proposalSend.create).not.toHaveBeenCalled();
  });

  it('recusa versão revogada (não é mais ACTIVE)', async () => {
    mockPrisma.proposalVersion.findFirst.mockResolvedValue({
      ...activeVersion,
      revokedAt: new Date(),
    });

    await expect(
      useCase.execute({ proposalId: 'proposal-1' }, admin),
    ).rejects.toThrow(BadRequestException);
  });

  it('recusa sem phone e sem contato principal, com a chave i18n certa', async () => {
    mockPrisma.companyContact.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute({ proposalId: 'proposal-1' }, admin),
    ).rejects.toThrow(BadRequestException);
    expect(mockI18n.t).toHaveBeenCalledWith('proposal.send_no_contact');
    expect(mockMessaging.trySendTemplateNow).not.toHaveBeenCalled();
  });

  it('telefone informado dispensa o contato principal', async () => {
    mockPrisma.companyContact.findFirst.mockResolvedValue(null);

    const result = await useCase.execute(
      { proposalId: 'proposal-1', phone: '5511888888888' },
      admin,
    );

    expect(result.toPhone).toBe('5511888888888');
    expect(mockMessaging.trySendTemplateNow).toHaveBeenCalled();
  });

  it('trySendTemplateNow devolvendo null grava ProposalSend com succeeded:false e a rota não lança', async () => {
    mockMessaging.trySendTemplateNow.mockResolvedValue(null);

    const result = await useCase.execute({ proposalId: 'proposal-1' }, admin);

    expect(result.succeeded).toBe(false);
    expect(mockPrisma.proposalSend.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        versionId: 'version-1',
        channel: 'WHATSAPP',
        succeeded: false,
        detail: 'proposal.send_channel_unavailable',
      }),
    });
  });

  it('buttons.open leva o publicToken e o reservado opt_out', async () => {
    await useCase.execute({ proposalId: 'proposal-1' }, admin);

    expect(mockMessaging.trySendTemplateNow).toHaveBeenCalledWith(
      expect.objectContaining({
        buttons: {
          open: activeVersion.publicToken,
          [ReservedButtonKey.OPT_OUT]: true,
        },
      }),
      expect.anything(),
    );
  });

  it('correlation leva { type: "proposal", id }', async () => {
    await useCase.execute({ proposalId: 'proposal-1' }, admin);

    expect(mockMessaging.trySendTemplateNow).toHaveBeenCalledWith(
      expect.anything(),
      { correlation: { type: 'proposal', id: 'proposal-1' } },
    );
  });

  it('monta/reusa o link curto da versão vigente, grava o envio e devolve a URL curta sempre', async () => {
    const result = await useCase.execute({ proposalId: 'proposal-1' }, admin);

    expect(mockBuildLink.execute).toHaveBeenCalledWith({
      versionId: 'version-1',
      createdById: admin.id,
    });
    expect(result.shortUrl).toBe('http://localhost:3000/s/short1');
    expect(mockPrisma.proposalSend.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        versionId: 'version-1',
        toPhone: '5511999999999',
        succeeded: true,
        detail: 'message-1',
        sentById: admin.id,
      }),
    });
  });
});
