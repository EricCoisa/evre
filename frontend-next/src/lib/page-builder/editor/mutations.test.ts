import { describe, it, expect } from 'vitest';
import { PageLayoutSchema, MAX_BLOCKS, MAX_CHILDREN, type PageLayout, type PageBlock } from '../schema';
import { calculateEffectiveRowSpan, compactEmptyRows, compactLayout, findEmptyGridSlots, resolveGridLayout } from '../grid-engine';
import {
  EMPTY_LAYOUT,
  addBlock,
  canAdd,
  createBlock,
  findBlock,
  moveBlock,
  removeBlock,
  setBlockParam,
  setBlockProp,
  setBlockRowSpan,
  setBlockSource,
  updateBlock,
  canDrop,
  insertBlockAfter,
  insertBlockAt,
  moveBlockTo,
} from './mutations';

/** Testa o aninhamento de um nível, os limites do Zod e o descarte da fonte antiga ao trocar de fonte. */

const layout = (): PageLayout => ({
  v: 1,
  blocks: [
    {
      id: 'a',
      type: 'text.rich',
      span: 4,
      props: { content: 'Total: {{total}}' },
      data: { source: 'users.list', params: { limit: 1 } },
    },
    {
      id: 'g',
      type: 'group',
      span: 4,
      props: { title: 'Users' },
      children: [
        { id: 'c1', type: 'table.basic', span: 2, props: { columns: ['name'] } },
        { id: 'c2', type: 'text.rich', span: 2, props: {} },
      ],
    },
  ],
});

describe('findBlock', () => {
  it('acha nos dois níveis e informa o pai', () => {
    const top = findBlock(layout(), 'a')!;
    expect(top.index).toBe(0);
    expect(top.parentId).toBeUndefined();

    expect(findBlock(layout(), 'c2')).toMatchObject({ index: 1, parentId: 'g' });
    expect(findBlock(layout(), 'nope')).toBeUndefined();
  });
});

describe('updateBlock / setBlockProp', () => {
  it('edita bloco de topo e filho sem tocar nos vizinhos', () => {
    const next = updateBlock(layout(), 'c1', { span: 4 });

    expect(findBlock(next, 'c1')!.block.span).toBe(4);
    expect(findBlock(next, 'c2')!.block.span).toBe(2);
  });

  it('setBlockProp preserva as outras props', () => {
    const next = setBlockProp(layout(), 'a', 'hint', 'desde 2024');

    expect(findBlock(next, 'a')!.block.props).toEqual({
      content: 'Total: {{total}}',
      hint: 'desde 2024',
    });
  });

  it('não muta o layout original', () => {
    const original = layout();
    setBlockProp(original, 'a', 'content', 'Outro');

    expect(original.blocks[0].props).toEqual({ content: 'Total: {{total}}' });
  });
});

describe('setBlockSource', () => {
  it('descarta params da fonte anterior', () => {
    const next = setBlockSource(layout(), 'a', 'logs.list');

    expect(findBlock(next, 'a')!.block.data).toEqual({ source: 'logs.list' });
  });

  it('descarta props de lista de campos (columns) — apontariam para campo inexistente', () => {
    const next = setBlockSource(layout(), 'c1', 'logs.list');
    const block = findBlock(next, 'c1')!.block;

    expect(block.props).not.toHaveProperty('columns');
    expect(block.data).toEqual({ source: 'logs.list' });
  });

  it('preserva props que não são lista de campos', () => {
    const withTitle = setBlockProp(layout(), 'c1', 'title', 'Minha tabela');
    const next = setBlockSource(withTitle, 'c1', 'logs.list');

    expect(findBlock(next, 'c1')!.block.props).toEqual({ title: 'Minha tabela' });
  });

  it('limpa a fonte quando recebe undefined', () => {
    expect(findBlock(setBlockSource(layout(), 'a', undefined), 'a')!.block.data)
      .toBeUndefined();
  });
});

describe('setBlockParam', () => {
  it('remove o param quando o campo é esvaziado', () => {
    // `""` num param de tipo number seria recusado pelo backend — sumir é o certo.
    const next = setBlockParam(layout(), 'a', 'limit', '');

    expect(findBlock(next, 'a')!.block.data!.params).toEqual({});
  });

  it('adiciona sem apagar os existentes', () => {
    const next = setBlockParam(layout(), 'a', 'page', 2);

    expect(findBlock(next, 'a')!.block.data!.params).toEqual({ limit: 1, page: 2 });
  });
});

