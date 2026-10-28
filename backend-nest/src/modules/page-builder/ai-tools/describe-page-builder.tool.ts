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
import {
  DEFAULT_LAYOUT_PROFILE,
  LAYOUT_PROFILES,
  type LayoutProfileName,
} from '../dto/page-layout.dto';

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
      'campo ou de param inventado vira coluna vazia ou erro de validação na tela. ' +
      'O catálogo depende do `profile` da superfície que você vai montar: cada profile ' +
      'oferece blocos e classNames diferentes, e alguns não buscam dado de fonte nenhuma. ' +
      'Passe o MESMO profile em set_page_layout.',
    inputSchema: z.object({
      profile: z
        .enum(
          Object.keys(LAYOUT_PROFILES) as [
            LayoutProfileName,
            ...LayoutProfileName[],
          ],
        )
        .optional()
        .describe(
          `Superfície a montar. Ausente vale "${DEFAULT_LAYOUT_PROFILE}".`,
        ),
    }),
    // sem roles: qualquer autenticado pode customizar a própria tela; as fontes já vêm
    // filtradas pelo role em listForRole()
    invalidates: [],
  };

  constructor(
    private readonly pageSources: PageSourceRegistry,
    private readonly bridge: PageBuilderBridgeService,
  ) {}

  async execute(input: { profile?: LayoutProfileName }, ctx: AiToolContext) {
    const profile = input?.profile ?? DEFAULT_LAYOUT_PROFILE;
    const schema = await this.bridge.describeSchema(profile);
    const noSources = LAYOUT_PROFILES[profile].dataSources === 'none';
    return {
      profile,
      blocks: schema.blocks,
      pages: schema.pages,
      spans: schema.spans,
      classNames: schema.classNames,
      maxBlocks: LAYOUT_PROFILES[profile].maxBlocks,
      maxChildren: LAYOUT_PROFILES[profile].maxChildren,
      // Profile sem fonte recusa `data.source` em qualquer bloco: oferecer a lista mentiria.
      sources: noSources
        ? []
        : this.pageSources.listForRole(ctx.roleName).map((s) => ({
            key: s.key,
            kind: s.kind,
            description: s.description,
            fields: s.fields ?? [],
            params: s.params ?? [],
          })),
    };
  }
}
