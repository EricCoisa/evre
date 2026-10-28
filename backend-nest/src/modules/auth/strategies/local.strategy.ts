import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { I18nService } from 'nestjs-i18n';
import { ValidateUserUseCase } from '../use-cases/validate-user.use-case';
import type { UserPayload } from '../../../common/types/auth.types';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private validateUser$: ValidateUserUseCase,
    private i18n: I18nService,
  ) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<UserPayload> {
    const user = await this.validateUser$.execute(email, password);
    if (!user) {
      throw new UnauthorizedException(
        this.i18n.t('auth.login.invalid_credentials'),
      );
    }
    return user;
  }
}
