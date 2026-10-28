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
export function resolveGridLayout(blocks: PageBlock[], cols = 12): PlacedBlock[] {
  const occupied: GridRect[] = [];
  const result: PlacedBlock[] = [];

  for (const block of blocks) {
    const span = normalizeSpan(block.span);
    const rowSpan = normalizeRowSpan(block.rowSpan, block.type);
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

  const swapped: PlacedBlock[] = placed.map((p) => {
    if (p.block.id === idA) {
      return {
        ...p,
        x: b.x,
        y: b.y,
        span: b.span,
        rowSpan: normalizeRowSpan(b.rowSpan, p.block.type),
      };
    }
    if (p.block.id === idB) {
      return {
        ...p,
        x: a.x,
        y: a.y,
        span: a.span,
        rowSpan: normalizeRowSpan(a.rowSpan, p.block.type),
      };
    }
    return p;
  });

  return persistPlacedBlocks(swapped);
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
  if (!target) return { maxSpan: cols as BlockSpan, maxRowSpan: 8 };

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
  let maxBottom = target.y + 8;
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
  const placed = resolveGridLayout(blocks, cols);
  const target = placed.find((p) => p.block.id === id);
  if (!target) return blocks;

  const others = placed.filter((p) => p.block.id !== id);
  const bottomEdge = target.y + target.rowSpan;

  let minTop = 0;
  for (const other of others) {
    const overlapsHorizontally =
      target.x < other.x + other.span && target.x + target.span > other.x;
    if (overlapsHorizontally && other.y + other.rowSpan <= target.y) {
      minTop = Math.max(minTop, other.y + other.rowSpan);
    }
  }

  const maxRowSpanTop = Math.min(8, Math.max(target.rowSpan, bottomEdge - minTop));
  const clampedRowSpan = normalizeRowSpan(
    Math.min(Math.max(1, desiredRowSpan), maxRowSpanTop),
    target.block.type,
  );
  const nextY = Math.max(minTop, bottomEdge - clampedRowSpan);

  return placed.map((p) => ({
    ...p.block,
    x: p.x,
    y: p.block.id === id ? nextY : p.y,
    span: p.span,
    rowSpan: p.block.id === id ? clampedRowSpan : p.rowSpan,
  }));
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

