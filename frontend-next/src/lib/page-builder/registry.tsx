'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { InlineRichText } from './editor/inline-rich-text';
import type { RichTextVariableOption } from '@/components/rich-text-input';
import { innerAlignClass } from './class-names';
import { useProposalTerms } from './proposal-terms-context';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import Modal from '@/components/modal';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/use-translation';
import { parseWhatsAppFormat, type FormattedPart } from '@/lib/messaging/format-whatsapp-text';
import { linkify } from '@/lib/messaging/linkify';
import {
  BLOCK_META,
  normalizeTextPreset,
  TEXT_PRESET_CONFIG,
  type BlockType,
  type TextPreset,
  type TextPresetConfig,
  type TextFontSizeClass,
  applyPresetToContent,
} from './blocks.meta';
export { normalizeTextPreset, TEXT_PRESET_CONFIG, type TextPreset, type TextPresetConfig, type TextFontSizeClass, applyPresetToContent };
import type { ListResponse, SeriesResponse, SourceData } from './types';

export interface BlockProps {
  props: Record<string, unknown>;
  data?: SourceData;
  /** Bloco está dentro de um `group`: renderiza sem a casca de Card, senão vira card aninhado. */
  bare?: boolean;
  /** Classes já filtradas pela allowlist — ver `class-names.ts`. */
  className?: string;
  /** Filhos já renderizados — só blocos container usam. */
  children?: React.ReactNode;
  /** Solicita a página seguinte/anterior para a fonte paginada do bloco. */
  onPageChange?: (page: number) => void;
  /** Mantém a tabela montada e mostra skeleton nas linhas enquanto troca de página. */
  isLoading?: boolean;
  blockId?: string;
  onPropChange?: (name: string, value: unknown) => void;
  editing?: boolean;
  variables?: RichTextVariableOption[];
}

/** Mapa de componentes dos blocos do page builder, amarrado a BLOCK_META. */
export const BLOCK_REGISTRY: Record<BlockType, (p: BlockProps) => React.ReactNode> = {
  group: Group,
  'chart.area': (p) => <ChartBlock {...p} kind="chart.area" />,
  'chart.bar': (p) => <ChartBlock {...p} kind="chart.bar" />,
  'chart.line': (p) => <ChartBlock {...p} kind="chart.line" />,
  'text.rich': RichTextBlock,
  'button.action': ButtonActionBlock,
  'list.feed': ListFeed,
  'table.basic': BasicTable,
  topic: TopicBlock,
  image: ImageBlock,
  investment: InvestmentBlock,
  iframe: IframeBlock,
  divider: DividerBlock,
  price: PriceBlock,
};

export function isKnownBlock(type: string): type is BlockType {
  return type in BLOCK_META;
}

/** Monta o par `{ blockId, onPropChange }` que liga um bloco à edição inline, ou `undefined`
 * fora do modo de edição — repetido por quase todo bloco com título/conteúdo editável. */
function editMetaFor(
  editing: boolean | undefined,
  blockId: string | undefined,
  onPropChange: ((name: string, value: unknown) => void) | undefined,
): { blockId: string; onPropChange: (name: string, value: unknown) => void } | undefined {
  return editing && blockId && onPropChange ? { blockId, onPropChange } : undefined;
}

/** Casca única de todo bloco; em `bare` (dentro de um group) dispensa Card e padding lateral. */
function Panel({
  bare,
  className,
  header,
  children,
  editing,
}: {
  bare?: boolean;
  className?: string;
  header?: React.ReactNode;
  children?: React.ReactNode;
  editing?: boolean;
}) {
  // `cn` por último: o className do layout vence o default do bloco quando conflita
  // (ex.: `p-0` sobre o padding do Card), que é o ponto de deixar o usuário customizar.
  const inner = innerAlignClass(className);
  if (bare) {
    return (
      <div className={cn('flex h-full flex-col gap-4', className)}>
        {header ? <div className={cn('grid w-full auto-rows-min gap-2', inner)}>{header}</div> : null}
        {children ? <div className={cn('w-full', inner)}>{children}</div> : null}
      </div>
    );
  }
  return (
    <Card className={cn('h-full flex flex-col', editing ? 'overflow-visible' : 'overflow-hidden', className)}>
      {header ? <CardHeader className={cn('w-full shrink-0', inner)}>{header}</CardHeader> : null}
      <CardContent className={cn('w-full flex-1 min-h-0 flex flex-col justify-start', editing ? 'overflow-visible' : 'overflow-y-auto', inner)}>{children}</CardContent>
    </Card>
  );
}

