import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { CmsService } from './cms.service';
import { CheckCmsAccessUseCase } from './use-cases/check-cms-access.use-case';
import { EnsurePayloadUserAndLoginUseCase } from './use-cases/ensure-payload-user-and-login.use-case';

const mockCheckCmsAccess = { execute: vi.fn() };
const mockEnsurePayloadUserAndLogin = { execute: vi.fn() };
const mockI18n = { t: vi.fn((k: string) => k) };

describe('CmsService', () => {
  let service: CmsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmsService,
        { provide: CheckCmsAccessUseCase, useValue: mockCheckCmsAccess },
        {
          provide: EnsurePayloadUserAndLoginUseCase,
          useValue: mockEnsurePayloadUserAndLogin,
        },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    service = module.get<CmsService>(CmsService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('getCredentials', () => {
    it('throws ForbiddenException when user has no CMS access', async () => {
      mockCheckCmsAccess.execute.mockResolvedValue(false);
      await expect(service.getCredentials('u1', 'USER')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockEnsurePayloadUserAndLogin.execute).not.toHaveBeenCalled();
    });

    it('returns credentials when user has CMS access', async () => {
      mockCheckCmsAccess.execute.mockResolvedValue(true);
      mockEnsurePayloadUserAndLogin.execute.mockResolvedValue({
        email: 'user@example.com',
        password: 'master-password',
      });
      const result = await service.getCredentials('u1', 'ADMIN');
      expect(mockCheckCmsAccess.execute).toHaveBeenCalledWith('u1', 'ADMIN');
      expect(mockEnsurePayloadUserAndLogin.execute).toHaveBeenCalledWith('u1');
      expect(result).toEqual({
        email: 'user@example.com',
        password: 'master-password',
      });
    });

    it('propagates errors from EnsurePayloadUserAndLoginUseCase', async () => {
      mockCheckCmsAccess.execute.mockResolvedValue(true);
      mockEnsurePayloadUserAndLogin.execute.mockRejectedValue(
        new Error('CMS unavailable'),
      );
      await expect(service.getCredentials('u1', 'ADMIN')).rejects.toThrow(
        'CMS unavailable',
      );
    });
  });
});
