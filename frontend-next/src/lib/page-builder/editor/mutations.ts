import { arrayMove } from '@dnd-kit/sortable';
import {
  applyPresetToContent,
  BLOCK_META,
  canAcceptChildrenType,
  isContainerType,
  isInlineBlockType,
  normalizeTextPreset,
  type BlockType,
} from '../blocks.meta';
import {
  autoPackBlocks,
  calculateEffectiveRowSpan,
  insertBlockIntoGrid,
  moveBlockToCell,
  nudgeBlockInGrid,
  removeBlockFromGrid,
  resizeBlockLeftInGrid,
  resizeBlockRowSpanInGrid,
  resizeBlockSpanInGrid,
  resizeBlockTopInGrid,
  resolveGridLayout,
  swapBlocksInGrid,
  syncBlockRowSpanChange,
} from '../grid-engine';
import type { LayoutProfileName } from '../profiles';
import {
  defaultRowSpanForType,
  EMPTY_LAYOUT,
  GRID_COLS,
  maxBlocksFor,
  maxChildrenFor,
  normalizeRowSpan,
  normalizeSpan,
  type PageBlock,
  type PageLayout,
} from '../schema';

/** Funções puras que editam o layout do page builder: (layout, ...) → layout. */

export { EMPTY_LAYOUT };

export interface Located {
  block: PageBlock;
  /** `undefined` = bloco de topo; preenchido = filho deste container. */
  parentId?: string;
  index: number;
}

export function findBlock(
  layout: PageLayout,
  id: string,
): Located | undefined {
  const top = layout.blocks.findIndex((b) => b.id === id);
  if (top !== -1) return { block: layout.blocks[top], index: top };

  for (const parent of layout.blocks) {
    const index = parent.children?.findIndex((c) => c.id === id) ?? -1;
    if (index !== -1) {
      return { block: parent.children![index], parentId: parent.id, index };
    }
  }
  return undefined;
}

/** Aplica `fn` a todo bloco dos dois níveis — a base de toda edição pontual. */
function mapBlocks(
  layout: PageLayout,
  fn: (block: PageBlock) => PageBlock,
): PageLayout {
  return {
    ...layout,
    blocks: layout.blocks.map((block) => {
      const mapped = fn(block);
      return mapped.children
        ? { ...mapped, children: mapped.children.map(fn) }
        : mapped;
    }),
  };
}

export function updateBlock(
  layout: PageLayout,
  id: string,
  patch: Partial<PageBlock>,
): PageLayout {
  return mapBlocks(layout, (b) => (b.id === id ? { ...b, ...patch } : b));
}

function syncRowSpanIfNeeded(
  layout: PageLayout,
  located: Located,
  id: string,
  oldRowSpan: number,
  propName: string,
): PageLayout {
  const updatedLocated = findBlock(layout, id);
  if (!updatedLocated) return layout;
  const newRowSpan = calculateEffectiveRowSpan(updatedLocated.block, GRID_COLS);
  if (propName !== 'preset' && propName !== 'content' && oldRowSpan === newRowSpan) return layout;

  if (!located.parentId) {
    return {
      ...layout,
      blocks: syncBlockRowSpanChange(layout.blocks, id, oldRowSpan, newRowSpan, GRID_COLS),
    };
  }
  return {
    ...layout,
    blocks: layout.blocks.map((b) =>
      b.id === located.parentId
        ? { ...b, children: syncBlockRowSpanChange(b.children ?? [], id, oldRowSpan, newRowSpan, GRID_COLS) }
        : b,
    ),
  };
}

