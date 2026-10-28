'use client';

import React from 'react';
import Link from 'next/link';
import { innerAlignClass } from './class-names';

import { Info } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/use-translation';
import { parseWhatsAppFormat, type FormattedPart } from '@/lib/messaging/format-whatsapp-text';
import { linkify } from '@/lib/messaging/linkify';
import { BLOCK_META, type BlockType } from './blocks.meta';
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
}

/** Mapa de componentes dos blocos do page builder, amarrado a BLOCK_META. */
export const BLOCK_REGISTRY: Record<BlockType, (p: BlockProps) => React.ReactNode> = {
  group: Group,
  'chart.area': AreaChartBlock,
  'chart.bar': BarChartBlock,
  'chart.line': LineChartBlock,
  'alert.banner': AlertBanner,
  'text.rich': RichTextBlock,
  'button.action': ButtonActionBlock,
  'list.feed': ListFeed,
  'table.basic': BasicTable,
};

export function isKnownBlock(type: string): type is BlockType {
  return type in BLOCK_META;
}

/** Casca única de todo bloco; em `bare` (dentro de um group) dispensa Card e padding lateral. */
function Panel({
  bare,
  className,
  header,
  children,
}: {
  bare?: boolean;
  className?: string;
  header?: React.ReactNode;
  children?: React.ReactNode;
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
    <Card className={cn('h-full', className)}>
      {header ? <CardHeader className={cn('w-full', inner)}>{header}</CardHeader> : null}
      {children ? <CardContent className={cn('w-full flex-1 min-h-0 flex flex-col justify-center', inner)}>{children}</CardContent> : null}
    </Card>
  );
}

function Group({ props, bare, className, children }: BlockProps) {
  return (
    <Panel
      bare={bare}
      className={className}
      header={
        props.title ? (
          <CardTitle>
            <FormattedRichText text={str(props.title)} inline />
          </CardTitle>
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-12 lg:auto-rows-[44px] items-stretch">{children}</div>
    </Panel>
  );
}

const chartConfig = {
  value: { label: 'Total', color: 'var(--primary)' },
} satisfies ChartConfig;

function AreaChartBlock({ props, data, bare, className, children }: BlockProps) {
  const points = (data as SeriesResponse | undefined)?.data ?? [];
  return (
    <Panel
      bare={bare}
      className={className}
      header={
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>
                <FormattedRichText text={str(props.title)} inline />
              </CardTitle>
              {props.description ? (
                <CardDescription className="mt-1">
                  <FormattedRichText text={str(props.description)} inline />
                </CardDescription>
              ) : null}
            </div>
            {children ? (
              <div className="flex flex-wrap items-center gap-2">{children}</div>
            ) : null}
          </div>
        </>
      }
    >
      <ChartContainer config={chartConfig} className="aspect-auto h-full min-h-[120px] w-full flex-1">
        <AreaChart data={points}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <Area
            dataKey="value"
            type="natural"
            fill="var(--color-value)"
            fillOpacity={0.3}
            stroke="var(--color-value)"
          />
        </AreaChart>
      </ChartContainer>
    </Panel>
  );
}

function BarChartBlock({ props, data, bare, className, children }: BlockProps) {
  const points = (data as SeriesResponse | undefined)?.data ?? [];
  return (
    <Panel
      bare={bare}
      className={className}
      header={
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>
                <FormattedRichText text={str(props.title)} inline />
              </CardTitle>
              {props.description ? (
                <CardDescription className="mt-1">
                  <FormattedRichText text={str(props.description)} inline />
                </CardDescription>
              ) : null}
            </div>
            {children ? (
              <div className="flex flex-wrap items-center gap-2">{children}</div>
            ) : null}
          </div>
        </>
      }
    >
      <ChartContainer config={chartConfig} className="aspect-auto h-full min-h-[120px] w-full flex-1">
        <BarChart data={points}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={4} />
        </BarChart>
      </ChartContainer>
    </Panel>
  );
}

function LineChartBlock({ props, data, bare, className, children }: BlockProps) {
  const points = (data as SeriesResponse | undefined)?.data ?? [];
  return (
    <Panel
      bare={bare}
      className={className}
      header={
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>
                <FormattedRichText text={str(props.title)} inline />
              </CardTitle>
              {props.description ? (
                <CardDescription className="mt-1">
                  <FormattedRichText text={str(props.description)} inline />
                </CardDescription>
              ) : null}
            </div>
            {children ? (
              <div className="flex flex-wrap items-center gap-2">{children}</div>
            ) : null}
          </div>
        </>
      }
    >
      <ChartContainer config={chartConfig} className="aspect-auto h-full min-h-[120px] w-full flex-1">
        <LineChart data={points}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <Line
            dataKey="value"
            type="natural"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </Panel>
  );
}

function AlertBanner({ props, bare, className, children }: BlockProps) {
  return (
    <Panel
      bare={bare}
      className={cn('border-primary/20 bg-primary/5', className)}
      header={
        <div className="flex items-center gap-2">
          <Info className="size-4 shrink-0 text-primary" />
          <CardTitle className="text-base">
            <FormattedRichText text={str(props.title)} inline />
          </CardTitle>
        </div>
      }
    >
      <div className="space-y-2">
        <FormattedRichText text={str(props.content)} />
        {children ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">{children}</div>
        ) : null}
      </div>
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

function RichTextBlock({ props, data, className, children }: BlockProps) {
  const rawContent = str(props.content);
  const content = interpolateVariables(rawContent, data);
  const inner = innerAlignClass(className);

  return (
    <div className={cn('flex h-full w-full flex-col justify-center gap-1', inner, className)}>
      {content ? <FormattedRichText text={content} /> : null}
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

function ButtonActionBlock({ props, className, children }: BlockProps) {
  const url = safeHref(props.url);
  const label = str(props.label);
  const inner = innerAlignClass(className);

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
    <div className={cn('flex h-full w-full flex-col justify-center gap-1', inner, className)}>
      {buttonNode}
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

/** Renderiza o texto com a mesma formatação e quebras de linha do RichTextInput. */
function FormattedRichText({ text, inline }: { text: string; inline?: boolean }) {
  if (!text) return null;
  const parts = parseWhatsAppFormat(text);

  if (inline) {
    return (
      <span className="whitespace-pre-wrap break-words">
        {parts.map((part, index) => renderPart(part, index))}
      </span>
    );
  }

  return (
    <div className="text-muted-foreground whitespace-pre-wrap break-words text-sm leading-relaxed">
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
  const columns = tableColumns(props.columns);
  const primary = columns[0];
  const secondary = columns[1];
  const rows = (data as ListResponse | undefined)?.data ?? [];

  return (
    <Panel
      bare={bare}
      className={className}
      header={tableHeaderWithChildren(props.title, children)}
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
}: BlockProps) {
  const columns = tableColumns(props.columns);
  const { data: rows = [], meta } = (data as ListResponse | undefined) ?? {};
  const { limit: skeletonRows = 5, page = 1, totalPages = 1 } = meta ?? {};
  return (
    <Panel
      bare={bare}
      className={className}
      header={tableHeaderWithChildren(props.title, children)}
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

function tableColumns(value: unknown): string[] {
  return Array.isArray(value) ? value.map(str) : [];
}

function tableHeaderWithChildren(
  value: unknown,
  children?: React.ReactNode,
): React.ReactNode {
  if (!value && !children) return undefined;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {value ? (
        <CardTitle>
          <FormattedRichText text={str(value)} inline />
        </CardTitle>
      ) : null}
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
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
