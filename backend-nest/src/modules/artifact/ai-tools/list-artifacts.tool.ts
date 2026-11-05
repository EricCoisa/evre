import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { ListArtifactsUseCase } from '../use-cases/list-artifacts.use-case';
import {
  PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';

@AiToolDef()
@Injectable()
export class ListArtifactsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_artifacts',
    description:
      'Lista os artefatos (arquivo ou pasta de arquivos) ativos, com paginação e busca por nome do arquivo.',
    inputSchema: PaginationQuerySchema,
    roles: ['ADMIN', 'MODERATOR'],
    invalidates: [],
  };

  constructor(private readonly listArtifacts: ListArtifactsUseCase) {}

  execute(input: PaginationQuery, _ctx: AiToolContext) {
    return this.listArtifacts.execute(input);
  }
}
