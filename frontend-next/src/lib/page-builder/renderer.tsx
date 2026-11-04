'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Pencil } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { AsyncBoundary } from '@/components/async-boundary';
import { useTranslation } from '@/hooks/use-translation';
import { useFeatureFlag } from '@/lib/actions/feature-flag/queries';
import { useSystemPageLayouts } from '@/lib/actions/pageBuilder/queries';
import {
  useResetUserConfiguration,
  useUserConfiguration,
} from '@/lib/actions/userConfiguration/queries';
import { Collector, errorStatus } from '@/lib/api/collector';
import {
  BLOCK_META,
  canAcceptChildrenType,
  isAutoHeightBlockType,
  isInlineBlockType,
} from './blocks.meta';
import { filterClassName } from './class-names';
import { getDataSource } from './data-sources';
import { LAYOUT_PROFILES, type LayoutProfileName } from './profiles';
import { ProposalTermsProvider, type ProposalTerms } from './proposal-terms-context';
import {
  BlockChrome,
  EmptySlotDropZone,
  SortableList,
} from './editor/block-chrome';
import { useEditor, type EditorContextValue } from './editor/context';
import { EMPTY_LAYOUT } from './editor/mutations';
import { buildVariableOptions } from './editor/panel';
import type { RichTextVariableOption } from '@/components/rich-text-input';
import {
  compactEmptyRows,
  findEmptyGridSlots,
  resolveGridLayout,
  type EmptyGridSlot,
  type PlacedBlock,
} from './grid-engine';
import { BLOCK_REGISTRY, isKnownBlock } from './registry';
import type { SourceData } from './types';
import {
  COL_START_CLASS,
  PAGE_LAYOUTS_KEY,
  SPAN_CLASS,
  normalizeSpan,
  resolvePageLayout,
  type PageBlock,
  GRID_COLS,
  type PageLayout,
} from './schema';

/** Import dinâmico: quebra o ciclo com o editor e mantém o dnd-kit fora do bundle de quem só visualiza. */
const PageEditor = dynamic(() => import('./editor/editor'), { ssr: false });

function getEmptySlots(
  editor: EditorContextValue | null,
  placedList: ReturnType<typeof resolveGridLayout>,
): EmptyGridSlot[] {
  if (!editor || typeof editor.moveToGrid !== 'function') return [];
  return findEmptyGridSlots(placedList, GRID_COLS, !!editor.draggingId);
}

/** RolesGuard/ScopeGuard do backend respondem 403 quando o role não alcança o endpoint. */
const FORBIDDEN = 403;

/** `PageRenderer` é a superfície de dashboard: layout em config, fonte filtrada por role. */
const PAGE_RENDERER_PROFILE: LayoutProfileName = 'dashboard';

interface PageRendererProps {
  pageKey: string;
  /** A página em código. É para onde tudo cai quando algo não está de pé. */
  fallback: React.ReactNode;
}

/** Renderiza o layout da página seguindo a precedência usuário → sistema → página em código. */
export function PageRenderer(props: PageRendererProps) {
  return (
    <AsyncBoundary fallback={<LoadingSkeleton className="h-64 w-full" />}>
      <PageRendererContent {...props} />
    </AsyncBoundary>
  );
}

/** Renderiza um layout JÁ resolvido. Não busca config, não depende de sessão nem de
 * `AsyncBoundary` externo — é o que a página pública monta a partir de um layout publicado.
 * `proposalTerms` monta o envelope comercial que o bloco `investment` lê por contexto; sem ele
 * (ex: profile `dashboard`) nenhum provider é montado. */
export function LayoutBody({
  layout,
  profile,
  proposalTerms,
}: {
  layout: PageLayout;
  profile: LayoutProfileName;
  proposalTerms?: ProposalTerms;
}) {
  const allowed = new Set<string>(LAYOUT_PROFILES[profile].blocks);
  // Bloco fora do profile é descartado como `type` desconhecido: a escrita já o recusa,
  // inclusive nos `children`, então aqui basta a folha de topo.
  const grid = <BlockGrid blocks={layout.blocks.filter((b) => allowed.has(b.type))} />;
  return proposalTerms ? (
    <ProposalTermsProvider terms={proposalTerms}>{grid}</ProposalTermsProvider>
  ) : (
    grid
  );
}

function PageContentBody({
  result,
  fallback,
  profile,
  t,
}: {
  result: ReturnType<typeof resolvePageLayout>;
  fallback: React.ReactNode;
  profile: LayoutProfileName;
  t: (key: string) => string;
}) {
  return (
    <>
      {result.status === 'invalid' && (
        <Alert variant="destructive">
          <AlertTitle>{t('invalidLayout')}</AlertTitle>
          <AlertDescription>{t('invalidLayoutDescription')}</AlertDescription>
        </Alert>
      )}
      {result.status === 'ok' ? (
        <LayoutBody layout={result.layout} profile={profile} />
      ) : (
        fallback
      )}
    </>
  );
}

