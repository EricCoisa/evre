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
import { RemoveSystemConfigurationUseCase } from '../use-cases/remove.use-case';
import { SystemConfigurationService } from '../system-configuration.service';
import {
  typedConfigOwner,
  typedConfigRefusal,
} from 'src/domain/system-configuration/typed-config-keys.const';

const DeleteSystemConfigurationSchema = z.object({ id: z.string().uuid() });
type DeleteSystemConfigurationInput = z.infer<
  typeof DeleteSystemConfigurationSchema
>;

@AiToolDef()
@Injectable()
export class DeleteSystemConfigurationTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'delete_system_configuration',
    description:
      'Remove uma configuração do sistema pelo id. Pode quebrar funcionalidades que dependem dela — use com cautela. Chaves de storage, email e captcha são recusadas aqui: apagá-las deixaria o provider meio configurado, sem validação. Use as tools save_*_config para reconfigurar.',
    inputSchema: DeleteSystemConfigurationSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.SYSTEM_CONFIGURATION_WRITE,
    invalidates: [InvalidationTags.SYSTEM_CONFIGURATION, InvalidationTags.AI],
  };

  constructor(
    private readonly removeUseCase: RemoveSystemConfigurationUseCase,
    private readonly sysConfig: SystemConfigurationService,
  ) {}

  async execute(input: DeleteSystemConfigurationInput, ctx: AiToolContext) {
    // Só o `labelKey` é lido daqui — `findOne` devolve o valor DESCRIPTOGRAFADO.
    const { labelKey } = await this.sysConfig.findOne(input.id);
    const owner = typedConfigOwner(labelKey);
    if (owner)
      throw new BadRequestException(typedConfigRefusal(labelKey, owner));

    return this.removeUseCase.execute(ctx.userId, input.id);
  }
}