export function setBlockProp(
  layout: PageLayout,
  id: string,
  name: string,
  value: unknown,
): PageLayout {
  const located = findBlock(layout, id);
  const oldRowSpan = located ? calculateEffectiveRowSpan(located.block, GRID_COLS) : undefined;

  const updated = mapBlocks(layout, (b) => {
    if (b.id !== id) return b;
    const newProps = { ...b.props, [name]: value };
    if (name === 'preset') {
      const nextPreset = normalizeTextPreset(value);
      const currentContent = typeof newProps.content === 'string' ? newProps.content : '';
      if (currentContent.trim()) {
        newProps.content = applyPresetToContent(currentContent, nextPreset);
      }
    }
    return { ...b, props: newProps };
  });

  if (!located || oldRowSpan === undefined) return updated;
  return syncRowSpanIfNeeded(updated, located, id, oldRowSpan, name);
}

/** Troca a fonte de dados e descarta `params` e listas de campo que pertenciam à anterior. */
export function setBlockSource(
  layout: PageLayout,
  id: string,
  source: string | undefined,
): PageLayout {
  return mapBlocks(layout, (b) => {
    if (b.id !== id) return b;
    const fieldProps = isKnown(b.type)
      ? BLOCK_META[b.type].props.filter((p) => p.type === 'string[]')
      : [];
    const props = { ...b.props };
    for (const p of fieldProps) delete props[p.name];

    return { ...b, props, data: source ? { source } : undefined };
  });
}

/** Grava o payload colado (`data.inline`) — mutuamente exclusivo com `data.source` (ver
 * schema.ts); `undefined` limpa o campo. */
export function setBlockInline(
  layout: PageLayout,
  id: string,
  inline: unknown,
): PageLayout {
  return mapBlocks(layout, (b) =>
    b.id === id ? { ...b, data: inline === undefined ? undefined : { inline } } : b,
  );
}

export function setBlockParam(
  layout: PageLayout,
  id: string,
  name: string,
  value: unknown,
): PageLayout {
  return mapBlocks(layout, (b) => {
    if (b.id !== id || !b.data) return b;
    const params = { ...b.data.params };
    // Campo esvaziado some do JSON: `""` seria recusado num param de tipo number.
    if (value === '' || value === undefined) delete params[name];
    else params[name] = value;

    return { ...b, data: { ...b.data, params } };
  });
}

export function removeBlock(layout: PageLayout, id: string): PageLayout {
  const located = findBlock(layout, id);
  if (!located) return layout;

  if (located.parentId) {
    const parent = layout.blocks.find((b) => b.id === located.parentId);
    if (!parent) return layout;
    const oldRowSpan = calculateEffectiveRowSpan(parent, GRID_COLS);
    const updatedChildren = removeBlockFromGrid(parent.children ?? [], id, GRID_COLS);
    const updatedParent = { ...parent, children: updatedChildren };
    const newRowSpan = calculateEffectiveRowSpan(updatedParent, GRID_COLS);

    const updatedBlocks = layout.blocks.map((b) =>
      b.id === located.parentId ? updatedParent : b,
    );
    if (oldRowSpan !== newRowSpan && typeof parent.y === 'number') {
      return {
        ...layout,
        blocks: syncBlockRowSpanChange(
          updatedBlocks,
          parent.id,
          oldRowSpan,
          newRowSpan,
          GRID_COLS,
        ),
      };
    }
    return {
      ...layout,
      blocks: updatedBlocks,
    };
  }

  return {
    ...layout,
    blocks: removeBlockFromGrid(layout.blocks, id, GRID_COLS),
  };
}

/** Teto por nível — o editor desabilita o botão em vez de deixar o save falhar na validação. */
export function canAdd(
  layout: PageLayout,
  parentId?: string,
  childType?: string,
  profile?: LayoutProfileName,
): boolean {
  if (!parentId) return layout.blocks.length < maxBlocksFor(profile);
  const parent = layout.blocks.find((b) => b.id === parentId);
  if (!parent || !canAcceptChildrenType(parent.type)) return false;
  if ((parent.children?.length ?? 0) >= maxChildrenFor(profile)) return false;
  if (!childType) return true;
  // Container dentro de container é recusado na escrita; bloco de dado só entra em container geral.
  if (isContainerType(childType)) return false;
  return isContainerType(parent.type) || isInlineBlockType(childType);
}

