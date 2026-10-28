import { BadRequestException, Injectable } from '@nestjs/common';
import { PageSourceRegistry } from './page-source-registry.service';
import {
  PageBuilderBridgeService,
  type PageBlockDescription,
} from './page-builder-bridge.service';
import type {
  PageSourceEntry,
  PageSourceParam,
} from 'src/domain/page-builder/page-source.types';
import {
  DEFAULT_LAYOUT_PROFILE,
  LAYOUT_PROFILES,
  type LayoutProfile,
  type LayoutProfileName,
  type PageBlock,
  type PageLayout,
  type SetPageLayoutInput,
} from './dto/page-layout.dto';

/** Valida semanticamente um layout de página contra o catálogo real de blocos e fontes. */
@Injectable()
export class PageLayoutValidator {
  constructor(
    private readonly pageSources: PageSourceRegistry,
    private readonly bridge: PageBuilderBridgeService,
  ) {}

  async assertWritable(
    roleName: string,
    input: SetPageLayoutInput,
  ): Promise<void> {
    const profileName = input.profile ?? DEFAULT_LAYOUT_PROFILE;
    const profile = LAYOUT_PROFILES[profileName];

    this.assertSourcesAllowed(roleName, input.layout, profile);
    assertWithinLimits(input.layout, profileName, profile);
    await this.assertBlocksRenderable(input, profileName, profile);
  }

  /** Recusa layout que grava mas não renderiza: tipo de bloco, fonte, kind ou pageKey inexistentes. */
  private async assertBlocksRenderable(
    input: SetPageLayoutInput,
    profileName: LayoutProfileName,
    profile: LayoutProfile,
  ): Promise<void> {
    // Blocos e classNames já vêm filtrados pelo profile: o que o catálogo não oferece, o
    // validador recusa, e com isso a allowlist do profile vale também para os `children`.
    const catalog = await this.bridge.describeSchema(profileName);

    // Layout de `storage: 'record'` mora em registro próprio, não num pageKey de tela.
    if (profile.storage === 'config') {
      const pages = catalog.pages.map((p) => p.pageKey);
      if (!pages.includes(input.pageKey)) {
        throw new BadRequestException(
          `pageKey "${input.pageKey}" não é customizável. Disponíveis: ${pages.join(', ')}.`,
        );
      }
    }

    const byType = new Map(catalog.blocks.map((b) => [b.type, b]));
    const classNames = new Set(catalog.classNames);
    const problems: string[] = [];

    for (const block of input.layout.blocks) {
      problems.push(...this.blockProblems(block, byType));
      problems.push(...classNameProblems(block, classNames));

      for (const child of block.children ?? []) {
        const childMeta = byType.get(child.type);
        // Filho container quebraria a regra de um nível só — o renderer não desce mais fundo.
        if (childMeta?.container) {
          problems.push(
            `bloco "${child.id}": "${child.type}" é um container e não pode ficar dentro de outro (aninhamento é de um nível só)`,
          );
          continue;
        }
        // Em blocos que não são container geral (ex: gráficos, cards), só entram micro-elementos inline (texto, botão).
        const parentMeta = byType.get(block.type);
        if (
          parentMeta &&
          !parentMeta.container &&
          childMeta &&
          !isInlineMeta(childMeta)
        ) {
          problems.push(
            `bloco "${block.id}" (${block.type}): não é um container e não aceita "children" do tipo "${child.type}"`,
          );
          continue;
        }
        problems.push(...this.blockProblems(child, byType));
        problems.push(...classNameProblems(child, classNames));
      }
    }

    if (problems.length) {
      throw new BadRequestException(
        `Layout não renderizável — ${problems.join('; ')}. Chame describe_page_builder e corrija.`,
      );
    }
  }

  /** Checagens que valem para um bloco isolado — as mesmas no topo e dentro de um container. */
  private blockProblems(
    block: PageBlock,
    byType: Map<string, PageBlockDescription>,
  ): string[] {
    const meta = byType.get(block.type);
    if (!meta) {
      return [
        `bloco "${block.id}": type "${block.type}" não existe (use um de: ${[...byType.keys()].join(', ')})`,
      ];
    }

    if (meta.container) {
      return block.children?.length
        ? []
        : [
            `bloco "${block.id}" (${block.type}): é um container e precisa de pelo menos um item em "children"`,
          ];
    }
    if (meta.accepts.length === 0) return [];

    if (!block.data?.source) {
      if (meta.optionalSource || block.type === 'text.rich') {
        return [];
      }
      return [
        `bloco "${block.id}" (${block.type}): precisa de data.source de um destes kinds: ${meta.accepts.join(', ')}`,
      ];
    }

    const problems: string[] = [];
    const source = this.pageSources.get(block.data.source);
    if (source && !meta.accepts.includes(source.kind)) {
      problems.push(
        `bloco "${block.id}" (${block.type}): a fonte "${block.data.source}" é do kind "${source.kind}", mas o bloco aceita ${meta.accepts.join(', ')}`,
      );
    }
    if (source) {
      problems.push(
        ...paramProblems(
          block.id,
          block.data.source,
          source,
          block.data.params,
        ),
      );
    }
    return problems;
  }