function PageRendererContent({ pageKey, fallback }: PageRendererProps) {
  const { t } = useTranslation('page-builder');
  const canEdit = useFeatureFlag('PAGE_BUILDER');
  const { data: config } = useUserConfiguration<unknown>(PAGE_LAYOUTS_KEY);
  const { data: system } = useSystemPageLayouts();
  const reset = useResetUserConfiguration();
  const [editing, setEditing] = React.useState(false);

  const result = resolvePageLayout(config?.value, system?.layouts, pageKey);

  if (editing) {
    return (
      <PageEditor
        pageKey={pageKey}
        profile={PAGE_RENDERER_PROFILE}
        initial={result.status === 'ok' ? result.layout : EMPTY_LAYOUT}
        onExit={() => setEditing(false)}
      />
    );
  }

  const handleReset = config?.id && result.origin === 'user'
    ? () => reset.mutate(config.id)
    : undefined;

  return (
    <div className="space-y-4">
      <PageContentBody
        result={result}
        fallback={fallback}
        profile={PAGE_RENDERER_PROFILE}
        t={t}
      />
      <PageActions
        onEdit={canEdit ? () => setEditing(true) : undefined}
        onReset={handleReset}
        resetting={reset.isPending}
      />
    </div>
  );
}

/** Barra de ações da página: entrar no editor e restaurar o padrão. */
function PageActions({
  onEdit,
  onReset,
  resetting,
}: {
  onEdit?: () => void;
  onReset?: () => void;
  resetting: boolean;
}) {
  const { t } = useTranslation('page-builder');
  if (!onEdit && !onReset) return null;

  return (
    <div className="hidden justify-end gap-2 md:flex">
      {onEdit ? (
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" />
          {t('editor.edit')}
        </Button>
      ) : null}
      {onReset ? (
        <Button variant="ghost" size="sm" onClick={onReset} disabled={resetting}>
          {t('restoreDefault')}
        </Button>
      ) : null}
    </div>
  );
}

/** O grid 2D de blocos de uma página; o editor renderiza exatamente este componente. */
export function BlockGrid({ blocks }: { blocks: PageLayout['blocks'] }) {
  const editor = useEditor();
  const validBlocks = blocks.filter((b) => isKnownBlock(b.type));
  const placedList = compactEmptyRows(resolveGridLayout(validBlocks));
  const placedById = new Map(
    placedList.map((p) => [p.block.id, p]),
  );
  const emptySlots = getEmptySlots(editor, placedList);

  return (
    <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-12 lg:auto-rows-[minmax(44px,auto)] items-stretch">
      {blocks.map((block) => (
        <Block
          key={block.id}
          block={block}
          placed={placedById.get(block.id)}
        />
      ))}
      {emptySlots.map((slot) => (
        <EmptySlotDropZone key={`slot-${slot.x}-${slot.y}`} slot={slot} />
      ))}
    </div>
  );
}

function useBlockPagination(sourceName?: string, params?: Record<string, unknown>) {
  const paginationKey = JSON.stringify([sourceName, params ?? {}]);
  const initialPage = getPageParam(params);
  const [pagination, setPagination] = React.useState({ key: paginationKey, page: initialPage });
  const page = pagination.key === paginationKey ? pagination.page : initialPage;
  if (pagination.key !== paginationKey) {
    setPagination({ key: paginationKey, page: initialPage });
  }
  return { paginationKey, page, setPagination };
}

function BlockBody({
  Component,
  block,
  query,
  meta,
  bare,
  paginatesTable,
  paginationKey,
  setPagination,
  editing,
  variables,
}: {
  Component: (typeof BLOCK_REGISTRY)[keyof typeof BLOCK_REGISTRY];
  block: PageBlock;
  query: { data?: SourceData; isPlaceholderData: boolean };
  meta: (typeof BLOCK_META)[keyof typeof BLOCK_META];
  bare?: boolean;
  paginatesTable: boolean;
  paginationKey: string;
  setPagination: (v: { key: string; page: number }) => void;
  editing: boolean;
  variables?: RichTextVariableOption[];
}) {
  const editor = useEditor();
  const onPropChange = editor
    ? (name: string, value: unknown) => editor.setProp(block.id, name, value)
    : undefined;

  return (
    <Component
      props={block.props ?? {}}
      data={query.data}
      bare={bare}
      className={filterClassName(block.className)}
      isLoading={paginatesTable && query.isPlaceholderData}
      onPageChange={
        paginatesTable
          ? (nextPage: number) => setPagination({ key: paginationKey, page: nextPage })
          : undefined
      }
      blockId={block.id}
      onPropChange={onPropChange}
      editing={editing}
      variables={variables}
    >
      <BlockChildren block={block} meta={meta} editing={editing} />
    </Component>
  );
}

