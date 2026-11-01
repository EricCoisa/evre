import {
  normalizeRowSpan,
  normalizeSpan,
  type BlockRowSpan,
  type BlockSpan,
  type PageBlock,
} from './schema';

export interface GridRect {
  x: number;
  y: number;
  span: BlockSpan;
  rowSpan: BlockRowSpan;
}

export interface PlacedBlock extends GridRect {
  block: PageBlock;
}

export interface EmptyGridSlot {
  x: number;
  y: number;
  span: BlockSpan;
  rowSpan: BlockRowSpan;
}

/** Verifica se dois retângulos na grade 2D se sobrepõem. */
export function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return (
    a.x < b.x + b.span &&
    a.x + a.span > b.x &&
    a.y < b.y + b.rowSpan &&
    a.y + a.rowSpan > b.y
  );
}

/** Encontra a primeira posição (x, y) livre na grade onde caiba (span, rowSpan). */
export function findFirstAvailableSlot(
  occupied: GridRect[],
  span: BlockSpan,
  rowSpan: BlockRowSpan,
  cols = 12,
  startY = 0,
): { x: number; y: number } {
  const safeSpan = Math.min(cols, span) as BlockSpan;
  for (let y = Math.max(0, startY); y < 100; y++) {
    for (let x = 0; x <= cols - safeSpan; x++) {
      const candidate: GridRect = { x, y, span: safeSpan, rowSpan };
      if (!occupied.some((r) => rectsOverlap(candidate, r))) {
        return { x, y };
      }
    }
  }
  return { x: 0, y: occupied.length };
}

/**
 * Calcula a posição 2D (x, y, span, rowSpan) de cada bloco:
 * - Respeita coordenadas (x, y) já definidas no bloco quando não colidem;
 * - Encaixa automaticamente blocos sem coordenadas no primeiro espaço suficiente (Bento Auto-Pack).
 */
/**
 * Estima o número exato de linhas de grade (44px + 16px gap) necessárias para acomodar o texto
 * com base na quantidade real de caracteres por linha da coluna e quebras de linha,
 * evitando sobrar espaço vazio excessivo.
 */
export function estimateTextRowSpan(content: string, span = 12): BlockRowSpan {
  if (!content || !content.trim()) return 1;

  // Ignora quebras de linha em branco no final causadas pelo cursor no editor
  const trimmed = content.replace(/\n+$/, '');
  const lines = trimmed.split('\n');

  // Em 12 colunas (~1100px), cabem ~110 caracteres. Em 3 colunas (~270px), cabem ~28 caracteres.
  const charsPerLine = Math.max(26, Math.round((span / 12) * 110));

  let visualLinesCount = 0;
  for (const line of lines) {
    if (line.trim().length === 0) {
      visualLinesCount += 0.5;
    } else {
      visualLinesCount += Math.max(1, Math.ceil(line.length / charsPerLine));
    }
  }

  const hasHeading = /^#{1,4}\s/m.test(trimmed);
  // Cada linha de texto visual tem ~22px (font-size 14px + leading 1.6).
  const totalContentHeight = visualLinesCount * 22 + (hasHeading ? 16 : 0);

  // Primeira linha de grid tem 44px; cada linha extra adiciona 60px (44px + 16px gap).
  if (totalContentHeight <= 48) return 1;
  const neededRows = 1 + Math.ceil((totalContentHeight - 48) / 60);

  return normalizeRowSpan(neededRows, 'text.rich');
}

/**
 * Remove linhas inteiras (12 colunas) vazias na grade, puxando os blocos subsequentes para cima
 * para evitar buracos quando o conteúdo de um bloco acima for apagado ou reduzido.
 */
