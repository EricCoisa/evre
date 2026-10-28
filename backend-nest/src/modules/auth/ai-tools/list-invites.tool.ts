import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { GetInvitesUseCase } from '../use-cases/get-invites.use-case';

@AiToolDef()
@Injectable()
export class ListInvitesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_invites',
    description: 'Lista os convites pendentes/emitidos do sistema.',
    inputSchema: z.object({}),
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly getInvites: GetInvitesUseCase) {}

  execute(_input: unknown, _ctx: AiToolContext) {
    return this.getInvites.execute();
  }
}
