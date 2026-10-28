import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { ListApiKeysUseCase } from '../use-cases/list-api-keys.use-case';

@AiToolDef()
@Injectable()
export class ListApiKeysTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_api_keys',
    description:
      'Lista as API keys do usuário logado (metadados apenas, sem o segredo).',
    inputSchema: z.object({}),
    invalidates: [],
  };

  constructor(private readonly listApiKeysUseCase: ListApiKeysUseCase) {}

  execute(_input: unknown, ctx: AiToolContext) {
    return this.listApiKeysUseCase.execute(
      ctx.userId,
      ctx.roleName === 'ADMIN',
    );
  }
}
