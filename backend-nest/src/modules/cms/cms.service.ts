import { ForbiddenException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { CheckCmsAccessUseCase } from './use-cases/check-cms-access.use-case';
import { EnsurePayloadUserAndLoginUseCase } from './use-cases/ensure-payload-user-and-login.use-case';

@Injectable()
export class CmsService {
  constructor(
    private readonly checkCmsAccess: CheckCmsAccessUseCase,
    private readonly ensurePayloadUserAndLogin: EnsurePayloadUserAndLoginUseCase,
    private readonly i18n: I18nService,
  ) {}

  async getCredentials(
    userId: string,
    roleId: string | null,
  ): Promise<{ email: string; password: string }> {
    const hasAccess = await this.checkCmsAccess.execute(userId, roleId);
    if (!hasAccess) {
      throw new ForbiddenException(
        this.i18n.t('cms.access_denied', {
          defaultValue: 'You do not have access to CMS',
        }),
      );
    }
    return this.ensurePayloadUserAndLogin.execute(userId);
  }
}
