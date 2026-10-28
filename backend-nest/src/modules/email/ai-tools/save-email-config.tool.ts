import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { SaveEmailConfigSchema } from '../dto/save-email-config.dto';
import type { SaveEmailConfigDto } from '../dto/save-email-config.dto';
import { SaveEmailConfigurationUseCase } from '../use-cases/save-configuration.use-case';

/** Reusa o use-case do `PUT /email/config` — valida no provider antes de gravar. */
@AiToolDef()
@Injectable()
export class SaveEmailConfigTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'save_email_config',
    description:
      'Valida e salva a configuração de email. Exige provider (RESEND ou SMTP) e defaultFrom; para SMTP exige também smtpHost e smtpPort. As credenciais (apiKey para Resend, smtpPass para SMTP) são opcionais: OMITA-AS para manter as já gravadas — nunca apaga. O conjunto é testado contra o provider real antes de persistir: credencial recusada = erro com o motivo e banco intacto.',
    inputSchema: SaveEmailConfigSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.SYSTEM_CONFIGURATION_WRITE,
    invalidates: [
      InvalidationTags.SYSTEM_CONFIGURATION,
      InvalidationTags.EMAIL,
    ],
  };

  constructor(private readonly saveConfig: SaveEmailConfigurationUseCase) {}

  execute(input: SaveEmailConfigDto, ctx: AiToolContext) {
    return this.saveConfig.execute(input, ctx.userId);
  }
}
