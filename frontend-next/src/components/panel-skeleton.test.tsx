import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PanelSkeleton } from './panel-skeleton';

describe('PanelSkeleton', () => {
  it('renderiza com aria-busy para indicar carregamento', () => {
    const { container } = render(<PanelSkeleton />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renderiza sem props e sem erros', () => {
    const { container } = render(<PanelSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });
});
