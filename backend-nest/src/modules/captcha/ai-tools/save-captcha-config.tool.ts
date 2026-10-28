import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { SaveCaptchaConfigSchema } from '../dto/captcha.dto';
import type { SaveCaptchaConfigDto } from '../dto/captcha.dto';
import { SaveCaptchaConfigUseCase } from '../use-cases/save-captcha-config.use-case';

/** Valida e salva as credenciais do captcha, reusando o use-case do PUT /captcha/config. */
@AiToolDef()
@Injectable()
export class SaveCaptchaConfigTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'save_captcha_config',
    description:
      'Valida e salva as credenciais do captcha. Exige provider (use get_captcha_config para os ids válidos) e siteKey; secretKey é opcional — OMITA para manter a já gravada. A secret key é testada no provider antes de gravar. ATENÇÃO: sem o token do widget (que só o browser resolve) a SITE KEY não é verificada — avise o usuário para testar a tela de login depois de trocar. Esta tool NÃO liga nem desliga o captcha: para isso altere SYSTEM_CAPTCHA_ENABLED por update_system_configuration.',
    inputSchema: SaveCaptchaConfigSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.SYSTEM_CONFIGURATION_WRITE,
    invalidates: [
      InvalidationTags.SYSTEM_CONFIGURATION,
      InvalidationTags.CAPTCHA,
    ],
  };

  constructor(private readonly saveConfig: SaveCaptchaConfigUseCase) {}

  execute(input: SaveCaptchaConfigDto, ctx: AiToolContext) {
    return this.saveConfig.execute(input, ctx.userId);
  }
}
