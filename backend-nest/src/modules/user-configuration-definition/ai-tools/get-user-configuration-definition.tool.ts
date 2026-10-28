import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { maskSecretValue } from 'src/common/utils/mask-secret-value.util';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindOneUserConfigDefinitionUseCase } from '../use-cases/find-one.use-case';

const GetDefinitionSchema = z.object({ id: z.string().uuid() });
type GetDefinitionInput = z.infer<typeof GetDefinitionSchema>;

@AiToolDef()
@Injectable()
export class GetUserConfigurationDefinitionTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_user_configuration_definition',
    description: 'Busca uma definição de configuração de usuário pelo id.',
    inputSchema: GetDefinitionSchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(
    private readonly findOneUseCase: FindOneUserConfigDefinitionUseCase,
  ) {}

  async execute(input: GetDefinitionInput, _ctx: AiToolContext) {
    return maskSecretValue(
      await this.findOneUseCase.execute(input.id),
      'defaultValue',
    );
  }
}