function defaultSpanForType(type: string, parentId?: string): number {
  if (type === 'button.action') return 3;
  return parentId ? 6 : GRID_COLS;
}

export function createBlock(type: BlockType, parentId?: string): PageBlock {
  const meta = BLOCK_META[type];
  const defaultSpan = defaultSpanForType(type, parentId);
  const defaultProps: Record<string, unknown> =
    type === 'text.rich'
      ? { content: 'Texto', preset: 'paragraph' }
      : type === 'button.action'
        ? { label: 'Botão', url: '/' }
        : {};

  return {
    // Id legível: ele aparece nas mensagens de recusa do backend ("bloco table-basic-a1b2: …").
    id: `${type.replace(/\./g, '-')}-${crypto.randomUUID().slice(0, 6)}`,
    type,
    span: defaultSpan,
    props: defaultProps,
    ...('container' in meta && meta.container ? { children: [] } : {}),
  };
}

export function addBlock(
  layout: PageLayout,
  block: PageBlock,
  parentId?: string,
  profile?: LayoutProfileName,
  selectedId?: string | null,
): PageLayout {
  if (!canAdd(layout, parentId, block.type, profile)) return layout;

  if (parentId) {
    return {
      ...layout,
      blocks: layout.blocks.map((b) =>
        b.id === parentId ? { ...b, children: [...(b.children ?? []), block] } : b,
      ),
    };
  }

  // Se houver um bloco selecionado no nível raiz:
  if (selectedId) {
    const selected = layout.blocks.find((b) => b.id === selectedId);
    if (selected && typeof selected.x === 'number' && typeof selected.y === 'number') {
      const placed = resolveGridLayout(layout.blocks);
      const placedSelected = placed.find((p) => p.block.id === selectedId);
      if (placedSelected) {
        const rightSpaceX = placedSelected.x + placedSelected.span;
        // Verifica se há espaço livre ao lado direito do bloco selecionado
        if (rightSpaceX < GRID_COLS) {
          const freeSpan = GRID_COLS - rightSpaceX;
          const isSlotFree = !placed.some(
            (p) =>
              p.x < GRID_COLS &&
              p.x + p.span > rightSpaceX &&
              p.y < placedSelected.y + placedSelected.rowSpan &&
              p.y + p.rowSpan > placedSelected.y,
          );
          if (isSlotFree) {
            return {
              ...layout,
              blocks: insertBlockIntoGrid(
                layout.blocks,
                block,
                rightSpaceX,
                placedSelected.y,
                freeSpan,
                GRID_COLS,
              ),
            };
          }
        }
        // Se não há espaço livre ao lado, insere logo após o bloco selecionado
        return insertBlockAfter(layout, selectedId, block, profile);
      }
    }
  }

  // Sem bloco selecionado: insere ao final da página (abaixo do último bloco)
  const placed = resolveGridLayout(layout.blocks);
  const maxBottom = Math.max(0, ...placed.map((p) => p.y + p.rowSpan));
  const newRowSpan = block.rowSpan ?? defaultRowSpanForType(block.type);
  const newBlock: PageBlock = {
    ...block,
    x: 0,
    y: maxBottom,
    span: block.span ?? GRID_COLS,
    rowSpan: newRowSpan,
  };
  return {
    ...layout,
    blocks: [...layout.blocks, newBlock],
  };
}