export function compactEmptyRows(placed: PlacedBlock[], cols = 12): PlacedBlock[] {
  if (placed.length === 0) return placed;
  const maxRow = placed.reduce((max, p) => Math.max(max, p.y + p.rowSpan), 0);

  let current = placed;
  for (let y = maxRow - 1; y >= 0; y--) {
    const hasAnyBlockInRow = current.some(
      (p) => y >= p.y && y < p.y + p.rowSpan,
    );
    const hasBlockBelow = current.some((p) => p.y > y);
    if (!hasAnyBlockInRow && hasBlockBelow) {
      current = current.map((p) => (p.y > y ? { ...p, y: p.y - 1 } : p));
    }
  }

  return current;
}

/**
 * Converte uma altura estimada em pixels (considerando padding de card e elementos internos)
 * para o número correspondente de linhas de grade (base 44px + 60px por linha adicional).
 */
export function pixelsToRowSpan(pixels: number, type?: string): BlockRowSpan {
  if (pixels <= 48) return normalizeRowSpan(1, type);
  const neededRows = 1 + Math.ceil((pixels - 48) / 60);
  return normalizeRowSpan(neededRows, type);
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
  const hasHeader = Boolean(block.props?.title || block.props?.description);
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
  const hasHeader = Boolean(block.props?.title || block.props?.description);
  const count = extractDataBlockItemCount(block, 5);
  const totalHeight = 48 + (hasHeader ? 64 : 0) + 40 + count * 40 + 48;
  return pixelsToRowSpan(totalHeight, 'table.basic');
}

/**
 * Estima a altura necessária para o bloco topic (itens de escopo em proposta).
 */
export function estimateTopicRowSpan(block: PageBlock): BlockRowSpan {
  const hasHeader = Boolean(block.props?.title || block.props?.description);
  const items = Array.isArray(block.props?.items) ? block.props.items : [];
  const count = Math.max(1, items.length);
  const totalHeight = 48 + (hasHeader ? 64 : 0) + count * 36;
  return pixelsToRowSpan(totalHeight, 'topic');
}

/**
 * Estima a altura necessária para o bloco price (tabela de valores em proposta).
 */
export function estimatePriceRowSpan(block: PageBlock): BlockRowSpan {
  const hasHeader = Boolean(block.props?.title || block.props?.description);
  const rows = Array.isArray(block.props?.rows) ? block.props.rows : [];
  const count = Math.max(1, rows.length);
  const totalHeight = 48 + (hasHeader ? 64 : 0) + count * 40 + 54;
  return pixelsToRowSpan(totalHeight, 'price');
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
    return estimateTextRowSpan(content, span);
  },
  'list.feed': estimateFeedRowSpan,
  'table.basic': estimateTableRowSpan,
  topic: estimateTopicRowSpan,
  price: estimatePriceRowSpan,
};

/**
 * Calcula a altura mínima necessária para um bloco com base no seu conteúdo e filhos:
 * - Para containers (ex: `group`): expande automaticamente para abraçar os filhos + cabeçalho;
 * - Para blocos de conteúdo variável (`list.feed`, `table.basic`, `text.rich`, etc.): calcula
 *   a altura exata para comportar itens, textos e paginação sem truncar nem sobrepor;
 * - Respeita o rowSpan explicitamente definido pelo usuário quando for maior.
 */
export function calculateEffectiveRowSpan(block: PageBlock, cols = 12): BlockRowSpan {
  let minNeeded = normalizeRowSpan(block.rowSpan, block.type);

  // 1. Containers (group ou qualquer bloco com children): abraça a altura total dos filhos
  if (block.children && block.children.length > 0) {
    const placedChildren = resolveGridLayout(block.children, cols);
    const maxChildBottom = Math.max(0, ...placedChildren.map((c) => c.y + c.rowSpan));
    const hasTitle = Boolean(block.props?.title);
    const hasDesc = Boolean(block.props?.description);
    const headerRows = hasTitle && hasDesc ? 2 : hasTitle || hasDesc ? 1 : 0;
    const containerNeeded = maxChildBottom + headerRows;
    minNeeded = normalizeRowSpan(Math.max(minNeeded, containerNeeded), block.type);
  }

  // 2. Estimador agnóstico por tipo de bloco (baseado no conteúdo, props e parâmetros de dados)
  const estimator = BLOCK_ROW_SPAN_ESTIMATORS[block.type];
  if (estimator) {
    const contentNeeded = estimator(block, cols);
    minNeeded = normalizeRowSpan(Math.max(minNeeded, contentNeeded), block.type);
  }

  return minNeeded;
}

