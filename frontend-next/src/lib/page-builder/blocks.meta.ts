import type { LayoutProfileName } from './profiles';
import type { SourceKind } from './types';

export type BlockPropType =
  | 'string'
  | 'rich-text'
  | 'number'
  | 'boolean'
  | 'string[]'
  | 'storage-file';

export interface BlockPropOption {
  label: string;
  value: string;
}

export type TextPreset =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'paragraph'
  | 'lead'
  | 'caption'
  | 'quote';

export function normalizeTextPreset(preset: unknown): TextPreset {
  if (typeof preset !== 'string') return 'paragraph';
  const p = preset.toLowerCase().trim();
  if (p === 'h1' || p === 'heading1') return 'heading1';
  if (p === 'h2' || p === 'heading2') return 'heading2';
  if (p === 'h3' || p === 'heading3') return 'heading3';
  if (p === 'h4' || p === 'heading4') return 'heading4';
  if (p === 'lead') return 'lead';
  if (p === 'caption') return 'caption';
  if (p === 'quote' || p === 'blockquote') return 'quote';
  return 'paragraph';
}

export type TextFontSizeClass =
  | 'text-xs'
  | 'text-sm'
  | 'text-base'
  | 'text-lg'
  | 'text-xl'
  | 'text-2xl'
  | 'text-3xl'
  | 'text-4xl';

export interface TextPresetConfig {
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'blockquote' | 'div';
  className: string;
  label: string;
  fontSize: TextFontSizeClass;
  bold?: boolean;
  italic?: boolean;
}

export const TEXT_PRESET_CONFIG: Record<TextPreset, TextPresetConfig> = {
  paragraph: {
    tag: 'div',
    className: 'text-sm text-muted-foreground leading-relaxed',
    label: 'Parágrafo',
    fontSize: 'text-sm',
    bold: false,
  },
  heading1: {
    tag: 'h1',
    className: 'text-4xl font-bold tracking-tight text-foreground',
    label: 'Título 1 (H1)',
    fontSize: 'text-4xl',
    bold: true,
  },
  heading2: {
    tag: 'h2',
    className: 'text-2xl font-semibold tracking-tight text-foreground',
    label: 'Título 2 (H2)',
    fontSize: 'text-2xl',
    bold: true,
  },
  heading3: {
    tag: 'h3',
    className: 'text-xl font-semibold text-foreground',
    label: 'Título 3 (H3)',
    fontSize: 'text-xl',
    bold: true,
  },
  heading4: {
    tag: 'h4',
    className: 'text-lg font-medium text-foreground',
    label: 'Título 4 (H4)',
    fontSize: 'text-lg',
    bold: true,
  },
  lead: {
    tag: 'p',
    className: 'text-base font-normal text-foreground leading-relaxed',
    label: 'Destaque (Lead)',
    fontSize: 'text-base',
    bold: false,
  },
  caption: {
    tag: 'p',
    className: 'text-xs text-muted-foreground',
    label: 'Legenda',
    fontSize: 'text-xs',
    bold: false,
  },
  quote: {
    tag: 'blockquote',
    className: 'border-l-2 border-primary/50 pl-4 italic text-muted-foreground',
    label: 'Citação',
    fontSize: 'text-sm',
    italic: true,
  },
};

/**
 * O Preset atua como um atalho configurador para o conjunto de estilos do texto:
 * - Define a fonte correspondente via [fs:<fontSize>] (ex: text-4xl para H1, text-sm para parágrafo)
 * - Define negrito quando aplicável (ex: *...* para H1-H4) ou remove negrito global
 * - Define itálico quando aplicável (ex: _..._ para citação)
 * Mantém o seletor de tamanho da fonte ativo no editor para que o usuário possa fazer ajustes finos.
 */
