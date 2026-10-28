import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { UpdateSystemConfigurationUseCase } from '../use-cases/update.use-case';
import { UpdateSystemConfigurationSchema } from '../dto/update-system-configuration.dto';
import { maskSecretValue } from 'src/common/utils/mask-secret-value.util';
import { SystemConfigurationService } from '../system-configuration.service';
import {
  typedConfigOwner,
  typedConfigRefusal,
} from 'src/domain/system-configuration/typed-config-keys.const';

const UpdateSystemConfigurationToolSchema = z
  .object({ id: z.string().uuid() })
  .extend(UpdateSystemConfigurationSchema.shape);
type UpdateSystemConfigurationInput = z.infer<
  typeof UpdateSystemConfigurationToolSchema
>;

@AiToolDef()
@Injectable()
export class UpdateSystemConfigurationTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_system_configuration',
    description:
      'Atualiza uma configuração do sistema existente pelo id. Pode afetar comportamento global da aplicação — use com cautela. Chaves de storage, email e captcha são recusadas aqui: use save_storage_config, save_email_config ou save_captcha_config, que validam a configuração contra o provider real antes de gravar.',
    inputSchema: UpdateSystemConfigurationToolSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.SYSTEM_CONFIGURATION_WRITE,
    invalidates: [InvalidationTags.SYSTEM_CONFIGURATION, InvalidationTags.AI],
  };

  constructor(
    private readonly updateUseCase: UpdateSystemConfigurationUseCase,
    private readonly sysConfig: SystemConfigurationService,
  ) {}

  async execute(input: UpdateSystemConfigurationInput, ctx: AiToolContext) {
    const { id, ...dto } = input;

    // Resolve o labelKey a partir do id para decidir se a chave é protegida.
    const { labelKey } = await this.sysConfig.findOne(id);
    const owner = typedConfigOwner(labelKey);
    if (owner)
      throw new BadRequestException(typedConfigRefusal(labelKey, owner));

    const result = await this.updateUseCase.execute(id, dto, ctx.userId);
    return maskSecretValue(result, 'value');
  }
}