export function resolveGridLayout(blocks: PageBlock[], cols = 12): PlacedBlock[] {
  const occupied: GridRect[] = [];
  const result: PlacedBlock[] = [];

  for (const block of blocks) {
    const span = normalizeSpan(block.span);
    const rowSpan = calculateEffectiveRowSpan(block, cols);
    const hasExplicitCoords =
      typeof block.x === 'number' &&
      typeof block.y === 'number' &&
      Number.isInteger(block.x) &&
      Number.isInteger(block.y);

    let x = 0;
    let y = 0;

    if (hasExplicitCoords) {
      const clampedX = Math.max(0, Math.min(cols - span, block.x!));
      const clampedY = Math.max(0, block.y!);
      const desired: GridRect = { x: clampedX, y: clampedY, span, rowSpan };

      if (!occupied.some((r) => rectsOverlap(desired, r))) {
        x = clampedX;
        y = clampedY;
      } else {
        // Mantém a coluna desejada e desce até a primeira linha livre nessa coluna
        let testY = clampedY + 1;
        while (
          testY < 100 &&
          occupied.some((r) =>
            rectsOverlap({ x: clampedX, y: testY, span, rowSpan }, r),
          )
        ) {
          testY++;
        }
        x = clampedX;
        y = testY;
      }
    } else {
      const slot = findFirstAvailableSlot(occupied, span, rowSpan, cols);
      x = slot.x;
      y = slot.y;
    }

    const placed: PlacedBlock = { block, x, y, span, rowSpan };
    occupied.push({ x, y, span, rowSpan });
    result.push(placed);
  }

  return result;
}

/**
 * Descobre todos os espaços livres na grade (inclusive buracos ao lado ou abaixo de blocos)
 * para que o usuário possa arrastar e encaixar blocos livremente onde houver espaço.
 */
export function findEmptyGridSlots(
  placed: PlacedBlock[],
  cols = 12,
  includeExtraRow = false,
): EmptyGridSlot[] {
  if (placed.length === 0) return [];

  const maxRow = placed.reduce((max, p) => Math.max(max, p.y + p.rowSpan), 0);
  const totalRows = includeExtraRow ? maxRow + 1 : maxRow;
  const slots: EmptyGridSlot[] = [];

  for (let y = 0; y < totalRows; y++) {
    // Marca quais colunas [0..cols-1] estão ocupadas na linha `y`
    const colOccupied = new Array<boolean>(cols).fill(false);
    for (const p of placed) {
      if (y >= p.y && y < p.y + p.rowSpan) {
        for (let c = p.x; c < Math.min(cols, p.x + p.span); c++) {
          colOccupied[c] = true;
        }
      }
    }

    // Agrupa colunas livres contíguas
    let c = 0;
    while (c < cols) {
      if (colOccupied[c]) {
        c++;
        continue;
      }
      const startX = c;
      while (c < cols && !colOccupied[c]) {
        c++;
      }
      const freeWidth = c - startX;

      // Se a linha inteira (12 colunas) está livre, divide em 2 slots de 6 colunas (esq e dir)
      // para permitir soltar tanto na esquerda quanto na direita!
      if (freeWidth === 12) {
        slots.push({ x: 0, y, span: 6, rowSpan: 1 });
        slots.push({ x: 6, y, span: 6, rowSpan: 1 });
      } else if (freeWidth >= 8) {
        const half = Math.floor(freeWidth / 2) as BlockSpan;
        const rest = (freeWidth - half) as BlockSpan;
        slots.push({ x: startX, y, span: half, rowSpan: 1 });
        slots.push({ x: startX + half, y, span: rest, rowSpan: 1 });
      } else {
        // Verifica se este buraco vazio em `y` está sendo dividido em 2 pedaços diferentes
        // por blocos na linha de cima (`y - 1`), por exemplo: um Texto (`x=0, span=2`) em `y=0`
        // e um espaço vazio ao lado (`x=2, span=2`). Se sim, divide os slots em `y=1` para que
        // o vácuo abaixo do Texto (`x=0, y=1, span=2`) apareça separadamente como slot preenchível!
        const blockAboveAtStart =
          y > 0
            ? placed.find(
                (p) =>
                  p.x === startX &&
                  p.y + p.rowSpan === y &&
                  p.span < freeWidth,
              )
            : undefined;

        if (blockAboveAtStart) {
          const firstSpan = blockAboveAtStart.span;
          const restSpan = (freeWidth - firstSpan) as BlockSpan;
          slots.push({ x: startX, y, span: firstSpan, rowSpan: 1 });
          slots.push({ x: startX + firstSpan, y, span: restSpan, rowSpan: 1 });
        } else {
          slots.push({
            x: startX,
            y,
            span: Math.max(1, Math.min(12, freeWidth)) as BlockSpan,
            rowSpan: 1,
          });
        }
      }
    }
  }

  return slots;
}