export function applyPresetToContent(content: string, preset: TextPreset): string {
  const cfg = TEXT_PRESET_CONFIG[preset];
  if (!cfg) return content;
  if (!content || !content.trim()) return content;

  // 1. Remove qualquer marcação anterior de tamanho [fs:...]
  let clean = content.replace(/\[fs:[^\]]+\]([\s\S]*?)\[\/fs\]/g, '$1');

  // 2. Configura negrito se o preset pedir
  if (cfg.bold) {
    clean = clean.replace(/\*([^*]+?)\*/g, '$1');
    const trimmed = clean.trim();
    if (trimmed) {
      clean = `*${clean}*`;
    }
  } else if (cfg.bold === false) {
    clean = clean.replace(/\*([^*]+?)\*/g, '$1');
  }

  // 3. Configura itálico se for citação
  if (cfg.italic) {
    const trimmed = clean.trim();
    if (trimmed && !(trimmed.startsWith('_') && trimmed.endsWith('_'))) {
      clean = `_${clean}_`;
    }
  }

  // 4. Aplica o tamanho de fonte configurado pelo Preset
  return `[fs:${cfg.fontSize}]${clean}[/fs]`;
}

export interface BlockPropMeta {
  name: string;
  type: BlockPropType;
  required: boolean;
  /** Quando `true`, exibe picker de tamanho de fonte no campo RichText deste prop. */
  showFontSize?: boolean;
  /** Opções para seleção quando o tipo for string (dropdown no painel). */
  options?: readonly (string | BlockPropOption)[];
}

export type BlockCategory = 'charts' | 'data' | 'content' | 'structure' | 'media';

export interface BlockMeta {
  description: string;
  /** Profiles que oferecem este bloco; `describeBlocks(profile)` filtra por aqui. */
  profiles: readonly LayoutProfileName[];
  /** Kinds de fonte que este bloco renderiza. Vazio = bloco não consome dado. */
  accepts: SourceKind[];
  props: BlockPropMeta[];
  /** Recebe `children` em vez de dado. Filho não pode ser container (um nível só). */
  container?: boolean;
  /** Micro-elemento sem grade pesada (ex: Texto, Botão) — ocupa só o espaço do seu conteúdo. */
  inline?: boolean;
  /** Altura cresce com o conteúdo via CSS (`auto-rows-[minmax(44px,auto)]`), não pela grade JS. */
  autoHeight?: boolean;
  /** Tem conteúdo editável diretamente no canvas (`InlineRichText` ou lista de itens) — define
   * se a casca do editor libera `pointer-events` e mostra os controles de texto na toolbar. */
  textEditable?: boolean;
  /** Quando `true`, a fonte de dados (`data.source`) é opcional (ex: `text.rich` só usa fonte quando quer mesclar `{{variavel}}`). */
  optionalSource?: boolean;
  /** Altura padrão em linhas de grade (1 a 8). */
  defaultRowSpan?: number;
  /** Altura mínima em linhas de grade (1 a 8). */
  minRowSpan?: number;
  /** Categoria do bloco para organização na paleta e inserter rápido. */
  category?: BlockCategory;
  /** Nome do ícone representativo (Lucide). */
  icon?: string;
}

