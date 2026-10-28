import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { GetUserConfigurationByKeyUseCase } from '../use-cases/get-by-key.use-case';

const GetMyConfigurationByKeySchema = z.object({ labelKey: z.string().min(1) });
type GetMyConfigurationByKeyInput = z.infer<
  typeof GetMyConfigurationByKeySchema
>;

@AiToolDef()
@Injectable()
export class GetMyConfigurationByKeyTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_my_configuration_by_key',
    description:
      'Busca o valor de uma configuração específica do usuário logado pela labelKey.',
    inputSchema: GetMyConfigurationByKeySchema,
    invalidates: [],
  };

  constructor(private readonly getByKey: GetUserConfigurationByKeyUseCase) {}

  execute(input: GetMyConfigurationByKeyInput, ctx: AiToolContext) {
    return this.getByKey.execute(ctx.userId, input.labelKey, {
      roleName: ctx.roleName,
    });
  }
}
