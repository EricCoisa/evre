import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import {
  toAuthenticatedUser,
  type IAiTool,
  type AiToolDefinition,
  type AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { CreateCompanyUseCase } from '../use-cases/create.use-case';
import { CreateCompanySchema } from '../dto/create-company.dto';

type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;

@AiToolDef()
@Injectable()
export class CreateCompanyTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_company',
    description:
      'Cadastra uma nova empresa (cliente). Só o nome é obrigatório.',
    inputSchema: CreateCompanySchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.COMPANY_WRITE,
    invalidates: [InvalidationTags.COMPANY],
  };

  constructor(private readonly createCompany: CreateCompanyUseCase) {}

  execute(input: CreateCompanyInput, ctx: AiToolContext) {
    return this.createCompany.execute(input, toAuthenticatedUser(ctx));
  }
}