/** Dado colado (profile `inline-only`) sobrescreve o resultado da query — literal do próprio
 * layout, congelado, caminho síncrono: sem loading nem erro de rede, o dado já está ali. */
function withInlineOverride<T extends { query: { data?: SourceData } }>(
  inline: unknown,
  result: T,
): T {
  if (inline === undefined) return result;
  return { ...result, query: { ...result.query, data: inline as SourceData }, paginatesTable: false };
}

function useBlockQuery(block: PageBlock) {
  const { source: sourceKey, params, inline } = block.data ?? {};
  const source = sourceKey ? getDataSource(sourceKey) : undefined;
  const { paginationKey, page, setPagination } = useBlockPagination(sourceKey, params);

  const paginatesTable = block.type === 'table.basic' && source?.kind === 'list';
  const sourceParams = paginatesTable ? { ...params, page } : params;
  // `source`/`inline` são mutuamente exclusivos (ver schema.ts): com `inline`, `source` já é
  // `undefined` e `enabled` abaixo já nasce `false` — a query nunca dispara fetch nenhum.
  const query = useQuery({
    queryKey: ['page-builder-source', sourceKey, sourceParams],
    queryFn: Collector<[], SourceData>(() => source!.fetcher(sourceParams), {
      silentStatuses: [FORBIDDEN],
    }),
    enabled: !!source,
    placeholderData: paginatesTable ? (previousData) => previousData : undefined,
  });

  return withInlineOverride(inline, {
    source,
    query,
    paginatesTable,
    paginationKey,
    setPagination,
  });
}

function BlockContent({
  block,
  meta,
  Component,
  source,
  query,
  bare,
  paginatesTable,
  paginationKey,
  setPagination,
  editing,
  variables,
  t,
}: {
  block: PageBlock;
  meta: (typeof BLOCK_META)[keyof typeof BLOCK_META];
  Component: (typeof BLOCK_REGISTRY)[keyof typeof BLOCK_REGISTRY];
  source?: ReturnType<typeof getDataSource>;
  query: ReturnType<typeof useBlockQuery>['query'];
  bare?: boolean;
  paginatesTable: boolean;
  paginationKey: string;
  setPagination: (v: { key: string; page: number }) => void;
  editing: boolean;
  variables?: RichTextVariableOption[];
  t: (k: string) => string;
}) {
  const forbidden = errorStatus(query.error) === FORBIDDEN;
  const isOptionalSource = 'optionalSource' in meta && !!meta.optionalSource;
  const hasInline = block.data?.inline !== undefined;
  const issue = blockIssue({
    missingSource:
      meta.accepts.length > 0 &&
      !isOptionalSource &&
      !source &&
      !hasInline,
    failed: query.isError,
    forbidden,
  });

  if (issue) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t(issue)}</AlertDescription>
      </Alert>
    );
  }

  if (query.isLoading) {
    return <LoadingSkeleton className="h-40 w-full" />;
  }

  return (
    <BlockBody
      Component={Component}
      block={block}
      query={query}
      meta={meta}
      bare={bare}
      paginatesTable={paginatesTable}
      paginationKey={paginationKey}
      setPagination={setPagination}
      editing={editing}
      variables={variables}
    />
  );
}

