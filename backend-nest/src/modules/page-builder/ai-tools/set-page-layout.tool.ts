import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { SetPageLayoutUseCase } from '../use-cases/set-page-layout.use-case';
import {
  SetPageLayoutSchema,
  type SetPageLayoutInput,
} from '../dto/page-layout.dto';

@AiToolDef()
@Injectable()
export class SetPageLayoutTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'set_page_layout',
    description:
      'Grava o layout de UMA página do usuário logado. Chame describe_page_builder antes e use ' +
      'apenas os `type` de bloco, `source` de dados e `pageKey` listados lá. Todo bloco cujo ' +
      '`accepts` não é vazio PRECISA de `data.source` de um kind compatível — bloco sem fonte ' +
      'não mostra dado nenhum e é recusado. Bloco com `container: true` é o contrário: agrupa ' +
      'outros blocos num mesmo card via `children`, não tem fonte própria, e o aninhamento é ' +
      'de UM nível (filho não pode ter filhos). Envie sempre a lista completa de blocos da ' +
      'página — ela substitui a anterior; as outras páginas não são afetadas. ' +
      '`span` é um token de grid de 1 a 4 (4 = largura total): três gráficos na vertical = três ' +
      'blocos com span 4. `className` aceita SOMENTE classes da lista `classNames` devolvida por ' +
      'describe_page_builder — qualquer outra classe Tailwind não existe no CSS da aplicação e ' +
      'seria ignorada, então é recusada aqui. Nunca envie CSS inline nem cor fora dessa lista.',
    inputSchema: SetPageLayoutSchema,
    // sem roles: self-service, espelha POST /user-configuration/me
    approvalScope: McpScopes.USER_CONFIGURATION_WRITE,
    invalidates: [InvalidationTags.USER_CONFIGURATION],
  };

  constructor(private readonly setPageLayout: SetPageLayoutUseCase) {}

  execute(input: SetPageLayoutInput, ctx: AiToolContext) {
    return this.setPageLayout.execute(ctx.userId, ctx.roleName, input);
  }
}