describe('removeBlock', () => {
  it('remove no topo levando os filhos junto', () => {
    const next = removeBlock(layout(), 'g');

    expect(next.blocks.map((b) => b.id)).toEqual(['a']);
    expect(findBlock(next, 'c1')).toBeUndefined();
  });

  it('remove um filho sem remover o container', () => {
    const next = removeBlock(layout(), 'c1');

    expect(findBlock(next, 'g')!.block.children!.map((c) => c.id)).toEqual(['c2']);
  });

  it('ao deletar um bloco de largura total, os elementos abaixo sobem na mesma disposição eliminando o buraco vertical', () => {
    const gridLayout: PageLayout = {
      v: 1,
      blocks: [
        { id: 'topCard', type: 'stat.card', span: 12, rowSpan: 2, x: 0, y: 0, props: {} },
        { id: 'cronograma', type: 'table.basic', span: 12, rowSpan: 8, x: 0, y: 2, props: {} },
        { id: 'bottomText', type: 'text.rich', span: 12, rowSpan: 2, x: 0, y: 10, props: { content: 'Milestones' } },
        { id: 'footerText', type: 'text.rich', span: 12, rowSpan: 1, x: 0, y: 12, props: { content: 'Footer' } },
      ],
    };

    const next = removeBlock(gridLayout, 'cronograma');

    expect(next.blocks.map((b) => b.id)).toEqual(['topCard', 'bottomText', 'footerText']);
    const top = findBlock(next, 'topCard')!.block;
    const bottom = findBlock(next, 'bottomText')!.block;
    const footer = findBlock(next, 'footerText')!.block;

    // topCard permanece inalterado em y=0
    expect(top.y).toBe(0);
    // bottomText sobe de y=10 para y=2, encostando no topCard (rowSpan=2)
    expect(bottom.y).toBe(2);
    // footerText sobe e fica logo abaixo do bottomText (rowSpan efetivo de text.rich largura 12 = 1)
    expect(footer.y).toBe(3);
  });

  it('ao deletar o primeiro bloco no topo (y=0), todos os blocos subsequentes sobem para o topo', () => {
    const gridLayout: PageLayout = {
      v: 1,
      blocks: [
        { id: 'banner', type: 'stat.card', span: 12, rowSpan: 4, x: 0, y: 0, props: {} },
        { id: 'content', type: 'table.basic', span: 12, rowSpan: 3, x: 0, y: 4, props: {} },
      ],
    };

    const next = removeBlock(gridLayout, 'banner');
    const content = findBlock(next, 'content')!.block;
    expect(content.y).toBe(0);
  });

  it('ao deletar um bloco em coluna parcial, sobe apenas os blocos daquela coluna sem desalinhar a coluna vizinha', () => {
    const gridLayout: PageLayout = {
      v: 1,
      blocks: [
        { id: 'leftTop', type: 'stat.card', span: 6, rowSpan: 4, x: 0, y: 0, props: {} },
        { id: 'leftBottom', type: 'stat.card', span: 6, rowSpan: 4, x: 0, y: 4, props: {} },
        { id: 'rightTall', type: 'table.basic', span: 6, rowSpan: 8, x: 6, y: 0, props: {} },
        { id: 'footer', type: 'text.rich', span: 12, rowSpan: 2, x: 0, y: 8, props: {} },
      ],
    };

    const next = removeBlock(gridLayout, 'leftTop');

    const leftBottom = findBlock(next, 'leftBottom')!.block;
    const rightTall = findBlock(next, 'rightTall')!.block;
    const footer = findBlock(next, 'footer')!.block;

    // leftBottom sobe de y=4 para y=0 no espaço deixado por leftTop
    expect(leftBottom.x).toBe(0);
    expect(leftBottom.y).toBe(0);

    // rightTall não foi afetado e continua em y=0
    expect(rightTall.x).toBe(6);
    expect(rightTall.y).toBe(0);

    // footer não pode invadir a coluna de rightTall (altura 8), permanecendo em y=8
    expect(footer.y).toBe(8);
  });
});

