import { normalizeTextPreset, type TextPreset } from './blocks.meta';
import { GRID_COLS, normalizeRowSpan, normalizeSpan, type BlockRowSpan, type PageBlock } from './schema';

/** Heurísticas de altura por tipo de bloco: convertem conteúdo/props (texto, itens, linhas) em `rowSpan` estimado. */

const GRID_ROW_TOLERANCE_PX = 48;
const GRID_ROW_STEP_PX = 60;

interface PresetMetric {
  charsPer12Col: number;
  minChars: number;
  lineHeightPx: number;
  extraPaddingPx: number;
}

const PRESET_METRICS: Record<TextPreset, PresetMetric> = {
  heading1: {
    // text-4xl (36px font, font-bold, leading ~42px)
    charsPer12Col: 54,
    minChars: 10,
    lineHeightPx: 42,
    extraPaddingPx: 8,
  },
  heading2: {
    // text-2xl (24px font, font-semibold, leading ~32px)
    charsPer12Col: 80,
    minChars: 14,
    lineHeightPx: 32,
    extraPaddingPx: 6,
  },
  heading3: {
    // text-xl (20px font, font-semibold, leading ~28px)
    charsPer12Col: 96,
    minChars: 18,
    lineHeightPx: 28,
    extraPaddingPx: 4,
  },
  heading4: {
    // text-lg (18px font, font-medium, leading ~26px)
    charsPer12Col: 110,
    minChars: 20,
    lineHeightPx: 26,
    extraPaddingPx: 4,
  },
  lead: {
    // text-base (16px font, leading-relaxed ~24px)
    charsPer12Col: 120,
    minChars: 22,
    lineHeightPx: 24,
    extraPaddingPx: 4,
  },
  quote: {
    // text-sm, italic, pl-4, border-l-2
    charsPer12Col: 135,
    minChars: 24,
    lineHeightPx: 22,
    extraPaddingPx: 8,
  },
  caption: {
    // text-xs (12px font, leading ~16px)
    charsPer12Col: 160,
    minChars: 28,
    lineHeightPx: 16,
    extraPaddingPx: 0,
  },
  paragraph: {
    // text-sm (14px font, leading-relaxed ~22.75px)
    charsPer12Col: 140,
    minChars: 26,
    lineHeightPx: 22,
    extraPaddingPx: 0,
  },
};

/**
 * Estima o número exato de linhas de grade (44px + 16px gap) necessárias para acomodar o texto
 * com base no preset selecionado (títulos h1–h4, parágrafo, etc.), quantidade real de caracteres
 * por linha e quebras de linha, garantindo que o bloco não invada nem sobreponha os blocos abaixo.
 */
