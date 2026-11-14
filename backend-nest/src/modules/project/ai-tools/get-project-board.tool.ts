import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { GetBoardUseCase } from '../use-cases/get-board.use-case';

const GetProjectBoardSchema = z
  .object({ projectId: z.string().uuid() })
  .strict();
type GetProjectBoardInput = z.infer<typeof GetProjectBoardSchema>;

@AiToolDef()
@Injectable()
export class GetProjectBoardTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_project_board',
    description:
      'Retorna o board (quadro Kanban) de um projeto: milestones ordenadas com as respectivas tasks.',
    inputSchema: GetProjectBoardSchema,
    invalidates: [],
  };

  constructor(private readonly getBoard: GetBoardUseCase) {}

  execute(input: GetProjectBoardInput, ctx: AiToolContext) {
    return this.getBoard.execute(input.projectId, toAuthenticatedUser(ctx));
  }
}
