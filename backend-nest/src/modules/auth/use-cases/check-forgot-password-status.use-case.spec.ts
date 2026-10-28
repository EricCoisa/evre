import { describe, expect, it, vi } from 'vitest';
import { CheckForgotPasswordStatusUseCase } from './check-forgot-password-status.use-case';
import type { EmailService } from '../../email/email.service';

describe('CheckForgotPasswordStatusUseCase', () => {
  const mockEmailService = {
    checkHealth: vi.fn(),
  } as unknown as EmailService;

  const useCase = new CheckForgotPasswordStatusUseCase(mockEmailService);

  it('retorna available true quando o email service estiver operacional', async () => {
    vi.mocked(mockEmailService.checkHealth).mockResolvedValueOnce({
      operational: true,
    });

    const result = await useCase.execute();

    expect(result).toEqual({ available: true });
    expect(mockEmailService.checkHealth).toHaveBeenCalled();
  });

  it('retorna available false quando o email service não estiver operacional', async () => {
    vi.mocked(mockEmailService.checkHealth).mockResolvedValueOnce({
      operational: false,
      reason: 'SMTP connection failed',
    });

    const result = await useCase.execute();

    expect(result).toEqual({ available: false });
  });
});

