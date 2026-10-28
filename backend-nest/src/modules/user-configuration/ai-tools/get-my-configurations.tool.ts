import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { GetUserConfigurationsUseCase } from '../use-cases/get-user-configurations.use-case';

@AiToolDef()
@Injectable()
export class GetMyConfigurationsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_my_configurations',
    description:
      'Lista as configurações personalizadas do usuário logado (mescla definições com valores customizados).',
    inputSchema: z.object({}),
    invalidates: [],
  };

  constructor(
    private readonly getUserConfigurations: GetUserConfigurationsUseCase,
  ) {}

  execute(_input: unknown, ctx: AiToolContext) {
    return this.getUserConfigurations.execute(ctx.userId);
  }
}
