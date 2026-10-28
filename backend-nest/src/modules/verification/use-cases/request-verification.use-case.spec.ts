import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RequestVerificationUseCase } from './request-verification.use-case';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { MessagingService } from '../../messaging/messaging.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';

const mockPrisma = {
  user: { findUniqueOrThrow: vi.fn() },
  verificationCode: { findFirst: vi.fn(), create: vi.fn() },
};
const mockEmail = {
  checkHealth: vi.fn(),
  renderTemplate: vi.fn(),
  sendNow: vi.fn(),
};
const mockMessaging = { isEnabled: vi.fn(), sendTemplate: vi.fn() };
const mockLogging = { create: vi.fn() };
const mockI18n = { t: vi.fn((k: string) => k) };

const fakeUser = {
  id: 'u1',
  email: 'a@b.com',
  phone: '+5511999998888',
  name: 'Ana',
};

describe('RequestVerificationUseCase', () => {
  let useCase: RequestVerificationUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        RequestVerificationUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmail },
        { provide: MessagingService, useValue: mockMessaging },
        { provide: LoggingService, useValue: mockLogging },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = mod.get(RequestVerificationUseCase);

    vi.clearAllMocks();
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue(fakeUser);
    mockPrisma.verificationCode.findFirst.mockResolvedValue(null);
    mockPrisma.verificationCode.create.mockResolvedValue({});
    mockEmail.checkHealth.mockResolvedValue({ operational: true });
    mockEmail.renderTemplate.mockResolvedValue('<html></html>');
    mockEmail.sendNow.mockResolvedValue({ status: true, data: 'sent' });
    mockMessaging.isEnabled.mockResolvedValue(true);
    mockMessaging.sendTemplate.mockResolvedValue('msg-id');
  });

  it('envia por EMAIL e persiste o código com sucesso', async () => {
    const result = await useCase.execute({
      userId: 'u1',
      purpose: 'TEST_PURPOSE',
      channel: 'EMAIL',
    });

    expect(mockEmail.checkHealth).toHaveBeenCalled();
    expect(mockEmail.sendNow).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.com' }),
    );
    expect(mockPrisma.verificationCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          purpose: 'TEST_PURPOSE',
          channel: 'EMAIL',
          target: 'a@b.com',
        }),
      }),
    );
    expect(mockLogging.create).toHaveBeenCalled();
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('envia por WHATSAPP e persiste o código com sucesso', async () => {
    await useCase.execute({
      userId: 'u1',
      purpose: 'TEST_PURPOSE',
      channel: 'WHATSAPP',
    });

    expect(mockMessaging.isEnabled).toHaveBeenCalled();
    expect(mockMessaging.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+5511999998888' }),
      { userId: 'u1' },
    );
    expect(mockPrisma.verificationCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channel: 'WHATSAPP' }),
      }),
    );
  });

  it('lança quando AUTHENTICATOR é pedido (não implementado)', async () => {
    await expect(
      useCase.execute({
        userId: 'u1',
        purpose: 'TEST_PURPOSE',
        channel: 'AUTHENTICATOR',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.user.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('lança quando o usuário não tem telefone para o canal WHATSAPP', async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      ...fakeUser,
      phone: null,
    });

    await expect(
      useCase.execute({
        userId: 'u1',
        purpose: 'TEST_PURPOSE',
        channel: 'WHATSAPP',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockMessaging.sendTemplate).not.toHaveBeenCalled();
  });

  it('respeita o cooldown: rejeita um novo pedido a menos de 60s do último', async () => {
    mockPrisma.verificationCode.findFirst.mockResolvedValue({
      createdAt: new Date(),
    });

    await expect(
      useCase.execute({
        userId: 'u1',
        purpose: 'TEST_PURPOSE',
        channel: 'EMAIL',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockEmail.sendNow).not.toHaveBeenCalled();
  });

  it('permite um novo pedido depois do cooldown', async () => {
    mockPrisma.verificationCode.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 61_000),
    });

    await useCase.execute({
      userId: 'u1',
      purpose: 'TEST_PURPOSE',
      channel: 'EMAIL',
    });
    expect(mockEmail.sendNow).toHaveBeenCalled();
  });

  it('lança sem tentar enviar quando o email não está operacional', async () => {
    mockEmail.checkHealth.mockResolvedValue({
      operational: false,
      reason: 'invalid key',
    });

    await expect(
      useCase.execute({
        userId: 'u1',
        purpose: 'TEST_PURPOSE',
        channel: 'EMAIL',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(mockEmail.sendNow).not.toHaveBeenCalled();
    expect(mockPrisma.verificationCode.create).not.toHaveBeenCalled();
  });

  it('lança sem tentar enviar quando a mensageria não está habilitada', async () => {
    mockMessaging.isEnabled.mockResolvedValue(false);

    await expect(
      useCase.execute({
        userId: 'u1',
        purpose: 'TEST_PURPOSE',
        channel: 'WHATSAPP',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(mockMessaging.sendTemplate).not.toHaveBeenCalled();
  });

  it('lança e não persiste quando sendNow() reporta falha', async () => {
    mockEmail.sendNow.mockResolvedValue({ status: false, data: 'bounced' });

    await expect(
      useCase.execute({
        userId: 'u1',
        purpose: 'TEST_PURPOSE',
        channel: 'EMAIL',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(mockPrisma.verificationCode.create).not.toHaveBeenCalled();
  });

  it('usa o target explícito em vez de user.phone, quando informado', async () => {
    // Caso real: UpdateProfileUseCase pede confirmação do telefone NOVO antes de gravá-lo —
    // nesse momento user.phone ainda é o antigo.
    await useCase.execute({
      userId: 'u1',
      purpose: 'TEST_PURPOSE',
      channel: 'WHATSAPP',
      target: '+5511888887777',
    });

    expect(mockMessaging.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+5511888887777' }),
      { userId: 'u1' },
    );
    expect(mockPrisma.verificationCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ target: '+5511888887777' }),
      }),
    );
  });

  it('propaga e não persiste quando sendTemplate() lança', async () => {
    mockMessaging.sendTemplate.mockRejectedValue(new Error('provider down'));

    await expect(
      useCase.execute({
        userId: 'u1',
        purpose: 'TEST_PURPOSE',
        channel: 'WHATSAPP',
      }),
    ).rejects.toThrow('provider down');
    expect(mockPrisma.verificationCode.create).not.toHaveBeenCalled();
  });
});