/** Catálogo de blocos do page builder, sem dependência de React. */
export const BLOCK_META = {
  group: {
    profiles: ['dashboard', 'proposal'],
    category: 'structure',
    icon: 'Columns',
    defaultRowSpan: 2,
    minRowSpan: 1,
    description:
      'Um único card contendo outros blocos lado a lado. Use quando o pedido junta coisas ' +
      'numa mesma caixa ("um card com o total à esquerda e a lista à direita"). Não tem ' +
      'fonte de dados própria: quem busca dado são os `children`, e o `span` de cada filho ' +
      'divide a largura DENTRO do card (2 + 2 = metade e metade).',
    accepts: [],
    container: true,
    props: [
      { name: 'title', type: 'rich-text', required: false },
      { name: 'description', type: 'rich-text', required: false },
    ],
  },
  'chart.area': {
    profiles: ['dashboard', 'proposal'],
    category: 'charts',
    icon: 'AreaChart',
    defaultRowSpan: 4,
    minRowSpan: 2,
    description:
      'Gráfico de área ao longo do tempo. No dashboard, precisa de uma fonte do tipo series; na ' +
      'proposta, o dado vem colado em `data.inline` no formato series: ' +
      '`{ data: [{ date: "2024-01", value: 100 }, ...] }`.',
    accepts: ['series'],
    props: [
      { name: 'title', type: 'rich-text', required: false },
      { name: 'description', type: 'rich-text', required: false },
    ],
  },
  'chart.bar': {
    profiles: ['dashboard', 'proposal'],
    category: 'charts',
    icon: 'BarChart',
    defaultRowSpan: 4,
    minRowSpan: 2,
    description:
      'Gráfico de barras para dados discretos ao longo do tempo. No dashboard, precisa de uma ' +
      'fonte do tipo series; na proposta, o dado vem colado em `data.inline` no formato series: ' +
      '`{ data: [{ date: "2024-01", value: 100 }, ...] }`.',
    accepts: ['series'],
    props: [
      { name: 'title', type: 'rich-text', required: false },
      { name: 'description', type: 'rich-text', required: false },
    ],
  },
  'chart.line': {
    profiles: ['dashboard', 'proposal'],
    category: 'charts',
    icon: 'LineChart',
    defaultRowSpan: 4,
    minRowSpan: 2,
    description:
      'Gráfico de linhas para tendências ao longo do tempo. No dashboard, precisa de uma fonte ' +
      'do tipo series; na proposta, o dado vem colado em `data.inline` no formato series: ' +
      '`{ data: [{ date: "2024-01", value: 100 }, ...] }`.',
    accepts: ['series'],
    props: [
      { name: 'title', type: 'rich-text', required: false },
      { name: 'description', type: 'rich-text', required: false },
    ],
  },
  'text.rich': {
    profiles: ['dashboard', 'proposal'],
    category: 'content',
    icon: 'Type',
    defaultRowSpan: 1,
    minRowSpan: 1,
    description:
      'Elemento de texto rico (Rich Text) com suporte a presets (títulos h1–h4, parágrafo, destaque, legenda, citação), fonte de dados e variáveis dinâmicas.',
    accepts: ['list', 'count', 'series'],
    optionalSource: true,
    inline: true,
    autoHeight: true,
    textEditable: true,
    props: [
      { name: 'content', type: 'rich-text', required: true, showFontSize: true },
      {
        name: 'preset',
        type: 'string',
        required: false,
        options: [
          { label: 'Parágrafo', value: 'paragraph' },
          { label: 'Título 1 (H1)', value: 'heading1' },
          { label: 'Título 2 (H2)', value: 'heading2' },
          { label: 'Título 3 (H3)', value: 'heading3' },
          { label: 'Título 4 (H4)', value: 'heading4' },
          { label: 'Destaque (Lead)', value: 'lead' },
          { label: 'Legenda', value: 'caption' },
          { label: 'Citação', value: 'quote' },
        ],
      },
    ],
  },
  'button.action': {
    profiles: ['dashboard', 'proposal'],
    category: 'content',
    icon: 'MousePointerClick',
    defaultRowSpan: 1,
    minRowSpan: 1,
    description:
      'Elemento compacto de botão clicável com texto (Rich Text) e link. Combine com blocos de Texto dentro de qualquer bloco ou Grupo.',
    accepts: [],
    inline: true,
    autoHeight: true,
    textEditable: true,
    props: [
      { name: 'label', type: 'rich-text', required: true },
      { name: 'url', type: 'string', required: true },
    ],
  },
  'list.feed': {
    profiles: ['dashboard', 'proposal'],
    category: 'data',
    icon: 'List',
    defaultRowSpan: 4,
    minRowSpan: 2,
    description:
      'Lista compacta de itens em formato feed (ex: atividades recentes). No dashboard, em ' +
      '`columns` informe [campo_principal, campo_secundário] da fonte escolhida. Na proposta, o ' +
      'dado vem colado em `data.inline` no formato list: `{ data: [{ campo: valor, ... }, ...] }` ' +
      '— `columns` então aponta para as chaves que você mesmo colocou em cada item.',
    accepts: ['list'],
    props: [
      { name: 'title', type: 'rich-text', required: false },
      { name: 'description', type: 'rich-text', required: false },
      { name: 'columns', type: 'string[]', required: true },
    ],
  },
  'table.basic': {
    profiles: ['dashboard', 'proposal'],
    category: 'data',
    icon: 'Table',
    defaultRowSpan: 4,
    minRowSpan: 2,
    description:
      'Tabela simples e somente leitura de uma lista paginada. No dashboard, em `columns` use ' +
      'SOMENTE nomes que aparecem em `fields` da fonte escolhida — campo inventado vira coluna ' +
      'vazia. Na proposta, o dado vem colado em `data.inline` no formato list: ' +
      '`{ data: [{ campo: valor, ... }, ...] }` — `columns` então aponta para as chaves que você ' +
      'mesmo colocou em cada item (sem paginação: a proposta não busca página seguinte).',
    accepts: ['list'],
    props: [
      { name: 'title', type: 'rich-text', required: false },
      { name: 'description', type: 'rich-text', required: false },
      { name: 'columns', type: 'string[]', required: true },
    ],
  },
  topic: {
    profiles: ['proposal'],
    category: 'content',
    icon: 'ListChecks',
    defaultRowSpan: 2,
    minRowSpan: 1,
    description:
      'Bloco de escopo: título, descrição opcional e uma lista de itens. Use para "o que entra" ' +
      'numa proposta — fases, entregáveis, stack técnica. Não consome fonte de dados.',
    accepts: [],
    textEditable: true,
    props: [
      { name: 'title', type: 'rich-text', required: false },
      { name: 'description', type: 'rich-text', required: false },
      { name: 'items', type: 'string[]', required: true },
    ],
  },
  image: {
    profiles: ['proposal'],
    category: 'media',
    icon: 'ImageIcon',
    defaultRowSpan: 3,
    minRowSpan: 1,
    description:
      'Imagem com legenda opcional (mockup, print de tela, diagrama). Não consome fonte de dados.',
    accepts: [],
    props: [
      { name: 'url', type: 'string', required: true },
      { name: 'alt', type: 'string', required: false },
      { name: 'caption', type: 'rich-text', required: false },
    ],
  },
  investment: {
    profiles: ['proposal'],
    category: 'data',
    icon: 'Coins',
    defaultRowSpan: 3,
    minRowSpan: 1,
    description:
      'Espelha o ENVELOPE comercial da proposta (registro único: o que soma no funil e vai para ' +
      'o contrato) — valor, recorrência, prazo, validade e itens inclusos (e opcionais, se ' +
      'habilitado). Não recebe o preço por props — lê o envelope por contexto, nunca duplicado no ' +
      'JSON do layout. Para valor LIVRE (mais de um preço na mesma proposta: projeto + ' +
      'mensalidade, planos alternativos), use o bloco `price` em vez deste.',
    accepts: [],
    props: [
      { name: 'title', type: 'rich-text', required: false },
      { name: 'showOptional', type: 'boolean', required: false },
    ],
  },
  iframe: {
    profiles: ['proposal'],
    category: 'media',
    icon: 'Globe',
    defaultRowSpan: 4,
    minRowSpan: 2,
    description:
      'Demonstração HTML/imagem ou pasta (site estático) isolada em sandbox. O conteúdo vem de um ' +
      '`Artifact` por `artifactId` — nunca HTML inline no layout. Preview estático; o toque abre ' +
      'um modal com a interação liberada. Não consome fonte de dados.',
    accepts: [],
    props: [
      { name: 'artifactId', type: 'storage-file', required: true },
      { name: 'title', type: 'rich-text', required: false },
      { name: 'height', type: 'number', required: false },
      { name: 'aspect', type: 'string', required: false },
    ],
  },
  divider: {
    profiles: ['dashboard', 'proposal'],
    category: 'structure',
    icon: 'Minus',
    defaultRowSpan: 1,
    minRowSpan: 1,
    description:
      'Linha divisória horizontal, para separar seções sem precisar de um título. `spacing` ' +
      'controla a margem vertical (sm, md ou lg; padrão md). Não consome fonte de dados.',
    accepts: [],
    autoHeight: true,
    props: [{ name: 'spacing', type: 'string', required: false }],
  },
  price: {
    profiles: ['proposal'],
    category: 'data',
    icon: 'DollarSign',
    defaultRowSpan: 3,
    minRowSpan: 1,
    description:
      'Tabela de valores LIVRE — apresentação, não registro (não soma no funil, não vai para o ' +
      'contrato; quem faz isso é o envelope/`investment`). `rows` é uma linha "Rótulo|12000" por ' +
      'item, valor SEMPRE em centavos. `totalCents` (também em centavos) mostra um total em ' +
      'destaque com `totalLabel`. **Várias instâncias de `price` na mesma proposta são normais** ' +
      '— ex. um para o projeto fechado e outro para a mensalidade, cada um com seu `recurrence`. ' +
      '`highlight` destaca a opção recomendada quando há mais de uma. Não consome fonte de dados.',
    accepts: [],
    textEditable: true,
    props: [
      { name: 'title', type: 'rich-text', required: false },
      { name: 'description', type: 'rich-text', required: false },
      { name: 'rows', type: 'string[]', required: true },
      { name: 'totalLabel', type: 'string', required: false },
      { name: 'totalCents', type: 'number', required: false },
      { name: 'currency', type: 'string', required: false },
      { name: 'recurrence', type: 'string', required: false },
      { name: 'highlight', type: 'boolean', required: false },
    ],
  },
} as const satisfies Record<string, BlockMeta>;

