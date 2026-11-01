import { describe, it, expect } from 'vitest';
import { PageLayoutSchema, type PageLayout } from './schema';
import {
  resolveGridLayout,
  findEmptyGridSlots,
  getMaxResizeBounds,
  calculateEffectiveRowSpan,
  estimateFeedRowSpan,
  estimateTableRowSpan,
  estimateTopicRowSpan,
  estimatePriceRowSpan,
} from './grid-engine';
import {
  findBlock,
  moveBlockTo,
  moveBlockToGrid,
  nudgeBlockGrid,
  setBlockSpan,
  setBlockSpanLeft,
  setBlockRowSpan,
  setBlockRowSpanTop,
} from './editor/mutations';

describe('2D Bento Grid Engine — movimentação livre em espaços disponíveis', () => {
  it('permite encaixar 3 blocos em formato L / Bento (ex: 1 bloco alto na esquerda e 2 empilhados na direita, ou mover para espaço vazio inferior direito)', () => {
    const threeBlocks: PageLayout = {
      v: 1,
      blocks: [
        { id: 'card1', type: 'stat.card', span: 6, rowSpan: 1, props: {} },
        { id: 'card2', type: 'stat.card', span: 6, rowSpan: 1, props: {} },
        { id: 'alert1', type: 'group', span: 6, rowSpan: 2, props: {} },
      ],
    };

    // Inicialmente: card1 em (0,0), card2 em (6,0), alert1 em (0,1) ocupando 2 linhas
    const initialPlaced = resolveGridLayout(threeBlocks.blocks);
    expect(initialPlaced.find((p) => p.block.id === 'card1')).toMatchObject({ x: 0, y: 0, span: 6, rowSpan: 1 });
    expect(initialPlaced.find((p) => p.block.id === 'card2')).toMatchObject({ x: 6, y: 0, span: 6, rowSpan: 1 });
    expect(initialPlaced.find((p) => p.block.id === 'alert1')).toMatchObject({ x: 0, y: 1, span: 6, rowSpan: 2 });

    // Verifica que o motor detecta o espaço vazio abaixo de card2 em (6, 1)
    const emptySlots = findEmptyGridSlots(initialPlaced, 12, false);
    expect(emptySlots.some((s) => s.x === 6 && s.y === 1 && s.span === 6)).toBe(true);

    // Move card2 para o espaço vazio inferior direito (x=6, y=1)
    const moved = moveBlockToGrid(threeBlocks, 'card2', 6, 1);
    const card2After = findBlock(moved, 'card2')!.block;
    expect(card2After.x).toBe(6);
    expect(card2After.y).toBe(1);
    expect(PageLayoutSchema.safeParse(moved).success).toBe(true);
  });

  it('permite empilhar dois cards na direita ao lado de um bloco alto (rowSpan=2) na esquerda', () => {
    const stackedRight: PageLayout = {
      v: 1,
      blocks: [
        { id: 'tallLeft', type: 'group', span: 6, rowSpan: 2, x: 0, y: 0, props: {} },
        { id: 'cardTopRight', type: 'stat.card', span: 6, rowSpan: 1, x: 6, y: 0, props: {} },
        { id: 'cardBottomRight', type: 'stat.card', span: 6, rowSpan: 1, x: 6, y: 1, props: {} },
      ],
    };

    const placed = resolveGridLayout(stackedRight.blocks);
    expect(placed.find((p) => p.block.id === 'tallLeft')).toMatchObject({ x: 0, y: 0, span: 6, rowSpan: 2 });
    expect(placed.find((p) => p.block.id === 'cardTopRight')).toMatchObject({ x: 6, y: 0, span: 6, rowSpan: 1 });
    expect(placed.find((p) => p.block.id === 'cardBottomRight')).toMatchObject({ x: 6, y: 1, span: 6, rowSpan: 1 });
    expect(PageLayoutSchema.safeParse(stackedRight).success).toBe(true);
  });

  it('nudgeBlockGrid move o bloco nas 4 direções quando há espaço livre (left, right, up, down)', () => {
    const start: PageLayout = {
      v: 1,
      blocks: [
        { id: 'b1', type: 'stat.card', span: 6, rowSpan: 1, x: 0, y: 0, props: {} },
      ],
    };

    const right = nudgeBlockGrid(start, 'b1', 'right');
    expect(findBlock(right, 'b1')!.block).toMatchObject({ x: 6, y: 0 });

    const down = nudgeBlockGrid(right, 'b1', 'down');
    expect(findBlock(down, 'b1')!.block).toMatchObject({ x: 6, y: 1 });

    const left = nudgeBlockGrid(down, 'b1', 'left');
    expect(findBlock(left, 'b1')!.block).toMatchObject({ x: 0, y: 1 });

    const up = nudgeBlockGrid(left, 'b1', 'up');
    expect(findBlock(up, 'b1')!.block).toMatchObject({ x: 0, y: 0 });
  });
});

