import { describe, it, expect } from 'vitest';
import { PageLayoutSchema, MAX_BLOCKS, MAX_CHILDREN, type PageLayout } from '../schema';
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
  setBlockSource,
  updateBlock,
  canDrop,
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
        { id: 'c2', type: 'alert.banner', span: 2, props: {} },
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
});

describe('addBlock / createBlock', () => {
  it('container nasce com children, folha não', () => {
    expect(createBlock('group').children).toEqual([]);
    expect(createBlock('alert.banner').children).toBeUndefined();
  });

  it('filho nasce com meia largura e bloco de topo com largura cheia', () => {
    expect(createBlock('alert.banner').span).toBe(12);
    expect(createBlock('alert.banner', 'g').span).toBe(6);
  });

  it('gera ids únicos', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createBlock('alert.banner').id));

    expect(ids.size).toBe(50);
  });

  it('adiciona no topo e dentro de um container', () => {
    const child = createBlock('alert.banner', 'g');
    const next = addBlock(layout(), child, 'g');

    expect(findBlock(next, child.id)!.parentId).toBe('g');
    expect(next.blocks).toHaveLength(2);
  });

  it('respeita o teto de blocos da página', () => {
    let full = EMPTY_LAYOUT;
    for (let i = 0; i < MAX_BLOCKS; i++) full = addBlock(full, createBlock('alert.banner'));

    expect(canAdd(full)).toBe(false);
    expect(addBlock(full, createBlock('alert.banner')).blocks).toHaveLength(MAX_BLOCKS);
    expect(PageLayoutSchema.safeParse(full).success).toBe(true);
  });

  it('respeita o teto de filhos de um container', () => {
    let full = addBlock(EMPTY_LAYOUT, { ...createBlock('group'), id: 'g' });
    for (let i = 0; i < MAX_CHILDREN; i++) {
      full = addBlock(full, createBlock('alert.banner', 'g'), 'g');
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
      full = addBlock(full, createBlock('alert.banner', 'g'), 'g');
    }
    full = addBlock(full, { ...createBlock('alert.banner'), id: 'solto' });

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
      { id: 'g', type: 'group', span: 4, props: {}, children: [{ id: 'c1', type: 'alert.banner', span: 2, props: {} }] },
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
