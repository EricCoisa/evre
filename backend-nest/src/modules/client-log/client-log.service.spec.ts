const axiosPostFn = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: { post: axiosPostFn },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ClientLogService } from './client-log.service';
import { SystemConfigurationService } from '../system-configuration/system-configuration.service';

const makeConfig = (key: string, value: unknown) => ({ labelKey: key, value });

describe('ClientLogService', () => {
  let service: ClientLogService;
  let sysConfig: { findByLabelKey: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    sysConfig = { findByLabelKey: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientLogService,
        { provide: SystemConfigurationService, useValue: sysConfig },
      ],
    }).compile();
    service = module.get<ClientLogService>(ClientLogService);
  });

  afterEach(() => vi.clearAllMocks());

  it('returns null immediately when SENDLOG is false', async () => {
    sysConfig.findByLabelKey.mockResolvedValue(
      makeConfig('SYSTEMCONFIG_SENDLOG', false),
    );
    const result = await service.create({ metadata: { test: 1 } });
    expect(result).toBeNull();
    expect(axiosPostFn).not.toHaveBeenCalled();
  });

  it('posts to webhook when SENDLOG is true and config is complete', async () => {
    sysConfig.findByLabelKey
      .mockResolvedValueOnce(makeConfig('SYSTEMCONFIG_SENDLOG', true))
      .mockResolvedValueOnce(
        makeConfig('SYSTEMCONFIG_SUPORTURL', 'https://support.example.com'),
      )
      .mockResolvedValueOnce(makeConfig('SYSTEMID', 'sys-123'))
      .mockResolvedValueOnce(makeConfig('SYSTEMTOKEN', 'token-abc'));

    axiosPostFn.mockResolvedValue({ status: 200 });

    const result = await service.create({ metadata: { test: 1 } });
    expect(axiosPostFn).toHaveBeenCalledWith(
      'https://support.example.com/api/clientLog/webhook',
      expect.objectContaining({ environment: expect.any(String) }),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(result).toBeNull();
  });

  it('returns null and logs when config is incomplete (empty values)', async () => {
    sysConfig.findByLabelKey
      .mockResolvedValueOnce(makeConfig('SYSTEMCONFIG_SENDLOG', true))
      .mockResolvedValueOnce(makeConfig('SYSTEMCONFIG_SUPORTURL', ''))
      .mockResolvedValueOnce(makeConfig('SYSTEMID', ''))
      .mockResolvedValueOnce(makeConfig('SYSTEMTOKEN', ''));

    const result = await service.create({ metadata: {} });
    expect(result).toBeNull();
    expect(axiosPostFn).not.toHaveBeenCalled();
  });

  it('swallows axios errors silently', async () => {
    sysConfig.findByLabelKey
      .mockResolvedValueOnce(makeConfig('SYSTEMCONFIG_SENDLOG', true))
      .mockResolvedValueOnce(
        makeConfig('SYSTEMCONFIG_SUPORTURL', 'https://support.example.com'),
      )
      .mockResolvedValueOnce(makeConfig('SYSTEMID', 'sys-123'))
      .mockResolvedValueOnce(makeConfig('SYSTEMTOKEN', 'token-abc'));

    axiosPostFn.mockRejectedValue(new Error('network error'));

    await expect(service.create({ metadata: { test: 1 } })).resolves.toBeNull();
  });

  it('uses NEST_PUBLIC_ENV value when set', async () => {
    process.env.NEST_PUBLIC_ENV = 'staging';
    sysConfig.findByLabelKey
      .mockResolvedValueOnce(makeConfig('SYSTEMCONFIG_SENDLOG', true))
      .mockResolvedValueOnce(
        makeConfig('SYSTEMCONFIG_SUPORTURL', 'https://support.example.com'),
      )
      .mockResolvedValueOnce(makeConfig('SYSTEMID', 'sys-123'))
      .mockResolvedValueOnce(makeConfig('SYSTEMTOKEN', 'token-abc'));
    axiosPostFn.mockResolvedValue({ status: 200 });
    await service.create({ metadata: {} });
    expect(axiosPostFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ environment: 'staging' }),
      expect.any(Object),
    );
    delete process.env.NEST_PUBLIC_ENV;
  });

  it('uses development fallback when NEST_PUBLIC_ENV is not set', async () => {
    const saved = process.env.NEST_PUBLIC_ENV;
    delete process.env.NEST_PUBLIC_ENV;
    sysConfig.findByLabelKey
      .mockResolvedValueOnce(makeConfig('SYSTEMCONFIG_SENDLOG', true))
      .mockResolvedValueOnce(
        makeConfig('SYSTEMCONFIG_SUPORTURL', 'https://support.example.com'),
      )
      .mockResolvedValueOnce(makeConfig('SYSTEMID', 'sys-123'))
      .mockResolvedValueOnce(makeConfig('SYSTEMTOKEN', 'token-abc'));
    axiosPostFn.mockResolvedValue({ status: 200 });
    await service.create({ metadata: {} });
    expect(axiosPostFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ environment: 'development' }),
      expect.any(Object),
    );
    if (saved !== undefined) process.env.NEST_PUBLIC_ENV = saved;
  });
});