/** Renderiza o cabeçalho universal de Card (`title`, `description` e controles/children). */
function renderBlockHeader(
  title?: unknown,
  description?: unknown,
  children?: React.ReactNode,
  editMeta?: {
    blockId: string;
    onPropChange: (name: string, value: unknown) => void;
  },
): React.ReactNode {
  const hasTitle = Boolean(title);
  const hasDescription = Boolean(description);
  const hasChildren = Boolean(children);

  if (!hasTitle && !hasDescription && !hasChildren && !editMeta) return undefined;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {hasTitle || hasDescription || editMeta ? (
        <div className="flex-1 min-w-0">
          {hasTitle || editMeta ? (
            <CardTitle>
              {editMeta ? (
                <InlineRichText
                  blockId={editMeta.blockId}
                  propName="title"
                  value={str(title)}
                  onChange={(val) => editMeta.onPropChange('title', val)}
                  placeholder="Título..."
                  showFontSize={false}
                  singleLine
                  className="font-semibold text-lg"
                />
              ) : (
                <FormattedRichText text={str(title)} inline />
              )}
            </CardTitle>
          ) : null}
          {hasDescription || (editMeta && description !== undefined) ? (
            <CardDescription className={hasTitle || editMeta ? 'mt-1' : undefined}>
              {editMeta ? (
                <InlineRichText
                  blockId={editMeta.blockId}
                  propName="description"
                  value={str(description)}
                  onChange={(val) => editMeta.onPropChange('description', val)}
                  placeholder="Descrição..."
                  showFontSize={false}
                  singleLine
                />
              ) : (
                <FormattedRichText text={str(description)} inline />
              )}
            </CardDescription>
          ) : null}
        </div>
      ) : null}
      {hasChildren ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

function Group({ props, bare, className, children, blockId, onPropChange, editing }: BlockProps) {
  const editMeta = editMetaFor(editing, blockId, onPropChange);
  return (
    <Panel
      bare={bare}
      className={className}
      header={renderBlockHeader(props.title, props.description, undefined, editMeta)}
      editing={editing}
    >
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-12 lg:auto-rows-[minmax(44px,auto)] items-stretch">{children}</div>
    </Panel>
  );
}

const chartConfig = {
  value: { label: 'Total', color: 'var(--primary)' },
} satisfies ChartConfig;

type ChartKind = 'chart.area' | 'chart.bar' | 'chart.line';

/** Eixo/grid/tooltip são idênticos nos três tipos de gráfico — só a série (`Area`/`Bar`/`Line`)
 * e o componente recharts que a hospeda mudam. */
function ChartBlock({
  kind,
  props,
  data,
  bare,
  className,
  children,
  blockId,
  onPropChange,
  editing,
}: BlockProps & { kind: ChartKind }) {
  const points = (data as SeriesResponse | undefined)?.data ?? [];
  const editMeta = editMetaFor(editing, blockId, onPropChange);
  const axis = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
      <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
    </>
  );

  return (
    <Panel
      bare={bare}
      className={className}
      header={renderBlockHeader(props.title, props.description, children, editMeta)}
    >
      <ChartContainer config={chartConfig} className="aspect-auto h-full min-h-[120px] w-full flex-1">
        {kind === 'chart.area' ? (
          <AreaChart data={points}>
            {axis}
            <Area
              dataKey="value"
              type="natural"
              fill="var(--color-value)"
              fillOpacity={0.3}
              stroke="var(--color-value)"
            />
          </AreaChart>
        ) : kind === 'chart.bar' ? (
          <BarChart data={points}>
            {axis}
            <Bar dataKey="value" fill="var(--color-value)" radius={4} />
          </BarChart>
        ) : (
          <LineChart data={points}>
            {axis}
            <Line dataKey="value" type="natural" stroke="var(--color-value)" strokeWidth={2} dot={false} />
          </LineChart>
        )}
      </ChartContainer>
    </Panel>
  );
}

function TopicBlock({ props, bare, className, children, blockId, onPropChange, editing }: BlockProps) {
  const items = toStringArray(props.items);
  const editMeta = editMetaFor(editing, blockId, onPropChange);
  return (
    <Panel
      bare={bare}
      className={className}
      header={renderBlockHeader(props.title, props.description, children, editMeta)}
    >
      <div className="space-y-2">
        {items.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : null}
        {children ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">{children}</div>
        ) : null}
      </div>
    </Panel>
  );
}

