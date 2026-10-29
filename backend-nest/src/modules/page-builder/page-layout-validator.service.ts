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

/** Teto de `data.inline` por bloco e por layout inteiro — vai para o JSON do layout, gravado no
 * registro e servido na página pública; sem teto, uma proposta vira um documento de megabytes. */
const INLINE_MAX_BYTES_PER_BLOCK = 64 * 1024;
const INLINE_MAX_BYTES_PER_LAYOUT = 256 * 1024;

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
      problems.push(...this.blockProblems(block, byType, profile));
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
        problems.push(...this.blockProblems(child, byType, profile));
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
    profile: LayoutProfile,
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

    if (block.data?.inline !== undefined) {
      return inlineProblems(block.id, meta, block.data.inline);
    }

    if (!block.data?.source) {
      if (meta.optionalSource || block.type === 'text.rich') {
        return [];
      }
      const field =
        profile.dataSources === 'inline-only' ? 'data.inline' : 'data.source';
      return [
        `bloco "${block.id}" (${block.type}): precisa de ${field} de um destes kinds: ${meta.accepts.join(', ')}`,
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

  /** Recusa o MECANISMO de dado errado para o profile (fonte real × colado × nenhum). A shape e o
   * tamanho de um `data.inline` aceito aqui são checados por bloco em `blockProblems`. */
  private assertSourcesAllowed(
    roleName: string,
    layout: PageLayout,
    profile: LayoutProfile,
  ): void {
    // Inclui os filhos: um bloco dentro de um container busca dado igual a qualquer outro,
    // então deixá-los de fora abriria um caminho para fonte fora do alcance do role.
    const all = layout.blocks.flatMap((b) => [b, ...(b.children ?? [])]);

    // `dataSources: 'none'` é o que torna o render anônimo seguro: nenhum bloco desta
    // superfície chama endpoint nem lê dado colado — não existe dado nenhum para vazar.
    if (profile.dataSources === 'none') {
      const withData = all
        .filter((b) => b.data?.source || b.data?.inline !== undefined)
        .map((b) => b.id);
      if (withData.length) {
        throw new BadRequestException(
          `Esta página não aceita dado nenhum (nem fonte, nem colado): remova "data" do(s) bloco(s) ${withData.join(', ')}. ` +
            'O conteúdo precisa vir em `props`.',
        );
      }
      return;
    }

    // `inline-only` (ex: proposta) nunca busca fonte real — só dado colado pelo autor, que
    // continua congelado no próprio layout. Checar o alcance do role não faz sentido aqui.
    if (profile.dataSources === 'inline-only') {
      const withSource = all.filter((b) => b.data?.source).map((b) => b.id);
      if (withSource.length) {
        throw new BadRequestException(
          `Esta página não busca fonte de dado interna: remova "data.source" do(s) bloco(s) ${withSource.join(', ')} e cole o dado em "data.inline". ` +
            'Chame describe_page_builder para ver o shape esperado por kind.',
        );
      }
      return;
    }

    // `role-filtered` (ex: dashboard): dado colado aqui seria um número inventado parecendo
    // métrica real — só fonte de verdade, filtrada pelo alcance de quem está gravando.
    const withInline = all
      .filter((b) => b.data?.inline !== undefined)
      .map((b) => b.id);
    if (withInline.length) {
      throw new BadRequestException(
        `Esta página busca dado de fonte real, não aceita dado colado: remova "data.inline" do(s) bloco(s) ${withInline.join(', ')} e use "data.source".`,
      );
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

  const all = layout.blocks.flatMap((b) => [b, ...(b.children ?? [])]);
  const inlineBytes = all.reduce(
    (total, b) =>
      b.data?.inline !== undefined
        ? total + Buffer.byteLength(JSON.stringify(b.data.inline) ?? '', 'utf8')
        : total,
    0,
  );
  if (inlineBytes > INLINE_MAX_BYTES_PER_LAYOUT) {
    throw new BadRequestException(
      `Layout com ${inlineBytes} bytes de dado colado (data.inline) excede o teto de ${INLINE_MAX_BYTES_PER_LAYOUT} bytes por layout.`,
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

/** Valida a shape de `data.inline` contra o `kind` que o bloco aceita (`series` × `list`/`count`,
 * que compartilham o mesmo shape) e o teto de tamanho. */
function inlineProblems(
  blockId: string,
  meta: PageBlockDescription,
  inline: unknown,
): string[] {
  const bytes = Buffer.byteLength(JSON.stringify(inline) ?? '', 'utf8');
  if (bytes > INLINE_MAX_BYTES_PER_BLOCK) {
    return [
      `bloco "${blockId}": data.inline tem ${bytes} bytes, acima do teto de ${INLINE_MAX_BYTES_PER_BLOCK} bytes por bloco`,
    ];
  }

  const wantsSeries = meta.accepts.includes('series');
  const expected = wantsSeries
    ? '{ data: { date: string, value: number }[] }'
    : '{ data: Record<string, unknown>[] }';

  const rawRows = (inline as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(rawRows)) {
    return [
      `bloco "${blockId}" (${meta.type}): data.inline precisa do shape ${expected}, recebeu ${JSON.stringify(inline)}`,
    ];
  }
  // `Array.isArray` é tipado como `(arg: any) => arg is any[]` no lib.es5.d.ts — a reatribuição
  // com anotação explícita evita que esse `any` vaze para `badRow` abaixo.
  const rows: unknown[] = rawRows;

  const badRow = wantsSeries
    ? rows.find(
        (row) =>
          !row ||
          typeof row !== 'object' ||
          typeof (row as Record<string, unknown>).date !== 'string' ||
          typeof (row as Record<string, unknown>).value !== 'number',
      )
    : rows.find((row) => !row || typeof row !== 'object' || Array.isArray(row));

  if (badRow !== undefined) {
    return [
      `bloco "${blockId}" (${meta.type}): data.inline espera ${expected}, mas um item veio fora do formato: ${JSON.stringify(badRow)}`,
    ];
  }
  return [];
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
