import type { LayoutProfileName } from './profiles';
import type { SourceKind } from './types';

export interface BlockPropMeta {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'string[]';
  required: boolean;
}

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
  /** Quando `true`, a fonte de dados (`data.source`) é opcional (ex: `text.rich` só usa fonte quando quer mesclar `{{variavel}}`). */
  optionalSource?: boolean;
}

/** Catálogo de blocos do page builder, sem dependência de React. */
export const BLOCK_META = {
  group: {
    profiles: ['dashboard', 'proposal'],
    description:
      'Um único card contendo outros blocos lado a lado. Use quando o pedido junta coisas ' +
      'numa mesma caixa ("um card com o total à esquerda e a lista à direita"). Não tem ' +
      'fonte de dados própria: quem busca dado são os `children`, e o `span` de cada filho ' +
      'divide a largura DENTRO do card (2 + 2 = metade e metade).',
    accepts: [],
    container: true,
    props: [{ name: 'title', type: 'string', required: false }],
  },
  'chart.area': {
    profiles: ['dashboard'],
    description:
      'Gráfico de área ao longo do tempo. Precisa de uma fonte do tipo series.',
    accepts: ['series'],
    props: [
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
    ],
  },
  'chart.bar': {
    profiles: ['dashboard'],
    description:
      'Gráfico de barras para dados discretos ao longo do tempo. Precisa de uma fonte do tipo series.',
    accepts: ['series'],
    props: [
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
    ],
  },
  'chart.line': {
    profiles: ['dashboard'],
    description:
      'Gráfico de linhas para tendências ao longo do tempo. Precisa de uma fonte do tipo series.',
    accepts: ['series'],
    props: [
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
    ],
  },
  'alert.banner': {
    profiles: ['dashboard', 'proposal'],
    description:
      'Banner de alerta informativo com ícone e mensagem de destaque. Não consome fonte de dados.',
    accepts: [],
    props: [
      { name: 'title', type: 'string', required: true },
      { name: 'content', type: 'string', required: true },
    ],
  },
  'text.rich': {
    profiles: ['dashboard', 'proposal'],
    description:
      'Elemento de texto rico (Rich Text) com suporte opcional a fonte de dados e variáveis dinâmicas (ex: "Bom dia, temos {{total}} usuários hoje").',
    accepts: ['list', 'count', 'series'],
    optionalSource: true,
    inline: true,
    props: [{ name: 'content', type: 'string', required: true }],
  },
  'button.action': {
    profiles: ['dashboard', 'proposal'],
    description:
      'Elemento compacto de botão clicável com texto (Rich Text) e link. Combine com blocos de Texto dentro de qualquer bloco ou Grupo.',
    accepts: [],
    inline: true,
    props: [
      { name: 'label', type: 'string', required: true },
      { name: 'url', type: 'string', required: true },
    ],
  },
  'list.feed': {
    profiles: ['dashboard'],
    description:
      'Lista compacta de itens em formato feed (ex: atividades recentes). ' +
      'Em `columns`, informe [campo_principal, campo_secundário] da fonte escolhida.',
    accepts: ['list'],
    props: [
      { name: 'title', type: 'string', required: false },
      { name: 'columns', type: 'string[]', required: true },
    ],
  },
  'table.basic': {
    profiles: ['dashboard'],
    description:
      'Tabela simples e somente leitura de uma lista paginada. ' +
      'Em `columns`, use SOMENTE nomes que aparecem em `fields` da fonte escolhida — ' +
      'campo inventado vira coluna vazia.',
    accepts: ['list'],
    props: [
      { name: 'title', type: 'string', required: false },
      { name: 'columns', type: 'string[]', required: true },
    ],
  },
  topic: {
    profiles: ['proposal'],
    description:
      'Bloco de escopo: título, descrição opcional e uma lista de itens. Use para "o que entra" ' +
      'numa proposta — fases, entregáveis, stack técnica. Não consome fonte de dados.',
    accepts: [],
    props: [
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
      { name: 'items', type: 'string[]', required: true },
    ],
  },
  image: {
    profiles: ['proposal'],
    description:
      'Imagem com legenda opcional (mockup, print de tela, diagrama). Não consome fonte de dados.',
    accepts: [],
    props: [
      { name: 'url', type: 'string', required: true },
      { name: 'alt', type: 'string', required: false },
      { name: 'caption', type: 'string', required: false },
    ],
  },
  investment: {
    profiles: ['proposal'],
    description:
      'Bloco de investimento: valor, recorrência, prazo, validade e itens inclusos (e opcionais, ' +
      'se habilitado). Não recebe o preço por props — lê o envelope comercial da proposta por ' +
      'contexto, nunca duplicado no JSON do layout.',
    accepts: [],
    props: [
      { name: 'title', type: 'string', required: false },
      { name: 'showOptional', type: 'boolean', required: false },
    ],
  },
  iframe: {
    profiles: ['proposal'],
    description:
      'Demonstração HTML interativa (protótipo, apresentação) isolada em sandbox. O conteúdo vem ' +
      'do storage por `storageKey` — nunca HTML inline no layout. Preview estático; o toque abre ' +
      'um modal com a interação liberada. Não consome fonte de dados.',
    accepts: [],
    props: [
      { name: 'storageKey', type: 'string', required: true },
      { name: 'title', type: 'string', required: false },
      { name: 'height', type: 'number', required: false },
      { name: 'aspect', type: 'string', required: false },
    ],
  },
} as const satisfies Record<string, BlockMeta>;

export type BlockType = keyof typeof BLOCK_META;

export function isInlineBlockType(type: string): boolean {
  const meta = BLOCK_META[type as BlockType];
  return !!meta && 'inline' in meta && !!meta.inline;
}

export function canAcceptChildrenType(type: string): boolean {
  if (!(type in BLOCK_META)) return false;
  return !isInlineBlockType(type);
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
      props: meta.props.map((p): BlockPropMeta => ({ ...p })),
    }));
}