/** Insere `block` logo após um bloco específico (`targetId`), empurrando os blocos abaixo para abrir espaço na grade 2D. */
export function insertBlockAfter(
  layout: PageLayout,
  targetId: string,
  block: PageBlock,
  profile?: LayoutProfileName,
): PageLayout {
  const located = findBlock(layout, targetId);
  if (!located) return layout;
  if (!canAdd(layout, located.parentId, block.type, profile)) return layout;

  const defaultSpan = defaultSpanForType(block.type);
  const newRowSpan = block.rowSpan ?? defaultRowSpanForType(block.type);

  if (!located.parentId) {
    const placed = resolveGridLayout(layout.blocks);
    const placedTarget = placed.find((p) => p.block.id === targetId);
    const targetY = placedTarget ? placedTarget.y : 0;
    const targetBottom = placedTarget ? placedTarget.y + placedTarget.rowSpan : 0;

    // Blocos na mesma seção/linha do bloco alvo que terminam em ou após o fim dele
    const sameSectionBlocks = placed.filter((p) => p.y <= targetY && p.y + p.rowSpan >= targetBottom);
    const insertY = sameSectionBlocks.length > 0
      ? Math.max(...sameSectionBlocks.map((p) => p.y + p.rowSpan))
      : targetBottom;

    // Atualiza as coordenadas dos blocos existentes:
    // - Blocos estritamente acima de insertY mantêm suas posições
    // - Blocos em ou abaixo de insertY são empurrados para baixo pelo rowSpan do novo bloco
    const updatedBlocks = layout.blocks.map((b) => {
      const p = placed.find((pl) => pl.block.id === b.id);
      const currentY = p ? p.y : (b.y ?? 0);
      const currentX = p ? p.x : (b.x ?? 0);
      if (currentY >= insertY) {
        return {
          ...b,
          x: currentX,
          y: currentY + newRowSpan,
        };
      }
      return {
        ...b,
        x: currentX,
        y: currentY,
      };
    });

    const newBlock: PageBlock = {
      ...block,
      x: 0,
      y: insertY,
      span: block.span ?? defaultSpan,
      rowSpan: newRowSpan,
    };

    const targetIndex = layout.blocks.findIndex((b) => b.id === targetId);
    const nextBlocks = [...updatedBlocks];
    nextBlocks.splice(targetIndex + 1, 0, newBlock);

    return {
      ...layout,
      blocks: nextBlocks,
    };
  }

  // Se estiver dentro de um container (ex: Group):
  const parent = layout.blocks.find((b) => b.id === located.parentId);
  if (!parent) return layout;

  const children = parent.children ?? [];
  const newBlock: PageBlock = {
    ...block,
    span: block.type === 'button.action' ? 3 : (block.span ?? located.block.span),
    rowSpan: newRowSpan,
  };

  const targetIndex = children.findIndex((c) => c.id === targetId);
  const nextChildren = [...children];
  nextChildren.splice(targetIndex + 1, 0, newBlock);

  // Se os filhos do container usavam coordenadas 2D, reempacota sequencialmente
  const hasGridCoords = children.some((c) => typeof c.x === 'number' || typeof c.y === 'number');
  const finalChildren = hasGridCoords ? autoPackBlocks(nextChildren) : nextChildren;

  return {
    ...layout,
    blocks: layout.blocks.map((b) =>
      b.id === located.parentId ? { ...b, children: finalChildren } : b,
    ),
  };
}

/** Insere `block` em um índice específico da raiz ou dentro de um container. */
export function insertBlockAt(
  layout: PageLayout,
  block: PageBlock,
  index: number,
  parentId?: string,
  profile?: LayoutProfileName,
): PageLayout {
  if (!canAdd(layout, parentId, block.type, profile)) return layout;

  if (parentId) {
    return insertAt(layout, block, parentId, index);
  }

  if (layout.blocks.length === 0) {
    const newBlock: PageBlock = {
      ...block,
      x: 0,
      y: 0,
      span: block.span ?? GRID_COLS,
      rowSpan: block.rowSpan ?? defaultRowSpanForType(block.type),
    };
    return { ...layout, blocks: [newBlock] };
  }

  if (index === 0) {
    const placed = resolveGridLayout(layout.blocks);
    const newRowSpan = block.rowSpan ?? defaultRowSpanForType(block.type);
    const updatedBlocks = layout.blocks.map((b) => {
      const p = placed.find((pl) => pl.block.id === b.id);
      const currentY = p ? p.y : (b.y ?? 0);
      const currentX = p ? p.x : (b.x ?? 0);
      return {
        ...b,
        x: currentX,
        y: currentY + newRowSpan,
      };
    });
    const newBlock: PageBlock = {
      ...block,
      x: 0,
      y: 0,
      span: block.span ?? GRID_COLS,
      rowSpan: newRowSpan,
    };
    return { ...layout, blocks: [newBlock, ...updatedBlocks] };
  }

  if (index >= layout.blocks.length) {
    const placed = resolveGridLayout(layout.blocks);
    const maxBottom = Math.max(0, ...placed.map((p) => p.y + p.rowSpan));
    const newRowSpan = block.rowSpan ?? defaultRowSpanForType(block.type);
    const newBlock: PageBlock = {
      ...block,
      x: 0,
      y: maxBottom,
      span: block.span ?? GRID_COLS,
      rowSpan: newRowSpan,
    };
    return { ...layout, blocks: [...layout.blocks, newBlock] };
  }

  const targetBlock = layout.blocks[index - 1];
  return insertBlockAfter(layout, targetBlock.id, block, profile);
}

