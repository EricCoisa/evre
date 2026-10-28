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

  it('sem argumento lista os 13 blocos do catálogo', () => {
    expect(describeBlocks().map((b) => b.type).sort()).toEqual(
      [
        'alert.banner',
        'button.action',
        'chart.area',
        'chart.bar',
        'chart.line',
        'group',
        'iframe',
        'image',
        'investment',
        'list.feed',
        'table.basic',
        'text.rich',
        'topic',
      ],
    );
  });

  it('profile proposal não lista bloco que depende de fonte de dados', () => {
    const types = describeBlocks('proposal').map((b) => b.type);

    expect(types).not.toContain('table.basic');
    expect(types).not.toContain('list.feed');
    expect(types.filter((t) => t.startsWith('chart.'))).toEqual([]);
  });

  it('topic, image e investment aparecem em proposal e não em dashboard', () => {
    const proposalTypes = describeBlocks('proposal').map((b) => b.type);
    const dashboardTypes = describeBlocks('dashboard').map((b) => b.type);

    for (const type of ['topic', 'image', 'investment']) {
      expect(proposalTypes).toContain(type);
      expect(dashboardTypes).not.toContain(type);
    }
    expect(proposalTypes.sort()).toEqual([
      'alert.banner',
      'button.action',
      'group',
      'iframe',
      'image',
      'investment',
      'text.rich',
      'topic',
    ]);
  });

  it('profile dashboard continua com o mesmo conjunto de 9 blocos de antes', () => {
    expect(describeBlocks('dashboard').map((b) => b.type).sort()).toEqual([
      'alert.banner',
      'button.action',
      'chart.area',
      'chart.bar',
      'chart.line',
      'group',
      'list.feed',
      'table.basic',
      'text.rich',
    ]);
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
