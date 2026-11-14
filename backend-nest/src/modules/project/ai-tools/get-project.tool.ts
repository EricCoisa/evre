import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { FindOneProjectUseCase } from '../use-cases/find-one.use-case';

const GetProjectSchema = z.object({ id: z.string().uuid() }).strict();
type GetProjectInput = z.infer<typeof GetProjectSchema>;

@AiToolDef()
@Injectable()
export class GetProjectTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_project',
    description: 'Busca um projeto pelo id.',
    inputSchema: GetProjectSchema,
    invalidates: [],
  };

  constructor(private readonly findOneProject: FindOneProjectUseCase) {}

  execute(input: GetProjectInput, ctx: AiToolContext) {
    return this.findOneProject.execute(input.id, toAuthenticatedUser(ctx));
  }
}