export type BlockType = keyof typeof BLOCK_META;

export function isAutoHeightBlockType(type?: string): boolean {
  if (!type || !(type in BLOCK_META)) return false;
  const meta = BLOCK_META[type as BlockType];
  return Boolean(meta && 'autoHeight' in meta && meta.autoHeight);
}

export function isTextEditableBlockType(type?: string): boolean {
  if (!type || !(type in BLOCK_META)) return false;
  const meta = BLOCK_META[type as BlockType];
  return Boolean(meta && 'textEditable' in meta && meta.textEditable);
}

export function isContainerType(type?: string): boolean {
  if (!type || !(type in BLOCK_META)) return false;
  const meta = BLOCK_META[type as BlockType];
  return Boolean(meta && 'container' in meta && meta.container);
}

export function isInlineBlockType(type: string): boolean {
  const meta = BLOCK_META[type as BlockType];
  return !!meta && 'inline' in meta && !!meta.inline;
}

export function canAcceptChildrenType(type: string): boolean {
  if (!(type in BLOCK_META)) return false;
  return !isInlineBlockType(type);
}

/** Devolve a lista de tipos de bloco suportados por um determinado profile. */
export function blocksForProfile(profile: LayoutProfileName): BlockType[] {
  return (Object.keys(BLOCK_META) as BlockType[]).filter((type) =>
    (BLOCK_META[type].profiles as readonly LayoutProfileName[]).includes(profile),
  );
}

/** Sem profile devolve o catálogo inteiro — chamador antigo continua vendo tudo. */
export function describeBlocks(profile?: LayoutProfileName) {
  return Object.entries(BLOCK_META)
    .filter(
      ([, meta]) =>
        !profile ||
        (meta.profiles as readonly LayoutProfileName[]).includes(profile),
    )
    .map(([type, meta]) => ({
      type,
      description: meta.description,
      accepts: [...meta.accepts],
      container: 'container' in meta ? meta.container : false,
      inline: 'inline' in meta ? meta.inline : false,
      optionalSource: 'optionalSource' in meta ? meta.optionalSource : false,
      defaultRowSpan: meta.defaultRowSpan ?? 1,
      minRowSpan: meta.minRowSpan ?? 1,
      category: meta.category ?? 'content',
      icon: meta.icon,
      props: meta.props.map((p): BlockPropMeta => ({ ...p })),
    }));
}
