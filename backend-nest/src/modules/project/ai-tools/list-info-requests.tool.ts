import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { ListInfoRequestsUseCase } from '../use-cases/list-info-requests.use-case';

const ListInfoRequestsSchema = z
  .object({ projectId: z.string().uuid() })
  .strict();
type ListInfoRequestsInput = z.infer<typeof ListInfoRequestsSchema>;

@AiToolDef()
@Injectable()
export class ListInfoRequestsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_info_requests',
    description:
      'Lista os pedidos de informação feitos ao cliente em um projeto, com status (pendente/respondido/cancelado). Nunca retorna o valor respondido, que é sensível.',
    inputSchema: ListInfoRequestsSchema,
    invalidates: [],
  };

  constructor(private readonly listInfoRequests: ListInfoRequestsUseCase) {}

  execute(input: ListInfoRequestsInput, ctx: AiToolContext) {
    return this.listInfoRequests.execute(
      input.projectId,
      toAuthenticatedUser(ctx),
    );
  }
}