function Block({
  block,
  placed,
  bare,
  freeFlow,
}: {
  block: PageBlock;
  placed?: PlacedBlock;
  bare?: boolean;
  /** Quando `true`, o filho está num fluxo flex livre (ex: dentro de um Gráfico ou Card) sem células de grade 12-colunas. */
  freeFlow?: boolean;
}) {
  const { t } = useTranslation('page-builder');
  const editor = useEditor();
  const { source, query, paginatesTable, paginationKey, setPagination } = useBlockQuery(block);
  const variables = React.useMemo(() => (source ? buildVariableOptions(source) : undefined), [source]);

  if (!isKnownBlock(block.type)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[page-builder] bloco desconhecido ignorado: ${block.type}`);
    }
    return null;
  }

  const forbidden = errorStatus(query.error) === FORBIDDEN;
  if (!editor && forbidden) return null;

  const meta = BLOCK_META[block.type];
  const Component = BLOCK_REGISTRY[block.type];
  const isInline = isInlineBlockType(block.type);
  const effectiveSpan = placed?.span ?? normalizeSpan(block.span);

  let gridClass: string;
  let gridStyle: React.CSSProperties | undefined;
  if (freeFlow) {
    // Em fluxo livre (dentro de Gráfico, Card ou Tabela),
    // elementos com span === 12 ocupam a linha toda (`w-full`) ou `w-auto` quando menores.
    gridClass = effectiveSpan >= GRID_COLS ? 'w-full' : 'w-auto';
  } else {
    const colSpan = SPAN_CLASS[effectiveSpan] ?? 'lg:col-span-12';
    const colStart = placed ? COL_START_CLASS[placed.x] : undefined;
    const isAutoHeight = isAutoHeightBlockType(block.type);
    const alignSelf = isAutoHeight ? 'h-auto self-start' : 'h-full';
    gridClass = [colStart, colSpan, placed ? 'pb-grid-row' : undefined, alignSelf]
      .filter(Boolean)
      .join(' ');

    if (placed) {
      gridStyle = {
        '--row-start': placed.y + 1,
        '--row-span': placed.rowSpan,
      } as React.CSSProperties;
    }
  }

  const content = (
    <BlockBoundary label={t('blockUnavailable')}>
      <BlockContent
        block={block}
        meta={meta}
        Component={Component}
        source={source}
        query={query}
        bare={bare || isInline}
        paginatesTable={paginatesTable}
        paginationKey={paginationKey}
        setPagination={setPagination}
        editing={!!editor}
        variables={variables}
        t={t}
      />
    </BlockBoundary>
  );

  return editor ? (
    <BlockChrome block={block} spanClass={gridClass} style={gridStyle} nested={bare}>
      {content}
    </BlockChrome>
  ) : (
    <div className={gridClass} style={gridStyle}>{content}</div>
  );
}

function getPageParam(params?: Record<string, unknown>): number {
  const page = Number(params?.page);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Retorna a chave i18n do motivo pelo qual o bloco não pode mostrar dado, ou null. */
function blockIssue({
  missingSource,
  failed,
  forbidden,
}: {
  missingSource: boolean;
  failed: boolean;
  forbidden: boolean;
}): 'blockWithoutSource' | 'blockForbidden' | 'blockDataError' | null {
  if (missingSource) return 'blockWithoutSource';
  if (!failed) return null;
  return forbidden ? 'blockForbidden' : 'blockDataError';
}

/** Renderiza os filhos de um bloco container ou os micro-elementos anexados a um bloco de dados. */
function BlockChildren({
  block,
  meta,
  editing,
}: {
  block: PageBlock;
  meta: (typeof BLOCK_META)[keyof typeof BLOCK_META];
  editing: boolean;
}) {
  const editor = useEditor();
  const isFullContainer = 'container' in meta && !!meta.container;
  const canHaveChildren = canAcceptChildrenType(block.type);
  if (!canHaveChildren) return null;

  const children = block.children ?? [];
  if (!isFullContainer && children.length === 0) return null;

  const validChildren = children.filter((c) => isKnownBlock(c.type));

  // Para blocos que não são `group` (ex: Gráficos, Cards, Tabelas), os filhos são micro-elementos
  // (`text.rich`, `button.action`) renderizados em fluxo livre (`freeFlow`), sem grade pesada!
  if (!isFullContainer) {
    const renderedFree = (
      <>
        {children.map((child) => (
          <Block
            key={child.id}
            block={child}
            bare
            freeFlow
          />
        ))}
      </>
    );
    if (!editing) return renderedFree;
    return <SortableList ids={children.map((c) => c.id)}>{renderedFree}</SortableList>;
  }

  const parentSpan = normalizeSpan(block.span);
  const mappedValidChildren = validChildren.map((c) => ({
    ...c,
    span: normalizeSpan(
      Math.max(1, Math.round((parentSpan * normalizeSpan(c.span)) / GRID_COLS)),
    ),
  }));
  const placedChildren = compactEmptyRows(resolveGridLayout(mappedValidChildren));
  const placedById = new Map(
    placedChildren.map((p, idx) => [validChildren[idx].id, { ...p, block: validChildren[idx] }]),
  );
  const placedList = [...placedById.values()];
  const emptySlots = getEmptySlots(editor, placedList);

  const rendered = (
    <>
      {children.map((child) => (
        <Block
          key={child.id}
          block={child}
          placed={placedById.get(child.id)}
          bare
        />
      ))}
      {emptySlots.map((slot) => (
        <EmptySlotDropZone
          key={`slot-${block.id}-${slot.x}-${slot.y}`}
          slot={slot}
          parentId={block.id}
        />
      ))}
    </>
  );

  if (!editing) return rendered;
  return <SortableList ids={children.map((c) => c.id)}>{rendered}</SortableList>;
}

/** Isola o estouro em um bloco para que ele não derrube a página inteira. */
class BlockBoundary extends React.Component<
  { children: React.ReactNode; label: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[page-builder] bloco quebrou:', error);
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <Alert variant="destructive">
          <AlertDescription>{this.props.label}</AlertDescription>
        </Alert>
      );
    }
    return <>{this.props.children}</>;
  }
}