describe('addBlock / createBlock', () => {
  it('container nasce com children, folha não', () => {
    expect(createBlock('group').children).toEqual([]);
    expect(createBlock('text.rich').children).toBeUndefined();
  });

  it('filho nasce com meia largura e bloco de topo com largura cheia', () => {
    expect(createBlock('text.rich').span).toBe(12);
    expect(createBlock('text.rich', 'g').span).toBe(6);
  });

  it('gera ids únicos', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createBlock('text.rich').id));

    expect(ids.size).toBe(50);
  });

  it('adiciona no topo e dentro de um container', () => {
    const child = createBlock('text.rich', 'g');
    const next = addBlock(layout(), child, 'g');

    expect(findBlock(next, child.id)!.parentId).toBe('g');
    expect(next.blocks).toHaveLength(2);
  });

  it('respeita o teto de blocos da página', () => {
    let full = EMPTY_LAYOUT;
    for (let i = 0; i < MAX_BLOCKS; i++) full = addBlock(full, createBlock('text.rich'));

    expect(canAdd(full)).toBe(false);
    expect(addBlock(full, createBlock('text.rich')).blocks).toHaveLength(MAX_BLOCKS);
    expect(PageLayoutSchema.safeParse(full).success).toBe(true);
  });

  it('respeita o teto de filhos de um container', () => {
    let full = addBlock(EMPTY_LAYOUT, { ...createBlock('group'), id: 'g' });
    for (let i = 0; i < MAX_CHILDREN; i++) {
      full = addBlock(full, createBlock('text.rich', 'g'), 'g');
    }

    expect(canAdd(full, 'g')).toBe(false);
    expect(findBlock(full, 'g')!.block.children).toHaveLength(MAX_CHILDREN);
    expect(PageLayoutSchema.safeParse(full).success).toBe(true);
  });
});

describe('moveBlock — dentro do mesmo nível', () => {
  it('reordena no topo', () => {
    expect(moveBlock(layout(), 'g', 'a').blocks.map((b) => b.id)).toEqual(['g', 'a']);
  });

  it('reordena dentro do mesmo container', () => {
    const next = moveBlock(layout(), 'c2', 'c1');

    expect(findBlock(next, 'g')!.block.children!.map((c) => c.id)).toEqual(['c2', 'c1']);
  });

  it('ignora alvo inexistente e soltar sobre si mesmo', () => {
    expect(moveBlock(layout(), 'a', 'nope')).toEqual(layout());
    expect(moveBlock(layout(), 'a', 'a')).toEqual(layout());
  });
});

describe('moveBlock — entrando e saindo de um container', () => {
  it('soltar um bloco de topo sobre o card do group o move para dentro', () => {
    const next = moveBlock(layout(), 'a', 'g');

    expect(next.blocks.map((b) => b.id)).toEqual(['g']);
    expect(findBlock(next, 'a')!.parentId).toBe('g');
    // Entra no fim da lista de filhos.
    expect(findBlock(next, 'g')!.block.children!.map((c) => c.id)).toEqual([
      'c1',
      'c2',
      'a',
    ]);
  });

  it('soltar sobre um filho entra no container na posição daquele filho', () => {
    const next = moveBlock(layout(), 'a', 'c1');

    expect(findBlock(next, 'a')!.parentId).toBe('g');
    expect(findBlock(next, 'g')!.block.children!.map((c) => c.id)).toEqual([
      'a',
      'c1',
      'c2',
    ]);
  });

  it('soltar um filho sobre um bloco de topo o tira do container', () => {
    const next = moveBlock(layout(), 'c1', 'a');

    expect(findBlock(next, 'c1')!.parentId).toBeUndefined();
    expect(next.blocks.map((b) => b.id)).toEqual(['c1', 'a', 'g']);
    expect(findBlock(next, 'g')!.block.children!.map((c) => c.id)).toEqual(['c2']);
  });

  it('preserva as props e a fonte do bloco ao trocar de container', () => {
    const moved = findBlock(moveBlock(layout(), 'a', 'g'), 'a')!.block;

    expect(moved.props).toEqual({ content: 'Total: {{total}}' });
    expect(moved.data).toEqual({ source: 'users.list', params: { limit: 1 } });
  });

  it('recusa container dentro de container — o aninhamento é de um nível', () => {
    const two = addBlock(layout(), { ...createBlock('group'), id: 'g2' });

    // Soltar sobre um FILHO do outro group significaria entrar nele: recusado.
    expect(moveBlock(two, 'g2', 'c1')).toEqual(two);
  });

  it('mas dois groups no topo se reordenam normalmente entre si', () => {
    const two = addBlock(layout(), { ...createBlock('group'), id: 'g2' });

    expect(moveBlock(two, 'g2', 'g').blocks.map((b) => b.id)).toEqual([
      'a',
      'g2',
      'g',
    ]);
  });

  it('recusa entrar num container que já está no teto de filhos', () => {
    let full = addBlock(EMPTY_LAYOUT, { ...createBlock('group'), id: 'g' });
    for (let i = 0; i < MAX_CHILDREN; i++) {
      full = addBlock(full, createBlock('text.rich', 'g'), 'g');
    }
    full = addBlock(full, { ...createBlock('text.rich'), id: 'solto' });

    expect(moveBlock(full, 'solto', 'g')).toEqual(full);
  });

  it('o resultado continua válido para o schema', () => {
    const next = moveBlock(layout(), 'a', 'g');

    expect(PageLayoutSchema.safeParse(next).success).toBe(true);
  });
});

