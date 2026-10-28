import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SaveSentryConfigUseCase } from './save-sentry-config.use-case';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { SentryConfigService } from '../sentry-config.service';
import { sentryConfigKeys } from '../../../domain/observability/sentry.const';

const mockSysConfig = { setManyByLabelKey: vi.fn() };
const mockSentry = { validateDsn: vi.fn() };

const DSN = 'https://abc123@o0.ingest.sentry.io/1234567';

const savedEntries = () =>
  mockSysConfig.setManyByLabelKey.mock.calls[0][0] as Array<{
    labelKey: string;
    value: string;
  }>;

describe('SaveSentryConfigUseCase', () => {
  let useCase: SaveSentryConfigUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SaveSentryConfigUseCase,
        { provide: SystemConfigurationService, useValue: mockSysConfig },
        { provide: SentryConfigService, useValue: mockSentry },
      ],
    }).compile();
    useCase = mod.get(SaveSentryConfigUseCase);
    vi.clearAllMocks();
    mockSysConfig.setManyByLabelKey.mockResolvedValue(undefined);
    mockSentry.validateDsn.mockResolvedValue({ status: true, data: 'ok' });
  });

  it('valida no Sentry e grava o DSN sem espaços', async () => {
    await useCase.execute({ dsn: `  ${DSN}  ` }, 'user-1');

    expect(mockSentry.validateDsn).toHaveBeenCalledWith(DSN);
    expect(savedEntries()).toEqual([
      { labelKey: sentryConfigKeys.dsn, value: DSN },
    ]);
  });

  it('não grava nada quando a sonda reprova', async () => {
    mockSentry.validateDsn.mockResolvedValue({
      status: false,
      data: 'Chave pública do DSN recusada pelo Sentry',
    });

    await expect(useCase.execute({ dsn: DSN }, 'user-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockSysConfig.setManyByLabelKey).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])(
    'desliga com DSN vazio (%p) sem sondar',
    async (dsn) => {
      await useCase.execute({ dsn }, 'user-1');

      expect(mockSentry.validateDsn).not.toHaveBeenCalled();
      expect(savedEntries()).toEqual([
        { labelKey: sentryConfigKeys.dsn, value: '' },
      ]);
    },
  );
});