describe('Troca de lugar e de tamanho (Swap) — setas e overlay de drag', () => {
  const threePlusTwo = (): PageLayout => ({
    v: 1,
    blocks: [
      { id: 'c1', type: 'stat.card', span: 4, rowSpan: 1, props: { label: 'Card 1 (33%)' } },
      { id: 'c2', type: 'stat.card', span: 4, rowSpan: 1, props: { label: 'Card 2 (33%)' } },
      { id: 'c3', type: 'stat.card', span: 4, rowSpan: 1, props: { label: 'Card 3 (33%)' } },
      { id: 'c4', type: 'stat.card', span: 6, rowSpan: 1, props: { label: 'Card 4 (50%)' } },
      { id: 'c5', type: 'stat.card', span: 6, rowSpan: 1, props: { label: 'Card 5 (50%)' } },
    ],
  });

  it('mover para cima/baixo usando a seta troca de lugar mantendo os tamanhos originais de cada bloco', () => {
    const initial = threePlusTwo();
    const movedUp = nudgeBlockGrid(initial, 'c4', 'up');
    expect(findBlock(movedUp, 'c4')!.block).toMatchObject({ x: 0, y: 0, span: 6 });
    expect(findBlock(movedUp, 'c1')!.block).toMatchObject({ x: 0, y: 1, span: 4 });
  });

  it('trocar de posição preserva estritamente o tamanho original de cada bloco (ex: divider não herda altura da tabela)', () => {
    const layout: PageLayout = {
      v: 1,
      blocks: [
        { id: 'div1', type: 'divider', span: 12, rowSpan: 1, x: 0, y: 0, props: {} },
        {
          id: 'table1',
          type: 'table.basic',
          span: 12,
          rowSpan: 11,
          x: 0,
          y: 1,
          props: { title: 'Usuários' },
          data: { params: { limit: 10 } },
        },
      ],
    };

    const swapped = moveBlockTo(layout, 'div1', 'table1', 'swap');
    const swappedDiv = findBlock(swapped, 'div1')!.block;
    const swappedTable = findBlock(swapped, 'table1')!.block;

    // O divider NUNCA assume a altura da tabela (continua com rowSpan: 1)
    expect(swappedDiv.rowSpan).toBe(1);
    expect(swappedDiv.span).toBe(12);

    // A tabela NUNCA é achatada para o tamanho do divider (continua com rowSpan: 11)
    expect(swappedTable.rowSpan).toBe(11);
    expect(swappedTable.span).toBe(12);

    // A tabela foi para o topo (y=0) e o divider foi para baixo da tabela sem colidir
    expect(swappedTable.y).toBe(0);
    expect(swappedDiv.y).toBeGreaterThanOrEqual(11);
  });

  it('trocar de lugar entre cards de larguras diferentes preserva os spans originais', () => {
    const initial = threePlusTwo();
    const swapped = moveBlockTo(initial, 'c5', 'c2', 'swap');
    expect(findBlock(swapped, 'c5')!.block.span).toBe(6);
    expect(findBlock(swapped, 'c2')!.block.span).toBe(4);
  });
});

