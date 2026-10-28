import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { PageSourceRegistry } from '../page-source-registry.service';
import { PageBuilderBridgeService } from '../page-builder-bridge.service';
import { MAX_BLOCKS } from '../dto/page-layout.dto';

@AiToolDef()
@Injectable()
export class DescribePageBuilderTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'describe_page_builder',
    description:
      'Lista o que existe HOJE para montar uma página customizada: os blocos disponíveis ' +
      '(com as props que cada um aceita e os tipos de fonte que consomem), as fontes de dados ' +
      'que este usuário pode consumir — cada uma com os `fields` que devolve e os `params` que ' +
      'aceita —, as páginas customizáveis, os valores válidos de span e a lista `classNames` de ' +
      'classes Tailwind aceitas em `className` (nenhuma outra classe existe no CSS da aplicação, ' +
      'então inventar uma não tem efeito visual). Sempre chame esta tool ' +
      'antes de set_page_layout e use apenas os `type`, `source`, `fields`, `params` e `pageKey` ' +
      'retornados aqui: o catálogo muda conforme blocos e endpoints são adicionados, e nome de ' +
      'campo ou de param inventado vira coluna vazia ou erro de validação na tela.',
    inputSchema: z.object({}),
    // sem roles: qualquer autenticado pode customizar a própria tela; as fontes já vêm
    // filtradas pelo role em listForRole()
    invalidates: [],
  };

  constructor(
    private readonly pageSources: PageSourceRegistry,
    private readonly bridge: PageBuilderBridgeService,
  ) {}

  async execute(_input: unknown, ctx: AiToolContext) {
    const schema = await this.bridge.describeSchema();
    return {
      blocks: schema.blocks,
      pages: schema.pages,
      spans: schema.spans,
      classNames: schema.classNames,
      maxBlocks: MAX_BLOCKS,
      sources: this.pageSources.listForRole(ctx.roleName).map((s) => ({
        key: s.key,
        kind: s.kind,
        description: s.description,
        fields: s.fields ?? [],
        params: s.params ?? [],
      })),
    };
  }
}
