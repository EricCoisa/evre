import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { GetSystemRolesUseCase } from '../use-cases/get-system-roles.use-case';

@AiToolDef()
@Injectable()
export class ListRolesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_roles',
    description: 'Lista os papéis (roles) de usuário disponíveis no sistema.',
    inputSchema: z.object({}),
    invalidates: [],
  };

  constructor(private readonly getSystemRolesUseCase: GetSystemRolesUseCase) {}

  execute(_input: unknown, _ctx: AiToolContext) {
    return this.getSystemRolesUseCase.execute();
  }
}