describe('Limitação de redimensionamento ao encostar em outro bloco ou fim da linha', () => {
  it('bloqueia o aumento de largura quando o bloco está encostado em outro ou no limite da linha (sem pular para a linha de baixo)', () => {
    const layout: PageLayout = {
      v: 1,
      blocks: [
        { id: 'c1', type: 'stat.card', span: 4, rowSpan: 1, props: {} },
        { id: 'c2', type: 'stat.card', span: 4, rowSpan: 1, props: {} },
        { id: 'c3', type: 'stat.card', span: 4, rowSpan: 1, props: {} },
        { id: 'c4', type: 'stat.card', span: 6, rowSpan: 1, props: {} },
        { id: 'c5', type: 'stat.card', span: 6, rowSpan: 1, props: {} },
      ],
    };

    expect(getMaxResizeBounds(layout.blocks, 'c1').maxSpan).toBe(4);
    expect(getMaxResizeBounds(layout.blocks, 'c3').maxSpan).toBe(4);
    expect(getMaxResizeBounds(layout.blocks, 'c5').maxSpan).toBe(6);

    const afterAttempt = setBlockSpan(layout, 'c5', 8);
    const c5 = findBlock(afterAttempt, 'c5')!.block;
    expect(c5.span).toBe(6);
    expect(c5.x).toBe(6);
    expect(c5.y).toBe(1);

    const afterShrinkC4 = setBlockSpan(afterAttempt, 'c4', 3);
    expect(findBlock(afterShrinkC4, 'c4')!.block).toMatchObject({ x: 0, y: 1, span: 3 });
    expect(findBlock(afterShrinkC4, 'c5')!.block).toMatchObject({ x: 6, y: 1, span: 6 });
    expect(getMaxResizeBounds(afterShrinkC4.blocks, 'c4').maxSpan).toBe(6);
  });

  it('bloqueia o aumento de altura (rowSpan) quando há outro bloco logo abaixo', () => {
    const layout: PageLayout = {
      v: 1,
      blocks: [
        { id: 'top', type: 'stat.card', span: 6, rowSpan: 1, x: 0, y: 0, props: {} },
        { id: 'bottom', type: 'stat.card', span: 6, rowSpan: 1, x: 0, y: 1, props: {} },
      ],
    };

    expect(getMaxResizeBounds(layout.blocks, 'top').maxRowSpan).toBe(1);

    const afterAttempt = setBlockRowSpan(layout, 'top', 3);
    expect(findBlock(afterAttempt, 'top')!.block.rowSpan).toBe(1);
    expect(findBlock(afterAttempt, 'bottom')!.block.y).toBe(1);
  });

  it('redimensiona pela alça esquerda (setBlockSpanLeft) e superior (setBlockRowSpanTop) respeitando espaço livre e vizinhos', () => {
    const layout: PageLayout = {
      v: 1,
      blocks: [
        { id: 'leftBlock', type: 'stat.card', span: 3, rowSpan: 1, x: 0, y: 1, props: {} },
        { id: 'rightBlock', type: 'stat.card', span: 4, rowSpan: 1, x: 8, y: 1, props: {} },
      ],
    };

    // rightBlock está em x=8..12 (span 4), e leftBlock termina em x=3.
    // Há espaço livre entre x=3 e x=8.
    // Ao aumentar rightBlock pela esquerda para span=6, ele passa para x=6..12 (span 6):
    const expandedLeft = setBlockSpanLeft(layout, 'rightBlock', 6);
    expect(findBlock(expandedLeft, 'rightBlock')!.block).toMatchObject({ x: 6, y: 1, span: 6 });

    // Tentar aumentar rightBlock pela esquerda para span=11 trava em x=3 (span=9), sem invadir leftBlock (x=0..3):
    const clampedLeft = setBlockSpanLeft(expandedLeft, 'rightBlock', 11);
    expect(findBlock(clampedLeft, 'rightBlock')!.block).toMatchObject({ x: 3, y: 1, span: 9 });

    // E aumentar rightBlock pela alça superior (de rowSpan=1 em y=1 para rowSpan=2) expande para y=0..2:
    const expandedTop = setBlockRowSpanTop(clampedLeft, 'rightBlock', 2);
    expect(findBlock(expandedTop, 'rightBlock')!.block).toMatchObject({ x: 3, y: 0, span: 9, rowSpan: 2 });
  });

  it('ao lado de um Gráfico (que ocupa no mínimo 2 linhas mesmo que estivesse salvo com rowSpan=1), um Card com rowSpan=1 ocupa metade da altura e libera o espaço abaixo dele como slot vazio para outros elementos', () => {
    const layout: PageLayout = {
      v: 1,
      blocks: [
        { id: 'card', type: 'stat.card', span: 6, rowSpan: 1, x: 0, y: 0, props: { label: 'Logs' } },
        // Simula um gráfico legado que tinha rowSpan: 1 salvo no JSON
        { id: 'chart', type: 'chart.line', span: 6, rowSpan: 1, x: 6, y: 0, props: { title: 'Gráfico de Logs' } },
      ],
    };

    const placed = resolveGridLayout(layout.blocks);
    // O card ocupa 1 linha (y=0, rowSpan=1), enquanto o gráfico ocupa no mínimo 2 linhas (y=0, rowSpan=2)
    expect(placed.find((p) => p.block.id === 'card')).toMatchObject({ x: 0, y: 0, span: 6, rowSpan: 1 });
    expect(placed.find((p) => p.block.id === 'chart')).toMatchObject({ x: 6, y: 0, span: 6, rowSpan: 4 });

    // O espaço abaixo do Card (x=0, y=1, span=6) fica 100% livre na grade para colocar Texto, Botão ou outro Card!
    const slots = findEmptyGridSlots(placed, 12, false);
    expect(slots).toContainEqual({ x: 0, y: 1, span: 6, rowSpan: 1 });
  });

  describe('Contenção automática de altura (Group e Text.rich)', () => {
    it('expande automaticamente o rowSpan de um Group para acomodar o cabeçalho e a altura dos filhos', () => {
      const layout: PageLayout = {
        v: 1,
        blocks: [
          {
            id: 'group1',
            type: 'group',
            span: 12,
            props: { title: 'Indicadores', description: 'Visão geral' },
            children: [
              { id: 'c1', type: 'text.rich', span: 3, props: { content: 'Total' } },
              { id: 'chart1', type: 'chart.area', span: 6, rowSpan: 4, props: {} },
            ],
          },
          { id: 'nextHeading', type: 'heading', span: 12, props: { text: 'Gestão de usuários' } },
        ],
      };

      const placed = resolveGridLayout(layout.blocks);
      const placedGroup = placed.find((p) => p.block.id === 'group1')!;
      const placedNext = placed.find((p) => p.block.id === 'nextHeading')!;

      // O grupo tem filhos com rowSpan 4 + cabeçalho com 2 linhas -> precisa de no mínimo 6 linhas
      expect(placedGroup.rowSpan).toBeGreaterThanOrEqual(6);
      // O próximo bloco começa estritamente após o término do grupo, sem sobreposição
      expect(placedNext.y).toBeGreaterThanOrEqual(placedGroup.y + placedGroup.rowSpan);
    });

    it('ajusta a altura mínima de text.rich com múltiplas linhas ou títulos markdown para evitar truncamento', () => {
      const layout: PageLayout = {
        v: 1,
        blocks: [
          {
            id: 'text1',
            type: 'text.rich',
            span: 3,
            props: { content: '### Total de usuários\n**3**' },
          },
        ],
      };

      const placed = resolveGridLayout(layout.blocks);
      const placedText = placed.find((p) => p.block.id === 'text1')!;
      expect(placedText.rowSpan).toBe(2);
    });

    it('calcula altura proporcional para blocos de texto longos e estreitos sem travar em limites baixos', () => {
      const longText = 'Texto '.repeat(100);
      const layout: PageLayout = {
        v: 1,
        blocks: [
          {
            id: 'long',
            type: 'text.rich',
            span: 3,
            props: { content: longText },
          },
        ],
      };

      const placed = resolveGridLayout(layout.blocks);
      const placedLong = placed.find((p) => p.block.id === 'long')!;
      // Em span: 3 (coluna estreita), texto longo precisa de pelo menos 6 linhas de grid
      expect(placedLong.rowSpan).toBeGreaterThanOrEqual(6);
    });

    it('ajusta a altura de list.feed proporcionalmente ao número de itens (limit)', () => {
      const feedBlock = {
        id: 'feed1',
        type: 'list.feed',
        span: 12,
        props: { title: 'Atividades recentes', description: 'Últimas ações' },
        data: { source: 'logs.list', params: { limit: 10 } },
      };

      // Com 10 itens + cabeçalho, precisa de 11 linhas
      const estimated = estimateFeedRowSpan(feedBlock);
      expect(estimated).toBe(11);

      const effective = calculateEffectiveRowSpan(feedBlock);
      expect(effective).toBe(11);
    });

    it('ajusta a altura de table.basic proporcionalmente ao número de linhas (limit)', () => {
      const tableBlock = {
        id: 'table1',
        type: 'table.basic',
        span: 12,
        props: { title: 'Usuários recentes', description: 'Lista de cadastros' },
        data: { source: 'users.list', params: { limit: 10 } },
      };

      const estimated = estimateTableRowSpan(tableBlock);
      expect(estimated).toBe(11);
    });

    it('ajusta a altura de topic e price com base nos itens e linhas das props', () => {
      const topicBlock = {
        id: 't1',
        type: 'topic',
        props: { title: 'Escopo', items: ['Item 1', 'Item 2', 'Item 3', 'Item 4'] },
      };
      expect(estimateTopicRowSpan(topicBlock)).toBeGreaterThanOrEqual(4);

      const priceBlock = {
        id: 'p1',
        type: 'price',
        props: { title: 'Valores', rows: ['Plano 1|1000', 'Plano 2|2000', 'Plano 3|3000'] },
      };
      expect(estimatePriceRowSpan(priceBlock)).toBeGreaterThanOrEqual(5);
    });

    it('expande list.feed no layout completo e posiciona blocos seguintes sem sobreposição', () => {
      const layout: PageLayout = {
        v: 1,
        blocks: [
          {
            id: 'feed',
            type: 'list.feed',
            span: 12,
            rowSpan: 4,
            props: { title: 'Atividades', description: 'Log' },
            data: { source: 'logs.list', params: { limit: 10 } },
          },
          {
            id: 'afterFeed',
            type: 'heading',
            span: 12,
            props: { text: 'Próxima Seção' },
          },
        ],
      };

      const placed = resolveGridLayout(layout.blocks);
      const placedFeed = placed.find((p) => p.block.id === 'feed')!;
      const placedAfter = placed.find((p) => p.block.id === 'afterFeed')!;

      expect(placedFeed.rowSpan).toBe(11);
      expect(placedAfter.y).toBeGreaterThanOrEqual(placedFeed.y + placedFeed.rowSpan);
    });

  });
});
