import { MarkConfirmedUseCase } from './mark-confirmed.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { LoggingService } from '../../logging/logging.service';
import type { VerificationHandlerRegistry } from '../verification-handler.registry';

describe('MarkConfirmedUseCase', () => {
  const create = vi.fn();
  const prisma = { verificationCode: { create } } as unknown as PrismaService;
  const logging = { create: vi.fn() } as unknown as LoggingService;
  const handlers = { invoke: vi.fn() } as unknown as VerificationHandlerRegistry;
  const useCase = new MarkConfirmedUseCase(prisma, logging, handlers);

  beforeEach(() => vi.clearAllMocks());

  it('cria a linha já consumida (sem enviar nada)', async () => {
    await useCase.execute({
      userId: 'u1',
      purpose: 'USER_EMAIL_CONFIRMATION',
      channel: 'EMAIL',
      target: 'a@b.com',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        purpose: 'USER_EMAIL_CONFIRMATION',
        channel: 'EMAIL',
        target: 'a@b.com',
        consumedAt: expect.any(Date),
        expiresAt: expect.any(Date),
        codeHash: expect.any(String),
      }),
    });
  });

  it('loga a confirmação', async () => {
    await useCase.execute({
      userId: 'u1',
      purpose: 'USER_EMAIL_CONFIRMATION',
      channel: 'EMAIL',
      target: 'a@b.com',
    });

    expect(logging.create).toHaveBeenCalled();
  });

  it('invoca o handler registrado para o purpose, com o target informado', async () => {
    await useCase.execute({
      userId: 'u1',
      purpose: 'USER_EMAIL_CONFIRMATION',
      channel: 'EMAIL',
      target: 'a@b.com',
    });

    expect(handlers.invoke).toHaveBeenCalledWith('USER_EMAIL_CONFIRMATION', {
      userId: 'u1',
      target: 'a@b.com',
    });
  });
});
