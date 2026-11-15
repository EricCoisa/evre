import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfigRow, ConfigList } from './config-row';

describe('ConfigRow', () => {
  it('renderiza título e children', () => {
    render(
      <ConfigRow title="Título da configuração">
        <input aria-label="valor" />
      </ConfigRow>
    );
    expect(screen.getByText('Título da configuração')).toBeInTheDocument();
    expect(screen.getByLabelText('valor')).toBeInTheDocument();
  });

  it('renderiza description quando fornecida', () => {
    render(
      <ConfigRow title="T" description="Detalhe da configuração">
        <span />
      </ConfigRow>
    );
    expect(screen.getByText('Detalhe da configuração')).toBeInTheDocument();
  });

  it('sem description: não renderiza parágrafo de descrição', () => {
    const { container } = render(
      <ConfigRow title="T">
        <span />
      </ConfigRow>
    );
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('aceita id para deep-link', () => {
    const { container } = render(
      <ConfigRow title="T" id="ancora-config">
        <span />
      </ConfigRow>
    );
    expect(container.querySelector('#ancora-config')).toBeInTheDocument();
  });
});

describe('ConfigList', () => {
  it('renderiza os filhos com divide-y', () => {
    render(
      <ConfigList>
        <div>item 1</div>
        <div>item 2</div>
      </ConfigList>
    );
    expect(screen.getByText('item 1')).toBeInTheDocument();
    expect(screen.getByText('item 2')).toBeInTheDocument();
  });
});