/**
 * Troca dois blocos de lugar e de tamanho (`x`, `y`, `span`, `rowSpan`).
 * Como os dois blocos assumem exatamente a geometria um do outro, nenhum outro bloco
 * na página é empurrado ou desorganizado!
 */
export function swapBlocksInGrid(
  blocks: PageBlock[],
  idA: string,
  idB: string,
  cols = 12,
): PageBlock[] {
  if (idA === idB) return blocks;
  const placed = resolveGridLayout(blocks, cols);
  const a = placed.find((p) => p.block.id === idA);
  const b = placed.find((p) => p.block.id === idB);
  if (!a || !b) return blocks;

  // Identifica qual bloco está acima (top) e qual está abaixo (bottom)
  const isABeforeB = a.y < b.y || (a.y === b.y && a.x < b.x);
  const top = isABeforeB ? a : b;
  const bottom = isABeforeB ? b : a;

  let nextPlaced: PlacedBlock[];

  if (top.y === bottom.y) {
    // Caso 1: Mesma linha vertical — troca horizontal simples de colunas
    const targetXTop = Math.max(0, Math.min(cols - top.span, bottom.x));
    const targetXBottom = Math.max(0, Math.min(cols - bottom.span, top.x));

    nextPlaced = placed.map((p) => {
      if (p.block.id === top.block.id) {
        return { ...p, x: targetXTop, y: top.y, span: top.span, rowSpan: top.rowSpan };
      }
      if (p.block.id === bottom.block.id) {
        return { ...p, x: targetXBottom, y: bottom.y, span: bottom.span, rowSpan: bottom.rowSpan };
      }
      return p;
    });
  } else {
    // Caso 2: Linhas verticais diferentes — troca de ordem no fluxo vertical
    const hTop = top.rowSpan;
    const hBottom = bottom.rowSpan;
    const deltaH = hBottom - hTop;

    const topStartY = top.y;
    const topEndY = top.y + top.rowSpan;
    const bottomStartY = bottom.y;

    nextPlaced = placed.map((p) => {
      // O bloco de baixo sobe para o topo
      if (p.block.id === bottom.block.id) {
        const targetX = Math.max(0, Math.min(cols - bottom.span, top.x));
        return {
          ...p,
          x: targetX,
          y: topStartY,
          span: bottom.span,
          rowSpan: bottom.rowSpan,
        };
      }

      // O bloco de cima desce para a posição de baixo, ajustado por deltaH
      if (p.block.id === top.block.id) {
        const targetX = Math.max(0, Math.min(cols - top.span, bottom.x));
        return {
          ...p,
          x: targetX,
          y: bottomStartY + deltaH,
          span: top.span,
          rowSpan: top.rowSpan,
        };
      }

      // Blocos intermediários entre top e bottom deslizam por deltaH
      if (p.y >= topEndY && p.y < bottomStartY) {
        return {
          ...p,
          y: Math.max(0, p.y + deltaH),
        };
      }

      // Demais blocos permanecem inalterados
      return p;
    });
  }

  // Troca a ordem dos dois blocos no array para que o bloco que subiu tenha prioridade de resolução
  const idxTop = nextPlaced.findIndex((p) => p.block.id === top.block.id);
  const idxBottom = nextPlaced.findIndex((p) => p.block.id === bottom.block.id);
  if (idxTop !== -1 && idxBottom !== -1) {
    const temp = nextPlaced[idxTop];
    nextPlaced[idxTop] = nextPlaced[idxBottom];
    nextPlaced[idxBottom] = temp;
  }

  // Re-resolve para garantir ordenação limpa e sem sobreposições
  const resolved = resolveGridLayout(
    nextPlaced.map((p) => ({
      ...p.block,
      x: p.x,
      y: p.y,
      span: p.span,
      rowSpan: p.rowSpan,
    })),
    cols,
  );

  // Compacta quaisquer linhas vazias órfãs para garantir que nunca sobrem buracos
  const compacted = compactEmptyRows(resolved, cols);
  return persistPlacedBlocks(compacted);
}

