import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindOneSystemConfigurationUseCase } from '../use-cases/find-one.use-case';
import { maskSecretValue } from 'src/common/utils/mask-secret-value.util';

const GetSystemConfigurationSchema = z.object({ id: z.string().uuid() });
type GetSystemConfigurationInput = z.infer<typeof GetSystemConfigurationSchema>;

@AiToolDef()
@Injectable()
export class GetSystemConfigurationTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_system_configuration',
    description:
      'Busca uma configuração do sistema pelo id. Valor mascarado se for secreto.',
    inputSchema: GetSystemConfigurationSchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(
    private readonly findOneUseCase: FindOneSystemConfigurationUseCase,
  ) {}

  async execute(input: GetSystemConfigurationInput, _ctx: AiToolContext) {
    const result = await this.findOneUseCase.execute(input.id);
    return maskSecretValue(result, 'value');
  }
}
