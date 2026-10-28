import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SaveEmailConfigurationUseCase } from './save-configuration.use-case';
import { EmailService } from '../email.service';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import type { SaveEmailConfigDto } from '../dto/save-email-config.dto';

const mockEmailService = {
  validateCandidate: vi.fn(),
  invalidateHealthCache: vi.fn(),
};

const mockSysConfig = {
  keepStoredWhenBlank: vi.fn(),
  setManyByLabelKey: vi.fn(),
};

const smtpDto = {
  provider: 'SMTP',
  defaultFrom: 'no-reply@example.com',
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpUser: 'user',
  smtpPass: 'senha-nova',
  smtpSecure: false,
} as SaveEmailConfigDto;

describe('SaveEmailConfigurationUseCase', () => {
  let useCase: SaveEmailConfigurationUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SaveEmailConfigurationUseCase,
        { provide: EmailService, useValue: mockEmailService },
        { provide: SystemConfigurationService, useValue: mockSysConfig },
      ],
    }).compile();
    useCase = mod.get(SaveEmailConfigurationUseCase);
    vi.clearAllMocks();
    // Por padrão o merge de segredo devolve o que veio no formulário.
    mockSysConfig.keepStoredWhenBlank.mockImplementation((value: string) =>
      Promise.resolve(value ?? ''),
    );
  });

  it('credencial inválida: devolve 400 e NÃO grava nada', async () => {
    mockEmailService.validateCandidate.mockResolvedValue({
      status: false,
      data: 'Invalid login: 535 auth failed',
    });

    await expect(useCase.execute(smtpDto, 'admin-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockSysConfig.setManyByLabelKey).not.toHaveBeenCalled();
  });

  it('credencial válida: grava provider + campos do SMTP e derruba o cache de saúde', async () => {
    mockEmailService.validateCandidate.mockResolvedValue({
      status: true,
      data: 'ok',
    });

    const result = await useCase.execute(smtpDto, 'admin-1');

    expect(result.status).toBe(true);
    const [entries, performedById] =
      mockSysConfig.setManyByLabelKey.mock.calls[0];
    expect(performedById).toBe('admin-1');
    const byKey = Object.fromEntries(
      (entries as Array<{ labelKey: string; value: string }>).map((e) => [
        e.labelKey,
        e.value,
      ]),
    );
    expect(byKey).toMatchObject({
      SYSTEM_EMAIL_PROVIDER: 'SMTP',
      SYSTEM_EMAIL_DEFAULT_FROM: 'no-reply@example.com',
      SYSTEM_EMAIL_SMTP_HOST: 'smtp.example.com',
      SYSTEM_EMAIL_SMTP_PORT: '587',
      SYSTEM_EMAIL_SMTP_PASS: 'senha-nova',
    });
    // Chave do outro provider não entra — trocar de provider não deve sujar o RESEND.
    expect(byKey).not.toHaveProperty('SYSTEM_EMAIL_PROVIDER_API_KEY');
    expect(mockEmailService.invalidateHealthCache).toHaveBeenCalled();
  });

  it('senha em branco: valida e grava a senha já guardada, não vazio', async () => {
    mockSysConfig.keepStoredWhenBlank.mockResolvedValue('senha-guardada');
    mockEmailService.validateCandidate.mockResolvedValue({
      status: true,
      data: 'ok',
    });

    await useCase.execute({ ...smtpDto, smtpPass: '' }, 'admin-1');

    const candidate = mockEmailService.validateCandidate.mock.calls[0][0] as {
      smtp: { pass: string };
    };
    expect(candidate.smtp.pass).toBe('senha-guardada');
    const entries = mockSysConfig.setManyByLabelKey.mock.calls[0][0] as Array<{
      labelKey: string;
      value: string;
    }>;
    expect(
      entries.find((e) => e.labelKey === 'SYSTEM_EMAIL_SMTP_PASS')?.value,
    ).toBe('senha-guardada');
  });
});
