import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { UpdateUserUseCase } from '../use-cases/update-user.use-case';
import { UpdateUserSchema } from '../dto/update-user.dto';

// role fica de fora: reatribuir role via chat é risco de escalação de privilégio
const UpdateUserToolSchema = z
  .object({ id: z.string().uuid() })
  .extend(UpdateUserSchema.omit({ role: true }).shape);
type UpdateUserInput = z.infer<typeof UpdateUserToolSchema>;

@AiToolDef()
@Injectable()
export class UpdateUserTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_user',
    description:
      'Atualiza nome e/ou status de um usuário pelo id. Não permite alterar o role (use uma ação administrativa dedicada para isso).',
    inputSchema: UpdateUserToolSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.USERS_WRITE,
    invalidates: [InvalidationTags.USER],
  };

  constructor(private readonly updateUserUseCase: UpdateUserUseCase) {}

  execute(input: UpdateUserInput, _ctx: AiToolContext) {
    const { id, ...dto } = input;
    return this.updateUserUseCase.execute(id, dto);
  }
}