/**
 * Move um bloco para uma coordenada (targetX, targetY) específica da grade 2D.
 * - Se o espaço estiver livre, posiciona o bloco exatamente lá sem mover os demais.
 * - Se colidir com um bloco, faz a troca direta de lugar e de tamanho (swap) sem empurrar os demais.
 * - Caso contrário, empurra os blocos colidentes para baixo sem sobreposição.
 */
export function moveBlockToCell(
  blocks: PageBlock[],
  activeId: string,
  targetX: number,
  targetY: number,
  cols = 12,
): PageBlock[] {
  const placed = resolveGridLayout(blocks, cols);
  const activeIdx = placed.findIndex((p) => p.block.id === activeId);
  if (activeIdx === -1) return blocks;

  const active = placed[activeIdx];
  const clampedX = Math.max(0, Math.min(cols - active.span, targetX));
  const clampedY = Math.max(0, targetY);

  if (active.x === clampedX && active.y === clampedY) {
    return persistPlacedBlocks(placed);
  }

  const targetRect: GridRect = {
    x: clampedX,
    y: clampedY,
    span: active.span,
    rowSpan: active.rowSpan,
  };

  const others = placed.filter((_, idx) => idx !== activeIdx);
  const colliding = others.filter((o) => rectsOverlap(targetRect, o));

  // Caso 1: Espaço livre! Encaixa direto na posição desejada sem alterar os demais.
  if (colliding.length === 0) {
    const updated: PlacedBlock[] = placed.map((p, idx) =>
      idx === activeIdx ? { ...p, x: clampedX, y: clampedY } : p,
    );
    return persistPlacedBlocks(updated);
  }

  // Caso 2: Colide com outro(s) bloco(s) -> escolhe o bloco com maior interseção (ou mais próximo)
  // e troca de lugar e de tamanho com ele, garantindo zero desorganização dos vizinhos!
  const bestCandidate = [...colliding].sort((a, b) => {
    const overlapA =
      Math.max(0, Math.min(targetRect.x + targetRect.span, a.x + a.span) - Math.max(targetRect.x, a.x)) *
      Math.max(0, Math.min(targetRect.y + targetRect.rowSpan, a.y + a.rowSpan) - Math.max(targetRect.y, a.y));
    const overlapB =
      Math.max(0, Math.min(targetRect.x + targetRect.span, b.x + b.span) - Math.max(targetRect.x, b.x)) *
      Math.max(0, Math.min(targetRect.y + targetRect.rowSpan, b.y + b.rowSpan) - Math.max(targetRect.y, b.y));
    return overlapB - overlapA;
  })[0];

  if (bestCandidate) {
    return swapBlocksInGrid(blocks, activeId, bestCandidate.block.id, cols);
  }

  return persistPlacedBlocks(placed);
}

