import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfirmVerificationUseCase } from './confirm-verification.use-case';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import { hashVerificationCode } from '../verification.util';
import { VerificationHandlerRegistry } from '../verification-handler.registry';

const mockPrisma = {
  verificationCode: { findFirst: vi.fn(), update: vi.fn() },
};
const mockLogging = { create: vi.fn() };
const mockI18n = { t: vi.fn((k: string) => k) };
const mockHandlers = { invoke: vi.fn() };

const CODE = '123456';
const codeHash = hashVerificationCode(CODE);

const activeRow = {
  id: 'vc1',
  codeHash,
  target: '+5511999998888',
  attempts: 0,
  maxAttempts: 5,
  expiresAt: new Date(Date.now() + 60_000),
  consumedAt: null as Date | null,
};

describe('ConfirmVerificationUseCase', () => {
  let useCase: ConfirmVerificationUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        ConfirmVerificationUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggingService, useValue: mockLogging },
        { provide: I18nService, useValue: mockI18n },
        { provide: VerificationHandlerRegistry, useValue: mockHandlers },
      ],
    }).compile();
    useCase = mod.get(ConfirmVerificationUseCase);

    vi.clearAllMocks();
    mockPrisma.verificationCode.findFirst.mockResolvedValue({ ...activeRow });
    mockPrisma.verificationCode.update.mockResolvedValue({});
  });

  it('confirma com o código correto: marca consumedAt e loga', async () => {
    await useCase.execute({ userId: 'u1', purpose: 'P', code: CODE });

    expect(mockPrisma.verificationCode.update).toHaveBeenCalledWith({
      where: { id: 'vc1' },
      data: { consumedAt: expect.any(Date) },
    });
    expect(mockLogging.create).toHaveBeenCalled();
  });

  it('invoca o handler registrado para o purpose, com o target da linha', async () => {
    await useCase.execute({ userId: 'u1', purpose: 'P', code: CODE });

    expect(mockHandlers.invoke).toHaveBeenCalledWith('P', {
      userId: 'u1',
      target: '+5511999998888',
    });
  });

  it('não invoca handler quando o código está errado', async () => {
    await expect(
      useCase.execute({ userId: 'u1', purpose: 'P', code: '000000' }),
    ).rejects.toThrow(BadRequestException);
    expect(mockHandlers.invoke).not.toHaveBeenCalled();
  });

  it('busca sempre a linha mais recente (código velho nunca mais casa)', async () => {
    await useCase.execute({ userId: 'u1', purpose: 'P', code: CODE });

    expect(mockPrisma.verificationCode.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u1', purpose: 'P' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('lança sem nenhuma verificação pendente', async () => {
    mockPrisma.verificationCode.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'u1', purpose: 'P', code: CODE }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lança quando a verificação já foi consumida', async () => {
    mockPrisma.verificationCode.findFirst.mockResolvedValue({
      ...activeRow,
      consumedAt: new Date(),
    });

    await expect(
      useCase.execute({ userId: 'u1', purpose: 'P', code: CODE }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.verificationCode.update).not.toHaveBeenCalled();
  });

  it('lança quando o código expirou', async () => {
    mockPrisma.verificationCode.findFirst.mockResolvedValue({
      ...activeRow,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      useCase.execute({ userId: 'u1', purpose: 'P', code: CODE }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.verificationCode.update).not.toHaveBeenCalled();
  });

  it('lança sem mutação quando as tentativas se esgotaram', async () => {
    mockPrisma.verificationCode.findFirst.mockResolvedValue({
      ...activeRow,
      attempts: 5,
    });

    await expect(
      useCase.execute({ userId: 'u1', purpose: 'P', code: CODE }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.verificationCode.update).not.toHaveBeenCalled();
  });

  it('lança e incrementa attempts em exatamente 1 quando o código é errado', async () => {
    await expect(
      useCase.execute({ userId: 'u1', purpose: 'P', code: '000000' }),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrisma.verificationCode.update).toHaveBeenCalledWith({
      where: { id: 'vc1' },
      data: { attempts: { increment: 1 } },
    });
  });
});
