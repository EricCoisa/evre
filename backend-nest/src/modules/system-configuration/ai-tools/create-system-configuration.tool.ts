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
import { CreateSystemConfigurationUseCase } from '../use-cases/create.use-case';
import { CreateSystemConfigurationSchema } from '../dto/create-system-configuration.dto';
import { maskSecretValue } from 'src/common/utils/mask-secret-value.util';
import {
  typedConfigOwner,
  typedConfigRefusal,
} from 'src/domain/system-configuration/typed-config-keys.const';

type CreateSystemConfigurationInput = z.infer<
  typeof CreateSystemConfigurationSchema
>;

@AiToolDef()
@Injectable()
export class CreateSystemConfigurationTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_system_configuration',
    description:
      'Cria uma nova configuração do sistema. As labelKeys existentes são fixas e lidas por código ' +
      'hardcoded (ex: SYSTEM_EMAIL_PROVIDER_API_KEY) — criar uma labelKey inventada não altera nenhum ' +
      'comportamento real, só gera um registro órfão. Antes de usar esta tool, use list_system_configuration ' +
      '(sem search, ou com limit alto) ou get_system_configuration_by_key para confirmar se a configuração já ' +
      'existe; se existir, use update_system_configuration em vez de criar uma nova. Só crie uma labelKey nova ' +
      'se tiver certeza de que nenhuma configuração equivalente já existe. Pode afetar comportamento global da ' +
      'aplicação — use com cautela. Chaves de storage, email e captcha são recusadas aqui: use save_storage_config, save_email_config ou save_captcha_config, que validam contra o provider real.',
    inputSchema: CreateSystemConfigurationSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.SYSTEM_CONFIGURATION_WRITE,
    invalidates: [InvalidationTags.SYSTEM_CONFIGURATION, InvalidationTags.AI],
  };

  constructor(
    private readonly createUseCase: CreateSystemConfigurationUseCase,
  ) {}

  async execute(input: CreateSystemConfigurationInput, ctx: AiToolContext) {
    const owner = typedConfigOwner(input.labelKey);
    if (owner) {
      throw new BadRequestException(typedConfigRefusal(input.labelKey, owner));
    }

    const result = await this.createUseCase.execute(input, ctx.userId);
    return maskSecretValue(result, 'value');
  }
}
