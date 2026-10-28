import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { maskSecretValue } from 'src/common/utils/mask-secret-value.util';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindUserConfigDefinitionByLabelKeyUseCase } from '../use-cases/find-by-label-key.use-case';

const GetByLabelKeySchema = z.object({ labelKey: z.string().min(1) });
type GetByLabelKeyInput = z.infer<typeof GetByLabelKeySchema>;

@AiToolDef()
@Injectable()
export class GetUserConfigurationDefinitionByKeyTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_user_configuration_definition_by_key',
    description:
      'Busca uma definição de configuração de usuário pela labelKey.',
    inputSchema: GetByLabelKeySchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(
    private readonly findByLabelKeyUseCase: FindUserConfigDefinitionByLabelKeyUseCase,
  ) {}

  async execute(input: GetByLabelKeyInput, _ctx: AiToolContext) {
    return maskSecretValue(
      await this.findByLabelKeyUseCase.execute(input.labelKey),
      'defaultValue',
    );
  }
}
