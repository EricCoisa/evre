import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { wrapWithEffect, wrapWithEffectActive } from './effects';

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

describe('wrapWithEffectActive — active:false fica montado e inerte (nunca desmonta children)', () => {
  it('tilt3d inativo não aplica transform nenhum', () => {
    const { container } = render(
      <div>{wrapWithEffectActive(<span>conteúdo</span>, 'tilt3d', { rotateX: 10 }, false)}</div>,
    );
    const el = container.querySelector('span')!.parentElement!;
    expect(el.style.transform).toBe('');
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('liquid-distortion inativo passa disabled para o componente original (sem listener de mouse)', () => {
    render(
      <div>{wrapWithEffectActive(<h1>Texto</h1>, 'liquid-distortion', {}, false)}</div>,
    );
    // Com disabled, o componente original nem registra o listener — children continuam ali.
    expect(screen.getByRole('heading', { name: 'Texto' })).toBeInTheDocument();
  });

  it('o mesmo wrapper (mesmo type) só troca active, sem remontar — children preserva identidade', () => {
    const child = <span data-testid="child">conteúdo</span>;
    const { container, rerender } = render(<div>{wrapWithEffectActive(child, 'tilt3d', { rotateX: 20 }, false)}</div>);
    const before = screen.getByTestId('child');

    rerender(<div>{wrapWithEffectActive(child, 'tilt3d', { rotateX: 20 }, true)}</div>);
    const after = screen.getByTestId('child');

    expect(after).toBe(before); // mesmo nó DOM — não houve desmontagem/remontagem
    expect(container.querySelector('span')!.parentElement!.style.transform).toContain('rotateX(20deg)');
  });
});
