import { describe, it, expect } from 'vitest';
import { BLOCK_META, describeBlocks } from './blocks.meta';
import { LAYOUT_PROFILES, type LayoutProfileName } from './profiles';

describe('describeBlocks', () => {
  it('descreve cada bloco com type, description, accepts e container', () => {
    const result = describeBlocks();

    expect(result).toHaveLength(Object.keys(BLOCK_META).length);

    const group = result.find((b) => b.type === 'group')!;
    expect(group.container).toBe(true);
    expect(group.accepts).toEqual([]);
    expect(group.props).toEqual(BLOCK_META.group.props);

    const textRich = result.find((b) => b.type === 'text.rich')!;
    expect(textRich.container).toBe(false);
    expect(textRich.inline).toBe(true);
    expect(textRich.optionalSource).toBe(true);
    expect(textRich.accepts).toEqual(['list', 'count', 'series']);
  });

  it('sem argumento lista os 15 blocos do catálogo', () => {
    expect(describeBlocks().map((b) => b.type).sort()).toEqual(
      [
        'button.action',
        'chart.area',
        'chart.bar',
        'chart.line',
        'divider',
        'group',
        'heading',
        'iframe',
        'image',
        'investment',
        'list.feed',
        'price',
        'table.basic',
        'text.rich',
        'topic',
      ],
    );
  });

  // A4: profile proposal passou de dataSources 'none' para 'inline-only' — os 5 blocos de dado
  // agora funcionam na proposta, só que lendo `data.inline` em vez de `data.source`.
  it('profile proposal agora lista os 5 blocos de dado (JSON inline)', () => {
    const types = describeBlocks('proposal').map((b) => b.type);

    expect(types).toContain('table.basic');
    expect(types).toContain('list.feed');
    expect(types.filter((t) => t.startsWith('chart.'))).toEqual([
      'chart.area',
      'chart.bar',
      'chart.line',
    ]);
  });

  it('topic, image e investment aparecem em proposal e não em dashboard', () => {
    const proposalTypes = describeBlocks('proposal').map((b) => b.type);
    const dashboardTypes = describeBlocks('dashboard').map((b) => b.type);

    for (const type of ['topic', 'image', 'investment']) {
      expect(proposalTypes).toContain(type);
      expect(dashboardTypes).not.toContain(type);
    }
    expect(proposalTypes.sort()).toEqual([
      'button.action',
      'chart.area',
      'chart.bar',
      'chart.line',
      'divider',
      'group',
      'heading',
      'iframe',
      'image',
      'investment',
      'list.feed',
      'price',
      'table.basic',
      'text.rich',
      'topic',
    ]);
  });

  it('price só existe no profile proposal — é apresentação da proposta, não do dashboard', () => {
    const proposalTypes = describeBlocks('proposal').map((b) => b.type);
    const dashboardTypes = describeBlocks('dashboard').map((b) => b.type);

    expect(proposalTypes).toContain('price');
    expect(dashboardTypes).not.toContain('price');
  });

  it('heading e divider aparecem nos dois profiles — são estrutura de seção, não conteúdo', () => {
    const proposalTypes = describeBlocks('proposal').map((b) => b.type);
    const dashboardTypes = describeBlocks('dashboard').map((b) => b.type);

    for (const type of ['heading', 'divider']) {
      expect(proposalTypes).toContain(type);
      expect(dashboardTypes).toContain(type);
    }
  });

  it('profile dashboard ganhou heading e divider — agora 10 blocos', () => {
    expect(describeBlocks('dashboard').map((b) => b.type).sort()).toEqual([
      'button.action',
      'chart.area',
      'chart.bar',
      'chart.line',
      'divider',
      'group',
      'heading',
      'list.feed',
      'table.basic',
      'text.rich',
    ]);
  });

  it('padronização: blocos da família series (chart.area, chart.bar, chart.line) têm props idênticas para troca direta', () => {
    const seriesBlocks = ['chart.area', 'chart.bar', 'chart.line'] as const;
    const firstProps = BLOCK_META[seriesBlocks[0]].props;
    expect(firstProps).toEqual([
      { name: 'title', type: 'string', required: false },
      { name: 'description', type: 'string', required: false },
    ]);
    for (const type of seriesBlocks.slice(1)) {
      expect(BLOCK_META[type].props).toEqual(firstProps);
    }
  });

  it('padronização: blocos da família list (table.basic, list.feed) têm props idênticas para troca direta', () => {
    const listBlocks = ['table.basic', 'list.feed'] as const;
    const firstProps = BLOCK_META[listBlocks[0]].props;
    expect(firstProps).toEqual([
      { name: 'title', type: 'string', required: false },
      { name: 'description', type: 'string', required: false },
      { name: 'columns', type: 'string[]', required: true },
    ]);
    for (const type of listBlocks.slice(1)) {
      expect(BLOCK_META[type].props).toEqual(firstProps);
    }
  });

  // BLOCK_META[t].profiles e LAYOUT_PROFILES[p].blocks declaram o mesmo fato em dois lugares:
  // divergir ofereceria no editor um bloco que o validador recusa (ou o contrário).
  it.each(Object.keys(LAYOUT_PROFILES) as LayoutProfileName[])(
    'os blocos do profile %s batem com LAYOUT_PROFILES',
    (profile) => {
      expect(describeBlocks(profile).map((b) => b.type).sort()).toEqual(
        [...LAYOUT_PROFILES[profile].blocks].sort(),
      );
    },
  );

  it('devolve cópias — mutar o resultado não afeta o catálogo real', () => {
    const result = describeBlocks();
    const chartArea = result.find((b) => b.type === 'chart.area')!;

    chartArea.props.push({ name: 'inventado', type: 'string', required: false });
    chartArea.accepts.push('count');

    expect(BLOCK_META['chart.area'].props).toHaveLength(2);
    expect(BLOCK_META['chart.area'].accepts).toHaveLength(1);
  });
});
