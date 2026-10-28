import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Feature } from './feature';

const mockUseFeatureFlag = vi.hoisted(() => vi.fn());
vi.mock('@/lib/actions/feature-flag/queries', () => ({
  useFeatureFlag: mockUseFeatureFlag,
}));

describe('Feature', () => {
  it('flag habilitada: renderiza os children', () => {
    mockUseFeatureFlag.mockReturnValue(true);
    render(<Feature flag="NEW_UI">conteudo</Feature>);

    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });

  it('flag desabilitada sem fallback: não renderiza nada', () => {
    mockUseFeatureFlag.mockReturnValue(false);
    const { container } = render(<Feature flag="NEW_UI">conteudo</Feature>);

    expect(container).toBeEmptyDOMElement();
  });

  it('flag desabilitada com fallback: renderiza o fallback', () => {
    mockUseFeatureFlag.mockReturnValue(false);
    render(<Feature flag="NEW_UI" fallback={<span>desligado</span>}>conteudo</Feature>);

    expect(screen.getByText('desligado')).toBeInTheDocument();
    expect(screen.queryByText('conteudo')).not.toBeInTheDocument();
  });
});