describe('resultado continua válido para o schema', () => {
  it('uma sequência de edições produz layout que o renderer aceita', () => {
    let l = EMPTY_LAYOUT;
    const g = createBlock('group');
    l = addBlock(l, g);
    const t = createBlock('table.basic', g.id);
    l = addBlock(l, t, g.id);
    l = setBlockSource(l, t.id, 'logs.list');
    l = setBlockParam(l, t.id, 'limit', 10);
    l = setBlockProp(l, t.id, 'columns', ['module', 'action']);
    l = updateBlock(l, t.id, { className: 'text-sm' });

    expect(PageLayoutSchema.safeParse(l).success).toBe(true);
  });
});

describe('canDrop / moveBlockTo — destino explícito', () => {
  const nested = (): PageLayout => ({
    blocks: [
      { id: 'g', type: 'group', span: 4, props: {}, children: [{ id: 'c1', type: 'text.rich', span: 2, props: {} }] },
      { id: 'b', type: 'table.basic', span: 4, props: {} },
    ],
  }) as PageLayout;

  it('inside aceita folha de topo indo para o container', () => {
    expect(canDrop(nested(), 'b', 'g', 'inside')).toBe(true);
    const next = moveBlockTo(nested(), 'b', 'g', 'inside');
    expect(findBlock(next, 'b')!.parentId).toBe('g');
    expect(next.blocks).toHaveLength(1);
  });

  it('inside recusa container dentro de container', () => {
    const two = { blocks: [...nested().blocks, { id: 'g2', type: 'group', span: 4, props: {}, children: [] }] } as PageLayout;
    expect(canDrop(two, 'g2', 'g', 'inside')).toBe(false);
  });

  it('inside recusa quem já é filho daquele container', () => {
    expect(canDrop(nested(), 'c1', 'g', 'inside')).toBe(false);
  });

  it('before insere antes do alvo, no nível do alvo', () => {
    const next = moveBlockTo(nested(), 'b', 'g', 'before');
    expect(next.blocks.map((x) => x.id)).toEqual(['b', 'g']);
  });

  it('after insere depois do alvo', () => {
    const next = moveBlockTo(nested(), 'g', 'b', 'after');
    expect(next.blocks.map((x) => x.id)).toEqual(['b', 'g']);
  });

  it('before/after recusa container indo parar dentro de outro', () => {
    const two = { blocks: [...nested().blocks, { id: 'g2', type: 'group', span: 4, props: {}, children: [] }] } as PageLayout;
    expect(canDrop(two, 'g2', 'c1', 'before')).toBe(false);
  });

  it('soltar em si mesmo não faz nada', () => {
    expect(canDrop(nested(), 'b', 'b', 'after')).toBe(false);
    expect(moveBlockTo(nested(), 'b', 'b', 'after')).toEqual(nested());
  });
});

