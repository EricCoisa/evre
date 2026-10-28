import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindSystemConfigByLabelKeyUseCase } from '../use-cases/find-by-label-key.use-case';
import { maskSecretValue } from 'src/common/utils/mask-secret-value.util';

const GetByLabelKeySchema = z.object({ labelKey: z.string().min(1) });
type GetByLabelKeyInput = z.infer<typeof GetByLabelKeySchema>;

@AiToolDef()
@Injectable()
export class GetSystemConfigurationByKeyTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_system_configuration_by_key',
    description:
      'Busca uma configuração do sistema pela labelKey. Valor mascarado se for secreto.',
    inputSchema: GetByLabelKeySchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(
    private readonly findByLabelKeyUseCase: FindSystemConfigByLabelKeyUseCase,
  ) {}

  async execute(input: GetByLabelKeyInput, _ctx: AiToolContext) {
    const result = await this.findByLabelKeyUseCase.execute(input.labelKey);
    return maskSecretValue(result, 'value');
  }
}