/** Insere um bloco diretamente em uma coordenada 2D (x, y, span) de um espaço livre da grade. */
export function insertBlockAtGrid(
  layout: PageLayout,
  block: PageBlock,
  x: number,
  y: number,
  span?: number,
  parentId?: string,
  profile?: LayoutProfileName,
): PageLayout {
  if (!canAdd(layout, parentId, block.type, profile)) return layout;

  if (!parentId) {
    return {
      ...layout,
      blocks: insertBlockIntoGrid(layout.blocks, block, x, y, span, GRID_COLS),
    };
  }

  return {
    ...layout,
    blocks: layout.blocks.map((b) => {
      if (b.id !== parentId) return b;
      const children = b.children ?? [];
      return {
        ...b,
        children: insertBlockIntoGrid(children, block, x, y, span, GRID_COLS),
      };
    }),
  };
}

/** Duplica um bloco e o posiciona logo após o original. */
export function duplicateBlock(
  layout: PageLayout,
  id: string,
  profile?: LayoutProfileName,
): { layout: PageLayout; newId: string } | null {
  const located = findBlock(layout, id);
  if (!located) return null;
  if (!canAdd(layout, located.parentId, undefined, profile)) return null;

  const cloneId = `${located.block.type.replace(/\./g, '-')}-${crypto.randomUUID().slice(0, 6)}`;
  const clonedBlock: PageBlock = {
    ...JSON.parse(JSON.stringify(located.block)),
    id: cloneId,
    x: undefined,
    y: undefined,
    children: located.block.children?.map((c) => ({
      ...c,
      id: `${c.type.replace(/\./g, '-')}-${crypto.randomUUID().slice(0, 6)}`,
    })),
  };

  const nextLayout = insertAt(layout, clonedBlock, located.parentId, located.index + 1);
  return { layout: nextLayout, newId: cloneId };
}

/** Move um bloco um passo para cima ou para baixo. */
export function moveBlockStep(
  layout: PageLayout,
  id: string,
  direction: 'up' | 'down',
): PageLayout {
  const located = findBlock(layout, id);
  if (!located) return layout;

  const targetIndex = direction === 'up' ? located.index - 1 : located.index + 1;
  const listLength = located.parentId
    ? (findBlock(layout, located.parentId)?.block.children?.length ?? 0)
    : layout.blocks.length;

  if (targetIndex < 0 || targetIndex >= listLength) return layout;

  if (!located.parentId) {
    return { ...layout, blocks: arrayMove(layout.blocks, located.index, targetIndex) };
  }

  return {
    ...layout,
    blocks: layout.blocks.map((b) =>
      b.id === located.parentId
        ? { ...b, children: arrayMove(b.children ?? [], located.index, targetIndex) }
        : b,
    ),
  };
}

