import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SaveCaptchaConfigUseCase } from './save-captcha-config.use-case';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { CaptchaService } from '../captcha.service';
import { captchaConfigKeys } from '../../../domain/auth/captcha.const';

const mockSysConfig = {
  keepStoredWhenBlank: vi.fn(),
  setManyByLabelKey: vi.fn(),
};
const mockCaptcha = { validateConfiguration: vi.fn() };

const dto = {
  provider: 'TURNSTILE',
  siteKey: 'site-abc',
  secretKey: 'secret-xyz',
  token: 'tok-browser',
};

const savedKeys = () =>
  (
    mockSysConfig.setManyByLabelKey.mock.calls[0][0] as Array<{
      labelKey: string;
      secret?: boolean;
    }>
  ).map((entry) => entry.labelKey);

describe('SaveCaptchaConfigUseCase', () => {
  let useCase: SaveCaptchaConfigUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SaveCaptchaConfigUseCase,
        { provide: SystemConfigurationService, useValue: mockSysConfig },
        { provide: CaptchaService, useValue: mockCaptcha },
      ],
    }).compile();
    useCase = mod.get(SaveCaptchaConfigUseCase);
    vi.clearAllMocks();
    mockSysConfig.keepStoredWhenBlank.mockResolvedValue('secret-xyz');
    mockSysConfig.setManyByLabelKey.mockResolvedValue(undefined);
    mockCaptcha.validateConfiguration.mockResolvedValue({
      status: true,
      data: 'ok',
    });
  });

  it('valida e grava provider, site key e secret', async () => {
    await useCase.execute(dto, 'admin-1');

    expect(mockCaptcha.validateConfiguration).toHaveBeenCalledWith({
      provider: 'TURNSTILE',
      secretKey: 'secret-xyz',
      token: 'tok-browser',
    });
    expect(savedKeys()).toEqual([
      captchaConfigKeys.provider,
      captchaConfigKeys.siteKey,
      captchaConfigKeys.secretKey,
    ]);
    expect(mockSysConfig.setManyByLabelKey.mock.calls[0][1]).toBe('admin-1');
  });

  it('não grava ENABLED — desligar não pode exigir resolver captcha', async () => {
    await useCase.execute(dto, 'admin-1');

    expect(savedKeys()).not.toContain(captchaConfigKeys.enabled);
  });

  it('grava a secret marcada como secret (criptografa e mascara)', async () => {
    await useCase.execute(dto, 'admin-1');

    const entries = mockSysConfig.setManyByLabelKey.mock.calls[0][0] as Array<{
      labelKey: string;
      secret?: boolean;
    }>;
    const secret = entries.find(
      (entry) => entry.labelKey === captchaConfigKeys.secretKey,
    );
    expect(secret?.secret).toBe(true);
  });

  it('sonda reprovando NÃO grava nada', async () => {
    mockCaptcha.validateConfiguration.mockResolvedValue({
      status: false,
      data: 'Secret key inválida para este provider',
    });

    await expect(useCase.execute(dto, 'admin-1')).rejects.toThrow(
      'Secret key inválida para este provider',
    );
    expect(mockSysConfig.setManyByLabelKey).not.toHaveBeenCalled();
  });

  it('provider fora do registro é recusado antes da sonda', async () => {
    await expect(
      useCase.execute({ ...dto, provider: 'NAO_EXISTE' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    expect(mockCaptcha.validateConfiguration).not.toHaveBeenCalled();
  });

  it('secret em branco reusa a gravada', async () => {
    mockSysConfig.keepStoredWhenBlank.mockResolvedValue('secret-ja-gravada');

    await useCase.execute({ ...dto, secretKey: '' }, 'admin-1');

    expect(mockCaptcha.validateConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ secretKey: 'secret-ja-gravada' }),
    );
  });

  it('sem secret gravada e sem secret nova → erro antes de sondar', async () => {
    mockSysConfig.keepStoredWhenBlank.mockResolvedValue('');

    await expect(
      useCase.execute({ ...dto, secretKey: '' }, 'admin-1'),
    ).rejects.toThrow('secretKey é obrigatória');
    expect(mockCaptcha.validateConfiguration).not.toHaveBeenCalled();
  });
});