  /** Recusa fonte de dados inexistente ou fora do alcance do role de quem pediu. */
  private assertSourcesAllowed(
    roleName: string,
    layout: PageLayout,
    profile: LayoutProfile,
  ): void {
    // Inclui os filhos: um bloco dentro de um container busca dado igual a qualquer outro,
    // então deixá-los de fora abriria um caminho para fonte fora do alcance do role.
    const all = layout.blocks.flatMap((b) => [b, ...(b.children ?? [])]);

    // `dataSources: 'none'` é o que torna o render anônimo seguro: nenhum bloco desta
    // superfície chama endpoint, então não existe dado para vazar a quem abrir a página.
    if (profile.dataSources === 'none') {
      const withSource = all.filter((b) => b.data?.source).map((b) => b.id);
      if (withSource.length) {
        throw new BadRequestException(
          `Esta página não busca dado de nenhuma fonte: remova "data.source" do(s) bloco(s) ${withSource.join(', ')}. ` +
            'O conteúdo precisa vir em `props`.',
        );
      }
      return;
    }

    const allowed = new Set(
      this.pageSources.listForRole(roleName).map((s) => s.key),
    );
    const invalid = all
      .map((b) => b.data?.source)
      .filter((source): source is string => !!source && !allowed.has(source));

    if (invalid.length) {
      throw new BadRequestException(
        `Fonte(s) de dados indisponível(is) para este usuário: ${[...new Set(invalid)].join(', ')}. ` +
          'Chame describe_page_builder e use apenas as fontes listadas lá.',
      );
    }
  }
}

/** Recusa layout acima do teto do profile — o Zod aceita até o teto do profile mais largo. */
function assertWithinLimits(
  layout: PageLayout,
  profileName: LayoutProfileName,
  profile: LayoutProfile,
): void {
  if (layout.blocks.length > profile.maxBlocks) {
    throw new BadRequestException(
      `Layout com ${layout.blocks.length} blocos excede o teto de ${profile.maxBlocks} do profile "${profileName}".`,
    );
  }
  const tooMany = layout.blocks.find(
    (b) => (b.children?.length ?? 0) > profile.maxChildren,
  );
  if (tooMany) {
    throw new BadRequestException(
      `bloco "${tooMany.id}" excede o teto de ${profile.maxChildren} filhos do profile "${profileName}".`,
    );
  }
}

/** Recusa `className` fora da allowlist que o frontend publica. */
function classNameProblems(block: PageBlock, allowed: Set<string>): string[] {
  if (!block.className) return [];
  const invalid = block.className
    .split(/\s+/)
    .filter((token) => token && !allowed.has(token));

  return invalid.length
    ? [
        `bloco "${block.id}": className "${invalid.join(', ')}" não está na lista suportada — só valem as classes retornadas em classNames por describe_page_builder`,
      ]
    : [];
}

/** Valida os params de um bloco contra os params declarados pela fonte de dados. */
function paramProblems(
  blockId: string,
  sourceKey: string,
  source: PageSourceEntry,
  params: Record<string, unknown> | undefined,
): string[] {
  if (!params) return [];
  const declared = new Map((source.params ?? []).map((p) => [p.name, p]));
  const problems: string[] = [];

  for (const [name, value] of Object.entries(params)) {
    const spec = declared.get(name);
    if (!spec) {
      problems.push(
        `bloco "${blockId}": a fonte "${sourceKey}" não aceita o param "${name}" (aceita: ${[...declared.keys()].join(', ') || 'nenhum'})`,
      );
      continue;
    }
    if (!matchesType(value, spec.type)) {
      problems.push(
        `bloco "${blockId}": param "${name}" espera ${spec.type} (${spec.description}), recebeu ${JSON.stringify(value)}`,
      );
    }
  }
  return problems;
}

/** O JSON pode trazer número como string ("10"); "3-7" não passa em nenhuma das duas formas. */
function matchesType(value: unknown, type: PageSourceParam['type']): boolean {
  if (type === 'number') {
    if (typeof value === 'number') return Number.isFinite(value);
    return (
      typeof value === 'string' &&
      value.trim() !== '' &&
      Number.isFinite(Number(value))
    );
  }
  if (type === 'boolean') {
    return typeof value === 'boolean' || value === 'true' || value === 'false';
  }
  return typeof value === 'string';
}

/** Mapa `pageKey → PageLayout` da config; aceita objeto (usuário) ou string crua (sistema). */
export function asLayoutMap(value: unknown): Record<string, PageLayout> {
  const parsed = typeof value === 'string' ? tryParse(value) : value;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? { ...(parsed as Record<string, PageLayout>) }
    : {};
}

function isInlineMeta(meta: PageBlockDescription): boolean {
  return (
    !!meta.inline || meta.type === 'text.rich' || meta.type === 'button.action'
  );
}

function tryParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
