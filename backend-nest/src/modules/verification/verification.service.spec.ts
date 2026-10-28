import { VerificationChannel } from '@prisma/client';
import { VerificationService } from './verification.service';
import { RequestVerificationUseCase } from './use-cases/request-verification.use-case';
import { ConfirmVerificationUseCase } from './use-cases/confirm-verification.use-case';
import { IsVerifiedUseCase } from './use-cases/is-verified.use-case';
import { MarkConfirmedUseCase } from './use-cases/mark-confirmed.use-case';
import { CheckChannelHealthUseCase } from './use-cases/check-channel-health.use-case';

describe('VerificationService', () => {
  let service: VerificationService;
  const requestUseCase = { execute: vi.fn() };
  const confirmUseCase = { execute: vi.fn() };
  const isVerifiedUseCase = { execute: vi.fn() };
  const markConfirmedUseCase = { execute: vi.fn() };
  const checkChannelHealthUseCase = { execute: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VerificationService(
      requestUseCase as unknown as RequestVerificationUseCase,
      confirmUseCase as unknown as ConfirmVerificationUseCase,
      isVerifiedUseCase as unknown as IsVerifiedUseCase,
      markConfirmedUseCase as unknown as MarkConfirmedUseCase,
      checkChannelHealthUseCase as unknown as CheckChannelHealthUseCase,
    );
  });

  it('request delega para RequestVerificationUseCase', async () => {
    const input = { userId: 'u1', purpose: 'login', channel: VerificationChannel.EMAIL, target: 'a@b.com' };
    requestUseCase.execute.mockResolvedValue({ expiresAt: new Date() });

    const result = await service.request(input as never);

    expect(requestUseCase.execute).toHaveBeenCalledWith(input);
    expect(result).toEqual({ expiresAt: expect.any(Date) });
  });

  it('confirm delega para ConfirmVerificationUseCase', async () => {
    const input = { userId: 'u1', purpose: 'login', code: '123456' };
    confirmUseCase.execute.mockResolvedValue(undefined);

    await service.confirm(input as never);

    expect(confirmUseCase.execute).toHaveBeenCalledWith(input);
  });

  it('isConfirmed delega para IsVerifiedUseCase', async () => {
    const input = { userId: 'u1', purpose: 'login', target: 'a@b.com' };
    isVerifiedUseCase.execute.mockResolvedValue(true);

    const result = await service.isConfirmed(input as never);

    expect(isVerifiedUseCase.execute).toHaveBeenCalledWith(input);
    expect(result).toBe(true);
  });

  it('markConfirmed delega para MarkConfirmedUseCase', async () => {
    const input = { userId: 'u1', purpose: 'login', target: 'a@b.com' };
    markConfirmedUseCase.execute.mockResolvedValue(undefined);

    await service.markConfirmed(input as never);

    expect(markConfirmedUseCase.execute).toHaveBeenCalledWith(input);
  });

  it('checkChannelHealth delega para CheckChannelHealthUseCase', async () => {
    checkChannelHealthUseCase.execute.mockResolvedValue({ ready: true });

    const result = await service.checkChannelHealth(VerificationChannel.WHATSAPP);

    expect(checkChannelHealthUseCase.execute).toHaveBeenCalledWith(
      VerificationChannel.WHATSAPP,
    );
    expect(result).toEqual({ ready: true });
  });
});
