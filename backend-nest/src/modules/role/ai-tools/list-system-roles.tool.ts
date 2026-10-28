import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindSystemRolesUseCase } from '../use-cases/find-system-roles.use-case';

@AiToolDef()
@Injectable()
export class ListSystemRolesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_system_roles',
    description: 'Lista todos os roles cadastrados no sistema.',
    inputSchema: z.object({}),
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly findSystemRoles: FindSystemRolesUseCase) {}

  execute(_input: unknown, _ctx: AiToolContext) {
    return this.findSystemRoles.execute();
  }
}