/**
 * Move um bloco 1 passo na direção 2D escolhida (left, right, up, down):
 * - Se houver um bloco vizinho na direção escolhida, TROCA DE LUGAR E DE TAMANHO com ele
 *   (ex: mover um card 50% para cima onde há 3 cards de 33% troca o card de 50% com o card de 33% correspondente, sem empurrar os outros).
 * - Se o espaço na direção escolhida estiver vazio, move o bloco para o espaço vazio.
 */
export function nudgeBlockInGrid(
  blocks: PageBlock[],
  id: string,
  direction: 'left' | 'right' | 'up' | 'down',
  cols = 12,
): PageBlock[] {
  const placed = resolveGridLayout(blocks, cols);
  const target = placed.find((p) => p.block.id === id);
  if (!target) return blocks;

  const others = placed.filter((p) => p.block.id !== id);
  const targetCenterX = target.x + target.span / 2;

  if (direction === 'left') {
    // Procura vizinho à esquerda na mesma faixa vertical
    const leftNeighbors = others
      .filter(
        (o) =>
          o.y < target.y + target.rowSpan &&
          o.y + o.rowSpan > target.y &&
          o.x + o.span <= target.x,
      )
      .sort((a, b) => b.x + b.span - (a.x + a.span));

    const immediateLeft = leftNeighbors[0];
    // Se está encostado no vizinho da esquerda, troca de lugar e de tamanho com ele
    if (immediateLeft && immediateLeft.x + immediateLeft.span === target.x) {
      return swapBlocksInGrid(blocks, id, immediateLeft.block.id, cols);
    }

    // Caso contrário, move para o espaço vazio à esquerda
    const minFreeX = immediateLeft ? immediateLeft.x + immediateLeft.span : 0;
    const stepX = target.span <= 6 ? target.span : 3;
    const nextX = Math.max(minFreeX, target.x - stepX);
    return moveBlockToCell(blocks, id, nextX, target.y, cols);
  }

  if (direction === 'right') {
    // Procura vizinho à direita na mesma faixa vertical
    const rightNeighbors = others
      .filter(
        (o) =>
          o.y < target.y + target.rowSpan &&
          o.y + o.rowSpan > target.y &&
          o.x >= target.x + target.span,
      )
      .sort((a, b) => a.x - b.x);

    const immediateRight = rightNeighbors[0];
    // Se está encostado no vizinho da direita, troca de lugar e de tamanho com ele
    if (immediateRight && immediateRight.x === target.x + target.span) {
      return swapBlocksInGrid(blocks, id, immediateRight.block.id, cols);
    }

    // Caso contrário, move para o espaço vazio à direita
    const maxFreeRight = immediateRight ? immediateRight.x : cols;
    const stepX = target.span <= 6 ? target.span : 3;
    const nextX = Math.min(maxFreeRight - target.span, target.x + stepX);
    return moveBlockToCell(blocks, id, nextX, target.y, cols);
  }

  if (direction === 'up') {
    if (target.y === 0) return blocks;
    const stepUp = Math.min(target.y, target.rowSpan);
    const desiredY = target.y - stepUp;
    const probe: GridRect = {
      x: target.x,
      y: desiredY,
      span: target.span,
      rowSpan: target.rowSpan,
    };
    const collidingAbove = others.filter((o) => rectsOverlap(probe, o));

    // Se a faixa de cima está livre nessa coluna, sobe para o espaço vazio
    if (collidingAbove.length === 0) {
      return moveBlockToCell(blocks, id, target.x, desiredY, cols);
    }

    // Se há blocos na faixa de cima (ex: 3 cards de 33% acima de 2 cards de 50%),
    // escolhe o bloco mais alinhado horizontalmente e TROCA DE LUGAR E DE TAMANHO com ele!
    const bestAbove = [...collidingAbove].sort((a, b) => {
      const distA = Math.abs(a.x + a.span / 2 - targetCenterX);
      const distB = Math.abs(b.x + b.span / 2 - targetCenterX);
      return distA - distB;
    })[0];

    return swapBlocksInGrid(blocks, id, bestAbove.block.id, cols);
  }

  if (direction === 'down') {
    const desiredY = target.y + target.rowSpan;
    const probe: GridRect = {
      x: target.x,
      y: desiredY,
      span: target.span,
      rowSpan: target.rowSpan,
    };
    const collidingBelow = others.filter((o) => rectsOverlap(probe, o));

    // Se a faixa de baixo está livre nessa coluna, desce para o espaço vazio
    if (collidingBelow.length === 0) {
      return moveBlockToCell(blocks, id, target.x, desiredY, cols);
    }

    // Se há blocos na faixa de baixo, escolhe o mais alinhado horizontalmente e TROCA DE LUGAR E DE TAMANHO!
    const bestBelow = [...collidingBelow].sort((a, b) => {
      const distA = Math.abs(a.x + a.span / 2 - targetCenterX);
      const distB = Math.abs(b.x + b.span / 2 - targetCenterX);
      return distA - distB;
    })[0];

    return swapBlocksInGrid(blocks, id, bestBelow.block.id, cols);
  }

  return blocks;
}