/** Move um bloco para uma coordenada (x, y) da grade 2D (inclusive espaços vazios). */
export function moveBlockToGrid(
  layout: PageLayout,
  activeId: string,
  targetX: number,
  targetY: number,
  targetParentId?: string,
): PageLayout {
  const from = findBlock(layout, activeId);
  if (!from) return layout;
  if (isContainerType(from.block.type) && targetParentId) return layout;

  // Se estiver mudando de nível (ex: saindo/entrando em um group)
  if (from.parentId !== targetParentId) {
    const detached = removeBlock(layout, activeId);
    if (!canAdd(detached, targetParentId)) return layout;
    return insertBlockAtGrid(
      detached,
      from.block,
      targetX,
      targetY,
      from.block.span,
      targetParentId,
    );
  }

  if (!targetParentId) {
    return {
      ...layout,
      blocks: moveBlockToCell(layout.blocks, activeId, targetX, targetY),
    };
  }

  return {
    ...layout,
    blocks: layout.blocks.map((b) =>
      b.id === targetParentId
        ? {
            ...b,
            children: moveBlockToCell(b.children ?? [], activeId, targetX, targetY),
          }
        : b,
    ),
  };
}

function applyToLevel(
  layout: PageLayout,
  id: string,
  fn: (blocks: PageBlock[]) => PageBlock[],
): PageLayout {
  const located = findBlock(layout, id);
  if (!located) return layout;
  if (!located.parentId) return { ...layout, blocks: fn(layout.blocks) };
  return {
    ...layout,
    blocks: layout.blocks.map((b) =>
      b.id === located.parentId ? { ...b, children: fn(b.children ?? []) } : b,
    ),
  };
}

/** Move um bloco 1 passo em qualquer direção 2D (left, right, up, down) na grade. */
export function nudgeBlockGrid(
  layout: PageLayout,
  id: string,
  direction: 'left' | 'right' | 'up' | 'down',
): PageLayout {
  return applyToLevel(layout, id, (blocks) => nudgeBlockInGrid(blocks, id, direction));
}

/**
 * Altera o span (largura 1..12) do bloco limitando ao espaço disponível até o próximo bloco
 * ou até o final da linha, evitando que o bloco pule para a linha de baixo ou desorganize os vizinhos.
 */
export function setBlockSpan(layout: PageLayout, id: string, span: number): PageLayout {
  return applyToLevel(layout, id, (blocks) => resizeBlockSpanInGrid(blocks, id, span));
}

/**
 * Altera o rowSpan do bloco pela borda inferior, empurrando automaticamente os blocos abaixo
 * para baixo (comportamento idêntico a quando o conteúdo de um bloco cresce).
 */
export function setBlockRowSpan(layout: PageLayout, id: string, rowSpan: number): PageLayout {
  return applyToLevel(layout, id, (blocks) => resizeBlockRowSpanInGrid(blocks, id, rowSpan));
}

/** Redimensiona a largura do bloco pela alça lateral esquerda (ancorando a borda direita). */
export function setBlockSpanLeft(layout: PageLayout, id: string, span: number): PageLayout {
  return applyToLevel(layout, id, (blocks) => resizeBlockLeftInGrid(blocks, id, span));
}

/** Redimensiona a altura do bloco pela alça superior (ancorando a borda inferior). */
export function setBlockRowSpanTop(
  layout: PageLayout,
  id: string,
  newY: number,
  newRowSpan: number,
): PageLayout {
  return applyToLevel(layout, id, (blocks) => resizeBlockTopInGrid(blocks, id, newY, newRowSpan));
}

export { canAcceptChildrenType, isContainerType, isInlineBlockType };

/** Insere `block` numa posição específica de um dos dois níveis. */
function insertAt(
  layout: PageLayout,
  block: PageBlock,
  parentId: string | undefined,
  index: number,
): PageLayout {
  if (!parentId) {
    const blocks = [...layout.blocks];
    blocks.splice(index, 0, block);
    return { ...layout, blocks };
  }
  return {
    ...layout,
    blocks: layout.blocks.map((b) => {
      if (b.id !== parentId) return b;
      const children = [...(b.children ?? [])];
      children.splice(index, 0, block);
      return { ...b, children };
    }),
  };
}

