import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree } from './tree';

describe('Tree', () => {
  it('renders a string primitive as JSON (quoted)', () => {
    render(<Tree data="hello" />);
    expect(screen.getByText('"hello"')).toBeInTheDocument();
  });

  it('renders a number primitive', () => {
    render(<Tree data={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders a boolean primitive', () => {
    render(<Tree data={true} />);
    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('renders null and undefined as their string form', () => {
    const { rerender } = render(<Tree data={null} />);
    expect(screen.getByText('null')).toBeInTheDocument();
    rerender(<Tree data={undefined} />);
    expect(screen.getByText('undefined')).toBeInTheDocument();
  });

  it('renders an object with its keys and values, expandable via the toggle button', async () => {
    const user = userEvent.setup();
    render(<Tree data={{ a: 1, nested: { b: 2 } }} />);

    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('nested')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    const toggle = screen.getByText('-');
    await user.click(toggle);
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.queryByText('2')).toBeNull();

    await user.click(screen.getByText('+'));
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders an array with bracketed indices, expandable via the toggle button', async () => {
    const user = userEvent.setup();
    render(<Tree data={[10, [20, 30]]} />);

    expect(screen.getAllByText('[0]').length).toBeGreaterThan(0);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();

    const toggle = screen.getByText('-');
    await user.click(toggle);
    expect(screen.queryByText('20')).toBeNull();
    expect(screen.queryByText('30')).toBeNull();
  });

  it('does not render a collapse toggle for leaves without children', () => {
    render(<Tree data={{ a: 1 }} />);
    expect(screen.queryByText('-')).toBeNull();
    expect(screen.queryByText('+')).toBeNull();
  });

  it('limits top-level array items to maxLines, without limiting nested levels', () => {
    render(<Tree data={[1, 2, 3, 4, 5]} maxLines={2} />);
    expect(screen.getByText('[0]')).toBeInTheDocument();
    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(screen.queryByText('[2]')).toBeNull();
  });

  it('limits top-level object entries to maxLines', () => {
    render(<Tree data={{ a: 1, b: 2, c: 3 }} maxLines={1} />);
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.queryByText('b')).toBeNull();
  });

  it('applies custom color classes to keys, values, and null/index markers', () => {
    render(
      <Tree
        data={{ a: 1 }}
        keyColor="text-key-custom"
        valueColor="text-value-custom"
        nullColor="text-null-custom"
      />,
    );
    expect(screen.getByText('1').className).toContain('text-key-custom');
    expect(screen.getByText('a').className).toContain('text-value-custom');
  });
});
