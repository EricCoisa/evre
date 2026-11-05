import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { FindOneCompanyUseCase } from '../use-cases/find-one.use-case';

const GetCompanySchema = z.object({ id: z.string().uuid() }).strict();
type GetCompanyInput = z.infer<typeof GetCompanySchema>;

@AiToolDef()
@Injectable()
export class GetCompanyTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_company',
    description: 'Busca uma empresa pelo id.',
    inputSchema: GetCompanySchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly findOneCompany: FindOneCompanyUseCase) {}

  execute(input: GetCompanyInput, ctx: AiToolContext) {
    return this.findOneCompany.execute(input.id, toAuthenticatedUser(ctx));
  }
}
