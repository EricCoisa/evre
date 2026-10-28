import { Body, Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GetApi, PutApi } from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { CaptchaService } from './captcha.service';
import { SaveCaptchaConfigUseCase } from './use-cases/save-captcha-config.use-case';
import {
  CaptchaConfigDto,
  CaptchaProviderDto,
  SaveCaptchaConfigDto,
} from './dto/captcha.dto';

@ApiTags('captcha')
@Controller('captcha')
export class CaptchaController {
  constructor(
    private readonly captchaService: CaptchaService,
    private readonly saveCaptchaConfig$: SaveCaptchaConfigUseCase,
  ) {}

  /** Anônima de propósito: o /login precisa do widget antes de existir sessão. Não devolve o secret. */
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @GetApi({
    path: 'config',
    summary: 'Configuração pública do captcha',
    description:
      'Provider escolhido, site key e URL do script. `enabled: false` quando o captcha está desligado ou incompleto — o front simplesmente não desenha widget.',
    status: 'OK',
    authenticated: false,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Configuração pública',
          schema: { dto: CaptchaConfigDto },
        },
      ],
    },
  })
  async config() {
    return this.captchaService.publicConfig();
  }

  /** Catálogo de providers para a tela de configuração; ADMIN. */
  @GetApi({
    path: 'providers',
    summary: 'Providers de captcha suportados',
    description:
      'Id, rótulo e URL do script de cada provider registrado. A tela usa o scriptUrl para desenhar o widget com a site key digitada antes de salvar.',
    status: 'OK',
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Providers registrados',
          schema: { dto: CaptchaProviderDto, isArray: true },
        },
      ],
    },
  })
  providers() {
    return this.captchaService.listProviders();
  }

  /** Valida as credenciais no provider e só então grava. Sem `@RequireCaptcha`, de propósito. */
  @PutApi({
    path: 'config',
    summary: 'Valida e salva as credenciais do captcha',
    status: 'OK',
    roles: ['ADMIN'],
    body: SaveCaptchaConfigDto,
  })
  async saveConfig(
    @Body() dto: SaveCaptchaConfigDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.saveCaptchaConfig$.execute(dto, currentUser.id);
  }
}