/** Move um bloco para onde foi solto, inclusive entrando e saindo de um container. */
export function moveBlock(
  layout: PageLayout,
  activeId: string,
  overId: string,
): PageLayout {
  if (activeId === overId) return layout;
  const from = findBlock(layout, activeId);
  const to = findBlock(layout, overId);
  if (!from || !to) return layout;

  const drop = resolveDrop(from, to);
  if (!drop) return layout;

  return drop.parentId === from.parentId
    ? reorderWithin(layout, from, to)
    : relocate(layout, from, to, drop);
}

/** Destino do arrasto, ou `null` quando ele é proibido. */
function resolveDrop(
  from: Located,
  to: Located,
): { parentId: string | undefined; intoContainer: boolean } | null {
  // Soltar sobre um container geral (`group`) ou soltar um micro-elemento (`text.rich`/`button.action`)
  // sobre qualquer bloco de topo que aceite filhos = entrar nele!
  const canEnterTarget =
    !to.parentId &&
    canAcceptChildrenType(to.block.type) &&
    !isContainerType(from.block.type) &&
    (isContainerType(to.block.type) || isInlineBlockType(from.block.type));

  const intoContainer = canEnterTarget;
  const parentId = intoContainer ? to.block.id : to.parentId;

  // Container dentro de container: o aninhamento é de um nível só.
  if (isContainerType(from.block.type) && parentId) return null;

  return { parentId, intoContainer };
}

/** Mesmo nível: só troca a ordem. */
function reorderWithin(
  layout: PageLayout,
  from: Located,
  to: Located,
): PageLayout {
  if (from.index === to.index) return layout;
  if (!from.parentId) {
    return { ...layout, blocks: arrayMove(layout.blocks, from.index, to.index) };
  }
  return {
    ...layout,
    blocks: layout.blocks.map((b) =>
      b.id === from.parentId
        ? { ...b, children: arrayMove(b.children ?? [], from.index, to.index) }
        : b,
    ),
  };
}

/** Troca de container: tira de onde estava e recalcula o índice já sem ele. */
function relocate(
  layout: PageLayout,
  from: Located,
  to: Located,
  drop: { parentId: string | undefined; intoContainer: boolean },
): PageLayout {
  const detached = removeBlock(layout, from.block.id);
  // Recusa silenciosa: no meio de um arrasto não há onde reclamar de teto estourado.
  if (!canAdd(detached, drop.parentId)) return layout;

  const index = drop.intoContainer
    ? (findBlock(detached, drop.parentId!)?.block.children?.length ?? 0)
    : (findBlock(detached, to.block.id)?.index ?? 0);

  return insertAt(detached, from.block, drop.parentId, index);
}

function isKnown(type: string): type is BlockType {
  return type in BLOCK_META;
}

export type DropPlacement = 'before' | 'after' | 'inside' | 'swap';

/** `true` se soltar `activeId` nessa posição do alvo é permitido. */
export function canDrop(
  layout: PageLayout,
  activeId: string,
  targetId: string,
  placement: DropPlacement,
): boolean {
  if (activeId === targetId) return false;
  const from = findBlock(layout, activeId);
  const to = findBlock(layout, targetId);
  if (!from || !to) return false;

  if (placement === 'inside') {
    // Qualquer bloco de topo (não-inline) pode receber filhos:
    // - `group` recebe qualquer bloco não-container;
    // - demais blocos (`chart.*`, `stat.card`, `table.basic`, etc.) recebem micro-elementos (`text.rich`, `button.action`).
    if (!canAcceptChildrenType(to.block.type) || to.parentId) return false;
    if (isContainerType(from.block.type)) return false;
    if (!isContainerType(to.block.type) && !isInlineBlockType(from.block.type)) return false;
    return from.parentId !== to.block.id;
  }

  if (placement === 'swap') {
    // Container não pode trocar de lugar com um bloco que está dentro de outro container.
    if (isContainerType(from.block.type) && to.parentId) return false;
    if (isContainerType(to.block.type) && from.parentId) return false;
    // Se um deles estiver dentro de um bloco que só aceita inline, o outro também precisa ser inline.
    if (to.parentId) {
      const toParent = findBlock(layout, to.parentId);
      if (toParent && !isContainerType(toParent.block.type) && !isInlineBlockType(from.block.type)) {
        return false;
      }
    }
    if (from.parentId) {
      const fromParent = findBlock(layout, from.parentId);
      if (fromParent && !isContainerType(fromParent.block.type) && !isInlineBlockType(to.block.type)) {
        return false;
      }
    }
    return true;
  }

  // Antes/depois herdam o nível do alvo: container não pode parar dentro de outro.
  if (isContainerType(from.block.type) && to.parentId) return false;
  if (to.parentId) {
    const toParent = findBlock(layout, to.parentId);
    if (toParent && !isContainerType(toParent.block.type) && !isInlineBlockType(from.block.type)) {
      return false;
    }
  }
  return true;
}

