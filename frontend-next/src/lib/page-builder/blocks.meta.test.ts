import { describe, it, expect } from 'vitest';
import { BLOCK_META, describeBlocks } from './blocks.meta';

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

  it('devolve cópias — mutar o resultado não afeta o catálogo real', () => {
    const result = describeBlocks();
    const chartArea = result.find((b) => b.type === 'chart.area')!;

    chartArea.props.push({ name: 'inventado', type: 'string', required: false });
    chartArea.accepts.push('count');

    expect(BLOCK_META['chart.area'].props).toHaveLength(2);
    expect(BLOCK_META['chart.area'].accepts).toHaveLength(1);
  });
});