/**
 * Calcula a largura máxima (`maxSpan`) e a altura máxima (`maxRowSpan`) que um bloco
 * pode atingir na sua posição atual SEM colidir com blocos vizinhos e SEM pular de linha
 * (evitando o efeito frustrante de "empurrar/desorganizar" o layout ao redimensionar).
 */
export function getMaxResizeBounds(
  blocks: PageBlock[],
  id: string,
  cols = 12,
): { maxSpan: BlockSpan; maxRowSpan: BlockRowSpan } {
  const placed = resolveGridLayout(blocks, cols);
  const target = placed.find((p) => p.block.id === id);
  if (!target) return { maxSpan: cols as BlockSpan, maxRowSpan: 24 };

  const others = placed.filter((p) => p.block.id !== id);

  // 1. Limite horizontal (maxSpan): da coluna `target.x` até a borda da grade (cols)
  // ou até encostar no primeiro bloco à direita que ocupe alguma das mesmas linhas.
  let maxRight = cols;
  for (const other of others) {
    const overlapsVertically =
      target.y < other.y + other.rowSpan && target.y + target.rowSpan > other.y;
    if (overlapsVertically && other.x >= target.x + target.span) {
      maxRight = Math.min(maxRight, other.x);
    }
  }
  const maxSpan = normalizeSpan(Math.max(target.span, maxRight - target.x));

  // 2. Limite vertical (maxRowSpan): da linha `target.y` até o limite (8)
  // ou até encostar no primeiro bloco abaixo que ocupe alguma das mesmas colunas.
  let maxBottom = target.y + 24;
  for (const other of others) {
    const overlapsHorizontally =
      target.x < other.x + other.span && target.x + target.span > other.x;
    if (overlapsHorizontally && other.y >= target.y + target.rowSpan) {
      maxBottom = Math.min(maxBottom, other.y);
    }
  }
  const maxRowSpan = normalizeRowSpan(
    Math.max(target.rowSpan, maxBottom - target.y),
    target.block.type,
  );

  return { maxSpan, maxRowSpan };
}

/**
 * Redimensiona a largura (`span`) de um bloco pela borda ESQUERDA:
 * - Ancora a borda direita (`rightEdge = target.x + target.span`) e desloca `x` para a esquerda/direita.
 * - Limita o crescimento à esquerda pela coluna `0` ou pela borda direita de um bloco vizinho à esquerda.
 */