function ImageBlock({ props, bare, className }: BlockProps) {
  // Mesma whitelist de esquema que os links do RichText: nunca javascript:/data:.
  const url = safeHref(props.url);
  const alt = str(props.alt);
  const caption = str(props.caption);

  return (
    <Panel bare={bare} className={className}>
      <figure className="space-y-2">
        {url ? (
          <Image
            src={url}
            alt={alt}
            width={1600}
            height={900}
            // ponytail: URL de imagem é arbitrária (anexo do autor da proposta), não um asset
            // interno — unoptimized pula a checagem de `images.remotePatterns` do next.config.
            unoptimized
            className="aspect-video w-full rounded-lg object-cover"
          />
        ) : (
          <div className="aspect-video w-full rounded-lg bg-muted" />
        )}
        {caption ? (
          <figcaption className="text-center text-sm text-muted-foreground">
            {caption}
          </figcaption>
        ) : null}
      </figure>
    </Panel>
  );
}



const DIVIDER_SPACING_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'my-2',
  md: 'my-4',
  lg: 'my-8',
};

function normalizeDividerSpacing(value: unknown): 'sm' | 'md' | 'lg' {
  return value === 'sm' || value === 'lg' ? value : 'md';
}

/** Linha divisória horizontal; nunca usa Panel/Card. */
function DividerBlock({ props, className }: BlockProps) {
  const spacing = normalizeDividerSpacing(props.spacing);
  return <hr className={cn(DIVIDER_SPACING_CLASS[spacing], className)} />;
}