describe('insertBlockAfter & insertBlockAt (2D Grid Insertion)', () => {
  it('insere após um bloco e empurra os blocos subsequentes para baixo', () => {
    const initial: PageLayout = {
      v: 1,
      blocks: [
        { id: 'b1', type: 'text.rich', span: 12, rowSpan: 2, x: 0, y: 0, props: { content: 'Header', preset: 'heading1' } },
        { id: 'b2', type: 'group', span: 6, rowSpan: 3, x: 0, y: 2, props: {}, children: [] },
        { id: 'b3', type: 'group', span: 6, rowSpan: 3, x: 6, y: 2, props: {}, children: [] },
        { id: 'b4', type: 'topic', span: 12, rowSpan: 4, x: 0, y: 5, props: { title: 'Milestones' } },
      ],
    };

    const newBlock = createBlock('text.rich');
    newBlock.rowSpan = 2;

    // Inserir após b2 (o card esquerdo na linha de cards que vai até y=5)
    const result = insertBlockAfter(initial, 'b2', newBlock);

    // O novo bloco deve entrar logo após b2 na ordem sequencial
    const newIdx = result.blocks.findIndex((b) => b.id === newBlock.id);
    expect(newIdx).toBe(2);

    // O novo bloco deve ser colocado em y=5 (linha logo abaixo da seção de cards)
    const placedNew = result.blocks.find((b) => b.id === newBlock.id)!;
    expect(placedNew.y).toBe(5);
    expect(placedNew.rowSpan).toBe(2);

    // Os blocos acima mantêm suas posições
    const placedB1 = result.blocks.find((b) => b.id === 'b1')!;
    expect(placedB1.y).toBe(0);

    const placedB2 = result.blocks.find((b) => b.id === 'b2')!;
    expect(placedB2.y).toBe(2);

    const placedB3 = result.blocks.find((b) => b.id === 'b3')!;
    expect(placedB3.y).toBe(2);

    // O bloco que estava em y=5 (Milestones) foi empurrado para y = 5 + 2 = 7
    const placedB4 = result.blocks.find((b) => b.id === 'b4')!;
    expect(placedB4.y).toBe(7);
  });

  it('insere após um item filho dentro de um container (Group)', () => {
    const initial: PageLayout = {
      v: 1,
      blocks: [
        {
          id: 'g1',
          type: 'group',
          span: 12,
          props: {},
          children: [
            { id: 'c1', type: 'text.rich', span: 12, props: { content: 'Item 1' } },
            { id: 'c2', type: 'text.rich', span: 12, props: { content: 'Item 2' } },
          ],
        },
      ],
    };

    const newChild = createBlock('button.action');
    const result = insertBlockAfter(initial, 'c1', newChild);

    const group = result.blocks.find((b) => b.id === 'g1')!;
    expect(group.children?.map((c) => c.id)).toEqual(['c1', newChild.id, 'c2']);
  });

  it('insertBlockAt(0) insere no topo e empurra todos os blocos existentes para baixo', () => {
    const initial: PageLayout = {
      v: 1,
      blocks: [
        { id: 'b1', type: 'text.rich', span: 12, rowSpan: 2, x: 0, y: 0, props: { content: 'Header', preset: 'heading1' } },
        { id: 'b2', type: 'text.rich', span: 12, rowSpan: 2, x: 0, y: 2, props: { content: 'Text' } },
      ],
    };

    const newTop = createBlock('text.rich');
    newTop.rowSpan = 3;

    const result = insertBlockAt(initial, newTop, 0);

    expect(result.blocks[0].id).toBe(newTop.id);
    expect(result.blocks[0].y).toBe(0);

    const placedB1 = result.blocks.find((b) => b.id === 'b1')!;
    expect(placedB1.y).toBe(3); // 0 + 3

    const placedB2 = result.blocks.find((b) => b.id === 'b2')!;
    expect(placedB2.y).toBe(5); // 2 + 3
  });

  it('setBlockProp(preset) atua como preset configurando tamanho de fonte [fs:...] e negrito', () => {
    const initial: PageLayout = {
      v: 1,
      blocks: [
        {
          id: 'text1',
          type: 'text.rich',
          span: 12,
          rowSpan: 1,
          x: 0,
          y: 0,
          props: { content: '[fs:text-xs]Texto pequeno[/fs]', preset: 'paragraph' },
        },
      ],
    };

    const updated = setBlockProp(initial, 'text1', 'preset', 'heading1');
    const block = findBlock(updated, 'text1')!.block;
    expect(block.props.preset).toBe('heading1');
    expect(block.props.content).toBe('[fs:text-4xl]*Texto pequeno*[/fs]');

    const reverted = setBlockProp(updated, 'text1', 'preset', 'paragraph');
    const revertedBlock = findBlock(reverted, 'text1')!.block;
    expect(revertedBlock.props.preset).toBe('paragraph');
    expect(revertedBlock.props.content).toBe('[fs:text-sm]Texto pequeno[/fs]');

    // Testa também texto com negrito por palavra gerado pelo exportWhatsAppText (ex: *Criar* *plataforma*)
    const multiWordBoldLayout: PageLayout = {
      v: 1,
      blocks: [
        {
          id: 'text2',
          type: 'text.rich',
          span: 12,
          rowSpan: 1,
          x: 0,
          y: 0,
          props: { content: '[fs:text-4xl]*Criar* *uma* *plataforma*[/fs]', preset: 'heading1' },
        },
      ],
    };
    const multiWordReverted = setBlockProp(multiWordBoldLayout, 'text2', 'preset', 'paragraph');
    const multiWordBlock = findBlock(multiWordReverted, 'text2')!.block;
    expect(multiWordBlock.props.preset).toBe('paragraph');
    expect(multiWordBlock.props.content).toBe('[fs:text-sm]Criar uma plataforma[/fs]');
  });

  it('ao expandir texto em bloco paragraph, calcula rowSpan proporcional sem vácuo exponencial', () => {
    let layout: PageLayout = {
      v: 1,
      blocks: [
        {
          id: 'text1',
          type: 'text.rich',
          span: 12,
          rowSpan: 1,
          x: 0,
          y: 0,
          props: { content: 'Linha 1', preset: 'paragraph' },
        },
        {
          id: 'text2',
          type: 'text.rich',
          span: 12,
          rowSpan: 1,
          x: 0,
          y: 1,
          props: { content: 'Criar uma plataforma...', preset: 'paragraph' },
        },
      ],
    };

    const paragraph =
      'Desenvolvimento de uma plataforma digital para personal trainers gerenciarem seus alunos, organizarem exercícios e criarem treinos personalizados. A solução contará com uma área administrativa para o profissional e uma área exclusiva para os alunos acompanharem seus treinos.';

    // Blocos full-width (span 12) mantêm rowSpan 1 e usam auto-rows minmax(44px, auto)
    // para expansão suave e contínua pixel a pixel a cada linha/caractere digitado,
    // garantindo que text2 permaneça sempre exatamente após a linha 1 com gap uniforme.
    layout = setBlockProp(layout, 'text1', 'content', paragraph);
    expect(findBlock(layout, 'text1')!.block.rowSpan).toBe(1);
    expect(findBlock(layout, 'text2')!.block.y).toBe(1);

    const sixParagraphs = Array(6).fill(paragraph).join('\n');
    layout = setBlockProp(layout, 'text1', 'content', sixParagraphs);
    expect(findBlock(layout, 'text1')!.block.rowSpan).toBe(1);
    expect(findBlock(layout, 'text2')!.block.y).toBe(1);

    const sevenParagraphs = Array(7).fill(paragraph).join('\n');
    layout = setBlockProp(layout, 'text1', 'content', sevenParagraphs);
    expect(findBlock(layout, 'text1')!.block.rowSpan).toBe(1);
    expect(findBlock(layout, 'text2')!.block.y).toBe(1);

    // Já blocos de largura parcial (span < 12) em grade bento calculam rowSpan proporcional
    // para reservar espaço no grid lado a lado com outros blocos
    const partialText: PageBlock = {
      id: 'partial1',
      type: 'text.rich',
      span: 6,
      rowSpan: 1,
      x: 0,
      y: 0,
      props: { content: sevenParagraphs, preset: 'paragraph' },
    };
    expect(calculateEffectiveRowSpan(partialText, 12)).toBeGreaterThanOrEqual(5);
  });

  it('redimensiona bloco para baixo ocupando espaço vazio existente sem empurrar blocos', () => {
    const layout: PageLayout = {
      v: 1,
      blocks: [
        { id: 'b1', type: 'group', span: 12, rowSpan: 5, x: 0, y: 0, props: {} },
        { id: 'b2', type: 'text.rich', span: 12, rowSpan: 1, x: 0, y: 6, props: { content: 'Texto 1' } },
        { id: 'b3', type: 'text.rich', span: 12, rowSpan: 1, x: 0, y: 8, props: { content: 'Texto 2' } },
      ],
    };

    // Antes: linha 5 é vazia (slot vazio) e linha 7 é vazia (slot vazio)
    const slotsBefore = findEmptyGridSlots(resolveGridLayout(layout.blocks));
    expect(slotsBefore.some((s) => s.y === 5)).toBe(true);
    expect(slotsBefore.some((s) => s.y === 7)).toBe(true);

    // Passo 1: b1 cresce de rowSpan 5 para 6 (ocupa a linha 5 que estava vazia)
    const updated1 = setBlockRowSpan(layout, 'b1', 6);
    expect(findBlock(updated1, 'b1')!.block.rowSpan).toBe(6);
    expect(findBlock(updated1, 'b2')!.block.y).toBe(6); // Não foi empurrado!
    expect(findBlock(updated1, 'b3')!.block.y).toBe(8); // Não foi empurrado!

    // O slot vazio na linha 5 foi dissolvido pelo bloco
    const slotsAfter1 = findEmptyGridSlots(resolveGridLayout(updated1.blocks));
    expect(slotsAfter1.some((s) => s.y === 5)).toBe(false);
    expect(slotsAfter1.some((s) => s.y === 7)).toBe(true);

    // Passo 2: b1 cresce de rowSpan 6 para 7 (colide com b2 em y=6)
    // b2 deve ser empurrado para y=7 (ocupando o espaço vazio que estava na linha 7)
    // e b3 em y=8 NÃO deve ser empurrado, pois a linha 7 absorveu o movimento de b2!
    const updated2 = setBlockRowSpan(updated1, 'b1', 7);
    expect(findBlock(updated2, 'b1')!.block.rowSpan).toBe(7);
    expect(findBlock(updated2, 'b2')!.block.y).toBe(7); // Empurrado de 6 para 7
    expect(findBlock(updated2, 'b3')!.block.y).toBe(8); // Permanece em 8, espaço na linha 7 absorveu!

    const slotsAfter2 = findEmptyGridSlots(resolveGridLayout(updated2.blocks));
    expect(slotsAfter2.some((s) => s.y === 5)).toBe(false);
    expect(slotsAfter2.some((s) => s.y === 7)).toBe(false);
  });

  it('compactLayout colapsa linhas vazias órfãs de layouts legados (ex: dash2.json com vácuo de 23 linhas)', () => {
    // Simula o caso real de dash2.json:
    // b11 era text.rich com rowSpan salvo de 24 em y=28 (terminando em y=52).
    // b3 (heading) foi salvo em y=52.
    // Com a regra de text.rich span=12 ter effectiveRowSpan=1, b11 ocupa apenas y=28 (termina em 29).
    // Isso deixaria as linhas 29..51 (23 linhas) 100% vazias.
    const legacyLayout: PageLayout = {
      v: 1,
      blocks: [
        {
          id: 'b11',
          type: 'text.rich',
          span: 12,
          rowSpan: 24,
          x: 0,
          y: 28,
          props: { content: 'Milestones' },
        },
        {
          id: 'b3',
          type: 'heading',
          span: 12,
          rowSpan: 1,
          x: 0,
          y: 52,
          props: { text: '1. Objetivo' },
        },
      ],
    };

    const compacted = compactLayout(legacyLayout, 12);
    const b11After = findBlock(compacted, 'b11')!.block;
    const b3After = findBlock(compacted, 'b3')!.block;

    // b11 deve começar no topo inicial compactado (ou y=0 se nada acima)
    expect(b11After.y).toBe(0);
    expect(b11After.rowSpan).toBe(1);

    // b3 deve encostar imediatamente abaixo de b11 (y=1) sem o buraco de 23 linhas!
    expect(b3After.y).toBe(1);
    expect(b3After.rowSpan).toBe(1);

    // Não deve existir nenhum slot vazio órfão entre b11 e b3
    const slots = findEmptyGridSlots(resolveGridLayout(compacted.blocks), 12);
    expect(slots.length).toBe(0);
  });
});

