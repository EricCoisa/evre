import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { wrapWithEffect } from './effects';

describe('wrapWithEffect', () => {
  it('sem effect, devolve children sem embrulho', () => {
    render(<div>{wrapWithEffect(<span>conteúdo</span>, undefined)}</div>);
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('type desconhecido devolve children sem quebrar a tela', () => {
    render(<div>{wrapWithEffect(<span>conteúdo</span>, { type: 'nuclear-explosion' })}</div>);
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('tilt3d aplica o transform perspective/rotateX/rotateY com os params, ou o default sem eles', () => {
    const { container, rerender } = render(
      <div>{wrapWithEffect(<span>conteúdo</span>, { type: 'tilt3d', params: { rotateX: 10, rotateY: -4, perspective: 900 } })}</div>,
    );
    const el = container.querySelector('span')!.parentElement!;
    expect(el.style.transform).toBe('perspective(900px) rotateX(10deg) rotateY(-4deg)');

    rerender(<div>{wrapWithEffect(<span>conteúdo</span>, { type: 'tilt3d' })}</div>);
    const defaultEl = container.querySelector('span')!.parentElement!;
    expect(defaultEl.style.transform).toBe('perspective(1200px) rotateX(6deg) rotateY(3deg)');
  });

  it('liquid-distortion renderiza o filtro SVG ao redor do conteúdo', () => {
    const { container } = render(
      <div>{wrapWithEffect(<h1>Texto</h1>, { type: 'liquid-distortion', params: { strength: 10 } })}</div>,
    );
    expect(screen.getByRole('heading', { name: 'Texto' })).toBeInTheDocument();
    expect(container.querySelector('filter')).toBeInTheDocument();
  });
});