export function estimateTextRowSpan(
  content: string,
  span = 12,
  preset?: string,
): BlockRowSpan {
  if (!content || !content.trim()) return 1;

  // Se o conteúdo tiver [fs:text-4xl], [fs:text-2xl], etc., detecta o tamanho real configurado
  const fsMatch = /\[fs:(text-[^\]]+)\]/.exec(content);
  const inlineSize = fsMatch ? fsMatch[1] : undefined;

  let effectivePreset = normalizeTextPreset(preset);
  if (inlineSize === 'text-4xl' || inlineSize === 'text-3xl') {
    effectivePreset = 'heading1';
  } else if (inlineSize === 'text-2xl') {
    effectivePreset = 'heading2';
  } else if (inlineSize === 'text-xl') {
    effectivePreset = 'heading3';
  } else if (inlineSize === 'text-lg') {
    effectivePreset = 'heading4';
  } else if (inlineSize === 'text-base') {
    effectivePreset = 'lead';
  } else if (inlineSize === 'text-sm') {
    effectivePreset = 'paragraph';
  } else if (inlineSize === 'text-xs') {
    effectivePreset = 'caption';
  }

  const metric = PRESET_METRICS[effectivePreset] ?? PRESET_METRICS.paragraph;

  // Remove marcações [fs:...], formatações de rich text (*negrito*, _itálico_, ~tachado~, `código`)
  // e normaliza quebras de linha para que a contagem reflita os caracteres visuais reais
  const cleanContent = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\[fs:[^\]]+\]/g, '')
    .replace(/\[\/fs\]/g, '')
    .replace(/[*_~`]/g, '');

  // Preserva todas as quebras de linha (incluindo quebras extras/vazias criadas com Enter)
  const lines = cleanContent.split('\n');

  const charsPerLine = Math.max(
    metric.minChars,
    Math.round((span / GRID_COLS) * metric.charsPer12Col),
  );

  let visualLinesCount = 0;
  for (const line of lines) {
    if (line.trim().length === 0) {
      // Cada linha vazia (Enter) ocupa uma linha visual completa no editor
      visualLinesCount += 1;
    } else {
      const isListItem = /^\s*[-*•]\s/.test(line);
      const trimmedLine = line.trimEnd();
      const lineWraps = Math.max(1, Math.ceil(trimmedLine.length / charsPerLine));
      visualLinesCount += isListItem ? lineWraps * 1.15 : lineWraps;
    }
  }

  const isSingleLine = visualLinesCount <= 1 && lines.length <= 1;
  const extraPadding = isSingleLine ? 0 : metric.extraPaddingPx;
  const hasHeadingMarkdown =
    /^#{1,4}\s/m.test(content) || /^\s*\*[^*]+\*\s*$/m.test(content);

  const totalContentHeight =
    visualLinesCount * metric.lineHeightPx +
    extraPadding +
    (hasHeadingMarkdown && effectivePreset === 'paragraph' ? 18 : 0);

  return pixelsToRowSpan(totalContentHeight, 'text.rich');
}

/**
 * Converte uma altura estimada em pixels (considerando padding de card e elementos internos)
 * para o número correspondente de linhas de grade (base 44px + 60px por linha adicional).
 */
export function pixelsToRowSpan(pixels: number, type?: string): BlockRowSpan {
  if (pixels <= GRID_ROW_TOLERANCE_PX) return normalizeRowSpan(1, type);
  const neededRows = 1 + Math.ceil((pixels - GRID_ROW_TOLERANCE_PX) / GRID_ROW_STEP_PX);
  return normalizeRowSpan(neededRows, type);
}

function blockHasHeader(block: PageBlock): boolean {
  return Boolean(block.props?.title || block.props?.description);
}

/**
 * Extrai a quantidade de itens a serem exibidos por um bloco de dados (ex: feed ou tabela).
 * Prioridade: 1) data.params.limit, 2) data.inline.data.length, 3) props.items.length, 4) fallback.
 */
export function extractDataBlockItemCount(block: PageBlock, defaultCount = 5): number {
  const paramLimit = Number(block.data?.params?.limit);
  if (Number.isFinite(paramLimit) && paramLimit > 0) {
    return paramLimit;
  }
  const inline = block.data?.inline;
  if (inline && typeof inline === 'object' && Array.isArray((inline as { data?: unknown[] }).data)) {
    return (inline as { data: unknown[] }).data.length;
  }
  if (Array.isArray(block.props?.items)) {
    return block.props.items.length;
  }
  if (Array.isArray(block.props?.rows)) {
    return block.props.rows.length;
  }
  return defaultCount;
}

/**
 * Estima a altura necessária para um bloco list.feed.
 * Cada item tem título principal + subtítulo de data/hora + espaçamento (~52px).
 */
export function estimateFeedRowSpan(block: PageBlock): BlockRowSpan {
  const hasHeader = blockHasHeader(block);
  const count = extractDataBlockItemCount(block, 5);
  // Padding do card (48px) + Cabeçalho (64px se existir) + itens (count * 52px)
  const totalHeight = 48 + (hasHeader ? 64 : 0) + count * 52;
  return pixelsToRowSpan(totalHeight, 'list.feed');
}

/**
 * Estima a altura necessária para um bloco table.basic.
 * Cabeçalho do card + thead (~40px) + cada linha (~40px) + paginação (~48px).
 */
export function estimateTableRowSpan(block: PageBlock): BlockRowSpan {
  const hasHeader = blockHasHeader(block);
  const count = extractDataBlockItemCount(block, 5);
  const totalHeight = 48 + (hasHeader ? 64 : 0) + 40 + count * 40 + 48;
  return pixelsToRowSpan(totalHeight, 'table.basic');
}

/**
 * Estima a altura necessária para o bloco topic (itens de escopo em proposta).
 */
export function estimateTopicRowSpan(block: PageBlock, cols = 12): BlockRowSpan {
  const hasTitle = Boolean(block.props?.title);
  const hasDesc = Boolean(block.props?.description);
  const hasHeader = hasTitle || hasDesc;
  // CardHeader: title (~28px) + desc (~24px) + gap-6 do Card (24px)
  const headerHeight = hasTitle && hasDesc ? 76 : hasHeader ? 52 : 0;

  const span = normalizeSpan(block.span);
  const charsPerLine = Math.max(25, Math.round((span / cols) * 100));

  const items = Array.isArray(block.props?.items) ? block.props.items : [];
  let itemsHeight = 0;
  if (items.length === 0) {
    itemsHeight = 24;
  } else {
    for (const item of items) {
      const text = typeof item === 'string' ? item.trim() : '';
      const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
      // Cada item text-sm tem line-height ~20px + space-y-1 (4px). O botão "+ Item" do editor não faz parte do conteúdo.
      itemsHeight += lines * 20 + 4;
    }
  }

  // Padding do card py-6 (24px topo + 24px base = 48px)
  const totalHeight = 48 + headerHeight + itemsHeight;
  return pixelsToRowSpan(totalHeight, 'topic');
}

/**
 * Registro extensível e agnóstico de estimadores de altura por tipo de bloco.
 */
export type BlockRowSpanEstimator = (block: PageBlock, cols?: number) => BlockRowSpan;

export const BLOCK_ROW_SPAN_ESTIMATORS: Record<string, BlockRowSpanEstimator> = {
  'text.rich': (block) => {
    const content = typeof block.props?.content === 'string' ? block.props.content : '';
    if (!content) return 1;
    const span = normalizeSpan(block.span);
    const preset = typeof block.props?.preset === 'string' ? block.props.preset : undefined;
    return estimateTextRowSpan(content, span, preset);
  },
  'chart.area': () => 4,
  'chart.bar': () => 4,
  'chart.line': () => 4,
  'list.feed': estimateFeedRowSpan,
  'table.basic': estimateTableRowSpan,
  topic: estimateTopicRowSpan,
  image: () => 3,
  iframe: () => 3,
};