/** Centavos + moeda do envelope → string formatada; nunca dividir por 100 e concatenar símbolo. */
function formatCents(cents: number | null, currency: string): string {
  if (typeof cents !== 'number') return '—';
  try {
    // ponytail: locale fixo pt-BR — trocar por locale derivado da currency/idioma de exibição
    // quando a proposta precisar de outro idioma.
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return '—';
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR').format(date);
}

function InvestmentBlock({ props, bare, className, blockId, onPropChange, editing }: BlockProps) {
  const { t } = useTranslation('page-builder');
  const terms = useProposalTerms();
  const editMeta = editMetaFor(editing, blockId, onPropChange);

  if (!terms) {
    return (
      <Panel bare={bare} className={className}>
        <p className="text-sm text-muted-foreground">{t('investmentEmpty')}</p>
      </Panel>
    );
  }

  const showOptional = props.showOptional === true;

  return (
    <Panel
      bare={bare}
      className={className}
      header={
        props.title || editMeta ? (
          <CardTitle>
            {editMeta ? (
              <InlineRichText
                blockId={editMeta.blockId}
                propName="title"
                value={str(props.title)}
                onChange={(val) => editMeta.onPropChange('title', val)}
                placeholder="Título do investimento..."
                showFontSize={false}
                singleLine
                className="font-semibold text-lg"
              />
            ) : (
              <FormattedRichText text={str(props.title)} inline />
            )}
          </CardTitle>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-3xl font-bold text-foreground">
            {formatCents(terms.totalCents, terms.currency)}
          </p>
          <p className="text-sm text-muted-foreground">
            {t(`investmentRecurrence.${terms.recurrence}`)}
          </p>
        </div>
        {terms.termDays != null || terms.validUntil ? (
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {terms.termDays != null ? (
              <span>
                {t('investmentTerm')}: {terms.termDays} {t('investmentDays')}
              </span>
            ) : null}
            {terms.validUntil ? (
              <span>
                {t('investmentValidUntil')} {formatDate(terms.validUntil)}
              </span>
            ) : null}
          </div>
        ) : null}
        {terms.includedItems.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-foreground">{t('investmentIncluded')}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {terms.includedItems.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {showOptional && terms.optionalItems.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-foreground">{t('investmentOptional')}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {terms.optionalItems.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/** "Rótulo|12000" → { label, cents }; sem "|" ou valor não numérico, `cents` vira `null` (mostra "—"). */
// ponytail: separador "|" é conveniência de digitação manual — estruturar como campo aninhado
// quando a proposta passar a importar linhas de uma planilha.
function parsePriceRow(raw: string): { label: string; cents: number | null } {
  const sep = raw.indexOf('|');
  if (sep === -1) return { label: raw.trim(), cents: null };
  const value = Number(raw.slice(sep + 1).trim());
  return { label: raw.slice(0, sep).trim(), cents: Number.isFinite(value) ? value : null };
}

function resolveCurrency(value: unknown): string {
  return typeof value === 'string' && value ? value : 'BRL';
}

/** Tabela de valores livre (apresentação, não registro): `rows` linha a linha e um total opcional
 * em destaque. `highlight` dá moldura de card recomendado. */
function PriceBlock({ props, bare, className, children, blockId, onPropChange, editing }: BlockProps) {
  const { t } = useTranslation('page-builder');
  const rows = toStringArray(props.rows).map(parsePriceRow);
  const currency = resolveCurrency(props.currency);
  const hasTotal = typeof props.totalCents === 'number';
  const highlight = props.highlight === true;
  const editMeta = editMetaFor(editing, blockId, onPropChange);

  return (
    <Panel
      bare={bare}
      className={cn(highlight ? 'border-primary border-2' : undefined, className)}
      header={renderBlockHeader(props.title, props.description, children, editMeta)}
    >
      <div className="space-y-3">
        {rows.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {rows.map((row, index) => (
              <li key={index} className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium text-foreground">{formatCents(row.cents, currency)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {hasTotal ? (
          <div className="flex items-baseline justify-between gap-4 border-t pt-3">
            <span className="font-semibold text-foreground">
              {str(props.totalLabel) || t('priceTotalDefault')}
            </span>
            <span className="text-2xl font-bold text-foreground">
              {formatCents(props.totalCents as number, currency)}
            </span>
          </div>
        ) : null}
        {props.recurrence ? (
          <p className="text-sm text-muted-foreground">
            {t(`investmentRecurrence.${str(props.recurrence)}`, { defaultValue: str(props.recurrence) })}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

/** Liberado nos dois estados (preview e modal) — SEM `allow-same-origin`, sempre. O artefato é
 * HTML de terceiro (protótipo do Claude, apresentação); com `allow-same-origin` ele alcançaria
 * sessão e cookie da aplicação através do mesmo iframe que executa o script dele. */
const ARTIFACT_SANDBOX = 'allow-scripts allow-popups allow-modals allow-forms';

/** Demonstração HTML/imagem em sandbox: preview capturado por uma camada de clique (sem scroll
 * nem interação própria), toque abre modal 98vw×90vh com scroll e interação liberados. */
/** `NEXT_PUBLIC_*` é inlined no bundle do client — mesmo valor de `lib/api/orval-instance.ts`,
 * sem poder importar de lá (módulo `"use server"`, só exporta função async pro client). */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function IframeBlock({ props, bare, className }: BlockProps) {
  const { t } = useTranslation('page-builder');
  const [open, setOpen] = React.useState(false);
  const terms = useProposalTerms();
  const artifactId = typeof props.artifactId === 'string' ? props.artifactId : undefined;
  const title = str(props.title);
  const height = typeof props.height === 'number' ? props.height : 400;
  const aspect = props.aspect === 'video' || props.aspect === 'square' ? props.aspect : undefined;

  const previewStyle: React.CSSProperties = aspect
    ? { aspectRatio: aspect === 'video' ? '16 / 9' : '1 / 1' }
    : { height };

  if (!artifactId) {
    return (
      <Panel bare={bare} className={className}>
        <Alert variant="destructive">
          <AlertDescription>{t('iframeMissingArtifact')}</AlertDescription>
        </Alert>
      </Panel>
    );
  }

  // Publicado: visualização anônima por publicToken. Rascunho/preview: autenticado por id,
  // mesmo guard de roles do resto do admin. Redirect 302 pra presigned URL — iframe segue nativo.
  const url = terms?.published
    ? `${API_BASE_URL}/artifacts/public/${artifactId}`
    : `${API_BASE_URL}/artifacts/${artifactId}/view`;

  return (
    <Panel bare={bare} className={className}>
      <div className="relative w-full overflow-hidden rounded-lg border" style={previewStyle}>
        <iframe
          src={url}
          title={title || 'Artefato'}
          className="h-full w-full border-0"
          sandbox={ARTIFACT_SANDBOX}
          scrolling="no"
          loading="lazy"
        />
        {/* Camada transparente por cima: captura o toque/clique sem deixar o iframe
         * interagir ou rolar sozinho em linha — é isso que resolve o scroll sequestrado
         * no mobile. Interação real só dentro do modal. */}
        <button
          type="button"
          aria-label={t('iframeOpen', { defaultValue: 'Abrir em tela cheia' })}
          className="absolute inset-0 cursor-pointer bg-transparent"
          onClick={() => setOpen(true)}
        />
      </div>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={title || t('iframeModalTitle', { defaultValue: 'Demonstração' })}
        size="full"
        className="!flex !flex-col h-[90vh] max-h-[90vh] w-[98vw] max-w-[98vw]"
      >
        <iframe
          src={url}
          title={title || 'Artefato'}
          className="flex-1 min-h-0 w-full border-0"
          sandbox={ARTIFACT_SANDBOX}
          scrolling="yes"
        />
      </Modal>
    </Panel>
  );
}

/**
 * Substitui variáveis `{{var}}` no texto pelos valores vindos da fonte de dados (`SourceData`):
 * - `{{total}}` / `{{count}}`: total de registros (`meta.total` ou soma/tamanho da série);
 * - `{{value}}` / `{{date}}`: último ponto de uma série temporal (`series`);
 * - `{{campo}}`: valor de `campo` do primeiro registro da lista (`data[0][campo]`).
 */
export function interpolateVariables(text: string, data?: SourceData): string {
  if (!text || !text.includes('{{')) return text;

  return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, rawKey: string) => {
    if (!data) return '—';
    const key = rawKey.trim();
    const listData = data as ListResponse;
    const seriesData = data as SeriesResponse;

    if (key === 'total' || key === 'count' || key === 'meta.total') {
      if (typeof listData.meta?.total === 'number') {
        return String(listData.meta.total);
      }
      if (Array.isArray(seriesData.data) && seriesData.data.length > 0) {
        const last = seriesData.data[seriesData.data.length - 1];
        if (last && typeof last.value === 'number') {
          return String(last.value);
        }
      }
      if (Array.isArray(listData.data)) {
        return String(listData.data.length);
      }
      return '—';
    }

    if (Array.isArray(seriesData.data) && seriesData.data.length > 0) {
      const lastPoint = seriesData.data[seriesData.data.length - 1] as Record<string, unknown>;
      if (lastPoint && key in lastPoint && lastPoint[key] !== undefined && lastPoint[key] !== null) {
        return str(lastPoint[key]);
      }
    }

    if (Array.isArray(listData.data) && listData.data.length > 0) {
      const firstRow = listData.data[0];
      if (firstRow && typeof firstRow === 'object' && key in firstRow) {
        const val = firstRow[key];
        if (val !== undefined && val !== null) return str(val);
      }
    }

    if (listData.meta && key in listData.meta) {
      const metaVal = (listData.meta as Record<string, unknown>)[key];
      if (metaVal !== undefined && metaVal !== null) return str(metaVal);
    }

    return '—';
  });
}

function RichTextBlock({ props, data, className, children, blockId, onPropChange, editing, variables }: BlockProps) {
  const rawContent = str(props.content);
  const content = editing ? rawContent : interpolateVariables(rawContent, data);
  const inner = innerAlignClass(className);
  const preset = normalizeTextPreset(props.preset);
  const presetConfig = TEXT_PRESET_CONFIG[preset];
  const Tag = presetConfig.tag;

  if (editing && blockId && onPropChange) {
    return (
      <div className={cn('flex w-full flex-col justify-start gap-1 min-h-0', inner, className)}>
        <div className={presetConfig.className}>
          <InlineRichText
            blockId={blockId}
            propName="content"
            value={rawContent}
            onChange={(val) => onPropChange('content', val)}
            placeholder="Digite o texto..."
            showFontSize
            variables={variables}
            className={presetConfig.className}
          />
        </div>
        {children ? (
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn('flex w-full flex-col justify-start gap-1 min-h-0', inner, className)}>
      {content ? (
        <Tag className={presetConfig.className}>
          <FormattedRichText
            text={content}
            inline={Tag !== 'div' && Tag !== 'blockquote'}
            className={presetConfig.className}
          />
        </Tag>
      ) : null}
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

function ButtonActionBlock({ props, className, children, blockId, onPropChange, editing }: BlockProps) {
  const url = safeHref(props.url);
  const label = str(props.label);
  const inner = innerAlignClass(className);

  if (editing && blockId && onPropChange) {
    return (
      <div className={cn('flex h-full w-full flex-col justify-start gap-1 overflow-y-auto max-h-full', inner, className)}>
        <div
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground shadow-xs h-full min-h-8 w-full cursor-text px-3 py-1"
        >
          <InlineRichText
            blockId={blockId}
            propName="label"
            value={label || 'Botão'}
            onChange={(val) => onPropChange('label', val)}
            placeholder="Texto do botão..."
            showFontSize={false}
            singleLine
            className="text-center font-medium"
          />
        </div>
        {children ? (
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        ) : null}
      </div>
    );
  }

  const buttonNode = url ? (
    <Button asChild size="sm" className="h-full min-h-8 w-full">
      <Link href={url}>
        <FormattedRichText text={label || 'Botão'} inline />
      </Link>
    </Button>
  ) : (
    <Button type="button" size="sm" className="h-full min-h-8 w-full">
      <FormattedRichText text={label || 'Botão'} inline />
    </Button>
  );

  return (
    <div className={cn('flex h-full w-full flex-col justify-start gap-1 overflow-y-auto max-h-full', inner, className)}>
      {buttonNode}
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

/** Renderiza o texto com a mesma formatação e quebras de linha do RichTextInput. */
function FormattedRichText({
  text,
  inline,
  className,
}: {
  text: string;
  inline?: boolean;
  className?: string;
}) {
  if (!text) return null;
  const parts = parseWhatsAppFormat(text);

  if (inline) {
    return (
      <span className={cn('whitespace-pre-wrap break-words', className)}>
        {parts.map((part, index) => renderPart(part, index))}
      </span>
    );
  }

  return (
    <div className={cn('whitespace-pre-wrap break-words', className ?? 'text-muted-foreground text-sm leading-relaxed')}>
      {parts.map((part, index) => renderPart(part, index))}
    </div>
  );
}

function renderPart(part: FormattedPart, index: number): React.ReactNode {
  switch (part.type) {
    case 'text':
      return renderTextWithLinks(part.text, index);
    case 'bold':
      return (
        <strong key={index} className="font-bold text-foreground">
          {part.parts.map((p, i) => renderPart(p, i))}
        </strong>
      );
    case 'italic':
      return (
        <em key={index} className="italic">
          {part.parts.map((p, i) => renderPart(p, i))}
        </em>
      );
    case 'strikethrough':
      return (
        <s key={index} className="line-through">
          {part.parts.map((p, i) => renderPart(p, i))}
        </s>
      );
    case 'code':
      return (
        <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
          {part.text}
        </code>
      );
    case 'sized':
      return (
        <span key={index} className={part.size}>
          {part.parts.map((p, i) => renderPart(p, i))}
        </span>
      );
  }
}

function renderTextWithLinks(text: string, partIndex: number): React.ReactNode {
  const mdLinkRegex = /\[([^\]]+)\]\(((?:[^()]+|\([^()]*\))*)\)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let linkIdx = 0;

  while ((match = mdLinkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...renderPlainUrlLinks(text.slice(lastIndex, match.index), `${partIndex}-${linkIdx++}`));
    }
    const label = match[1];
    const rawUrl = match[2];
    const url = safeHref(rawUrl);
    const key = `${partIndex}-${linkIdx++}`;

    if (url) {
      const isExternal = url.startsWith('http://') || url.startsWith('https://');
      nodes.push(
        <a
          key={key}
          href={url}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="text-primary font-medium underline underline-offset-4 hover:opacity-80"
        >
          {label}
        </a>,
      );
    } else {
      nodes.push(label);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(...renderPlainUrlLinks(text.slice(lastIndex), `${partIndex}-${linkIdx++}`));
  }

  return nodes;
}

function renderPlainUrlLinks(text: string, keyPrefix: string): React.ReactNode[] {
  return linkify(text).map((part, i) =>
    part.href ? (
      <a
        key={`${keyPrefix}-${i}`}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary font-medium underline underline-offset-4 hover:opacity-80"
      >
        {part.text}
      </a>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part.text}</span>
    ),
  );
}

/** Valida e restringe o href para evitar esquemas perigosos como javascript:. */
function safeHref(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (/^(?:https?:\/\/|\/|#|mailto:)/i.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

function ListFeed({
  props,
  data,
  bare,
  className,
  isLoading,
  children,
}: BlockProps) {
  const { t } = useTranslation('common');
  const columns = toStringArray(props.columns);
  const primary = columns[0];
  const secondary = columns[1];
  const rows = (data as ListResponse | undefined)?.data ?? [];

  return (
    <Panel
      bare={bare}
      className={className}
      header={renderBlockHeader(props.title, props.description, children)}
    >
      <div className="divide-y divide-border" aria-busy={isLoading}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5 py-2.5 first:pt-0 last:pb-0">
              <LoadingSkeleton className="h-4 w-3/4" />
              {secondary ? <LoadingSkeleton className="h-3 w-1/2" /> : null}
            </div>
          ))
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-2 text-xs">{t('noRecords')}</p>
        ) : (
          rows.map((row, index) => (
            <div key={str(row.id) || index} className="py-2.5 first:pt-0 last:pb-0">
              {primary ? (
                <p className="text-sm font-medium leading-tight">{str(row[primary])}</p>
              ) : null}
              {secondary && row[secondary] !== undefined ? (
                <p className="text-muted-foreground mt-1 text-xs">{str(row[secondary])}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function BasicTable({
  props,
  data,
  bare,
  className,
  onPageChange,
  isLoading,
  children,
  blockId,
  onPropChange,
  editing,
}: BlockProps) {
  const columns = toStringArray(props.columns);
  const { data: rows = [], meta } = (data as ListResponse | undefined) ?? {};
  const { limit: skeletonRows = 5, page = 1, totalPages = 1 } = meta ?? {};
  const editMeta = editMetaFor(editing, blockId, onPropChange);
  return (
    <Panel
      bare={bare}
      className={className}
      header={renderBlockHeader(props.title, props.description, children, editMeta)}
    >
      <Table aria-busy={isLoading}>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <BasicTableRows
            columns={columns}
            rows={rows}
            skeletonRows={skeletonRows}
            isLoading={isLoading}
          />
        </TableBody>
      </Table>
      <TablePagination
        meta={meta}
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        isLoading={isLoading}
      />
    </Panel>
  );
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(str) : [];
}

function BasicTableRows({
  columns,
  rows,
  skeletonRows,
  isLoading,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
  skeletonRows: number;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return Array.from({ length: skeletonRows }).map((_, rowIndex) => (
      <TableRow key={rowIndex}>
        {columns.map((col) => (
          <TableCell key={col}>
            <LoadingSkeleton className="h-4 w-full max-w-[200px]" />
          </TableCell>
        ))}
      </TableRow>
    ));
  }
  return rows.map((row, index) => (
    <TableRow key={str(row.id) || index}>
      {columns.map((col) => (
        <TableCell key={col}>{str(row[col])}</TableCell>
      ))}
    </TableRow>
  ));
}

function TablePagination({
  meta,
  page,
  totalPages,
  onPageChange,
  isLoading,
}: {
  meta?: ListResponse['meta'];
  page: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
}) {
  const { t } = useTranslation('common');
  if (!meta || totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-4 border-t pt-4">
      <span className="text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange?.(page - 1)}
          disabled={isLoading || !onPageChange || page <= 1}
        >
          {t('previous')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange?.(page + 1)}
          disabled={isLoading || !onPageChange || page >= totalPages}
        >
          {t('next')}
        </Button>
      </div>
    </div>
  );
}

/** Célula/rótulo vem de JSON: objeto ou null viram string vazia em vez de quebrar o render. */
function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? '' : String(value);
}