export function resizeBlockLeftInGrid(
  blocks: PageBlock[],
  id: string,
  desiredSpan: number,
  cols = 12,
): PageBlock[] {
  const placed = resolveGridLayout(blocks, cols);
  const target = placed.find((p) => p.block.id === id);
  if (!target) return blocks;

  const others = placed.filter((p) => p.block.id !== id);
  const rightEdge = target.x + target.span;

  let minLeft = 0;
  for (const other of others) {
    const overlapsVertically =
      target.y < other.y + other.rowSpan && target.y + target.rowSpan > other.y;
    if (overlapsVertically && other.x + other.span <= target.x) {
      minLeft = Math.max(minLeft, other.x + other.span);
    }
  }

  const maxSpanLeft = Math.max(target.span, rightEdge - minLeft);
  const clampedSpan = normalizeSpan(Math.min(Math.max(1, desiredSpan), maxSpanLeft));
  const nextX = Math.max(minLeft, rightEdge - clampedSpan);

  return placed.map((p) => ({
    ...p.block,
    x: p.block.id === id ? nextX : p.x,
    y: p.y,
    span: p.block.id === id ? clampedSpan : p.span,
    rowSpan: p.rowSpan,
  }));
}

/**
 * Redimensiona a altura (`rowSpan`) de um bloco pela borda SUPERIOR:
 * - Ancora a borda inferior (`bottomEdge = target.y + target.rowSpan`) e desloca `y` para cima/baixo.
 * - Limita o crescimento acima pela linha `0` ou pela borda inferior de um bloco acima.
 */
export function resizeBlockTopInGrid(
  blocks: PageBlock[],
  id: string,
  desiredRowSpan: number,
  cols = 12,
): PageBlock[] {
  // Redimensiona a escala de altura sem alterar a posição (y) do bloco
  return resizeBlockRowSpanInGrid(blocks, id, desiredRowSpan, cols);
}

/**
 * Redimensiona a largura (`span`) de um bloco fixando as coordenadas 2D de todos os blocos
 * e limitando o crescimento ao espaço disponível até o próximo bloco ou fim da linha.
 * Nunca faz o bloco pular para a linha de baixo nem desorganiza os blocos vizinhos.
 */
export function resizeBlockSpanInGrid(
  blocks: PageBlock[],
  id: string,
  desiredSpan: number,
  cols = 12,
): PageBlock[] {
  const placed = resolveGridLayout(blocks, cols);
  const target = placed.find((p) => p.block.id === id);
  if (!target) return blocks;

  const { maxSpan } = getMaxResizeBounds(blocks, id, cols);
  const clampedSpan = normalizeSpan(Math.min(desiredSpan, maxSpan));

  return placed.map((p) => ({
    ...p.block,
    x: p.x,
    y: p.y,
    span: p.block.id === id ? clampedSpan : p.span,
    rowSpan: p.rowSpan,
  }));
}

/**
 * Redimensiona a altura (`rowSpan`) de um bloco fixando as coordenadas 2D de todos os blocos
 * e limitando o crescimento ao espaço vertical livre até o próximo bloco abaixo.
 */
export function resizeBlockRowSpanInGrid(
  blocks: PageBlock[],
  id: string,
  desiredRowSpan: number,
  cols = 12,
): PageBlock[] {
  const placed = resolveGridLayout(blocks, cols);
  const target = placed.find((p) => p.block.id === id);
  if (!target) return blocks;

  const { maxRowSpan } = getMaxResizeBounds(blocks, id, cols);
  const clampedRowSpan = normalizeRowSpan(
    Math.min(desiredRowSpan, maxRowSpan),
    target.block.type,
  );

  return placed.map((p) => ({
    ...p.block,
    x: p.x,
    y: p.y,
    span: p.span,
    rowSpan: p.block.id === id ? clampedRowSpan : p.rowSpan,
  }));
}

/** Grava x, y, span e rowSpan nos blocos e ordena de forma estável para leitura/mobile. */
function persistPlacedBlocks(placed: PlacedBlock[]): PageBlock[] {
  const sorted = [...placed].sort((a, b) => a.y - b.y || a.x - b.x);
  return sorted.map((p) => ({
    ...p.block,
    x: p.x,
    y: p.y,
    span: p.span,
    rowSpan: p.rowSpan,
  }));
}