/** Move um bloco para um destino explícito (acima, dentro, abaixo ou trocar de posição/tamanho), definido pela zona do drop. */
export function moveBlockTo(
  layout: PageLayout,
  activeId: string,
  targetId: string,
  placement: DropPlacement,
): PageLayout {
  if (!canDrop(layout, activeId, targetId, placement)) return layout;
  const from = findBlock(layout, activeId)!;
  const to = findBlock(layout, targetId)!;

  if (placement === 'swap') {
    if (from.parentId === to.parentId) {
      if (!from.parentId) {
        return {
          ...layout,
          blocks: swapBlocksInGrid(layout.blocks, activeId, targetId),
        };
      }
      return {
        ...layout,
        blocks: layout.blocks.map((b) =>
          b.id === from.parentId
            ? { ...b, children: swapBlocksInGrid(b.children ?? [], activeId, targetId) }
            : b,
        ),
      };
    }

    // Troca entre níveis diferentes (ex: bloco dentro de group <-> bloco fora):
    // cada um assume a posição e o tamanho (span/rowSpan/x/y) do outro!
    const fromReplaced: PageBlock = {
      ...to.block,
      span: to.block.span,
      rowSpan: to.block.rowSpan,
      x: from.block.x,
      y: from.block.y,
    };
    const toReplaced: PageBlock = {
      ...from.block,
      span: from.block.span,
      rowSpan: from.block.rowSpan,
      x: to.block.x,
      y: to.block.y,
    };
    return mapBlocks(layout, (b) => {
      if (b.id === activeId) return fromReplaced;
      if (b.id === targetId) return toReplaced;
      return b;
    });
  }

  const parentId = placement === 'inside' ? to.block.id : to.parentId;
  const detached = removeBlock(layout, activeId);
  if (!canAdd(detached, parentId)) return layout;

  if (placement === 'inside') {
    const cleanBlock: PageBlock = { ...from.block, x: undefined, y: undefined };
    const children = findBlock(detached, to.block.id)?.block.children ?? [];
    return insertAt(detached, cleanBlock, parentId, children.length);
  }

  const targetIndex = findBlock(detached, targetId)?.index ?? 0;
  const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex;
  const reordered = insertAt(detached, from.block, parentId, insertIndex);

  // Se a lista de destino possuir coordenadas de grade (x, y), reempacota os blocos na nova ordem sequencial
  // garantindo fluxo contínuo, sem buracos, sem sobreposições e sem saltos de blocos!
  const targetList = parentId
    ? (findBlock(reordered, parentId)?.block.children ?? [])
    : reordered.blocks;
  const hasAnyGridCoords = targetList.some(
    (b) => typeof b.x === 'number' || typeof b.y === 'number',
  );

  if (hasAnyGridCoords) {
    const packedList = autoPackBlocks(targetList);
    if (!parentId) {
      return { ...reordered, blocks: packedList };
    }
    return {
      ...reordered,
      blocks: reordered.blocks.map((b) =>
        b.id === parentId ? { ...b, children: packedList } : b,
      ),
    };
  }

  return reordered;
}
