import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShowcaseSection } from './showcase-section';

vi.mock('./artifact-frame', () => ({
  ArtifactFrame: ({ demos, className }: { demos?: Array<{ label: string; url: string }>; className?: string }) => (
    <div data-testid="artifact-frame" className={className} data-count={demos?.length || 0} />
  ),
}));

describe('ShowcaseSection', () => {
  it('renders showcase content with media on the right by default', () => {
    const { container } = render(
      <ShowcaseSection
        anchorId="sites"
        label="Sites & Landing Pages"
        title="Para quem quer vender"
        description="Descrição de sites"
        mediaPosition="right"
      />
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Para quem quer vender');
    expect(screen.getByText('Sites & Landing Pages')).toBeInTheDocument();
    expect(screen.getByText('Descrição de sites')).toBeInTheDocument();
    expect(container.querySelector('#sites')).toBeInTheDocument();
  });

  it('renders showcase content with media on the left when specified', () => {
    const { container } = render(
      <ShowcaseSection
        anchorId="sistemas"
        label="Sistemas para empresas"
        title="Para quem precisa de mais"
        description="Descrição de sistemas"
        mediaPosition="left"
        demos={[{ url: 'https://demo.app', label: 'Demo 1' }]}
      />
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Para quem precisa de mais');
    expect(container.querySelector('#sistemas')).toBeInTheDocument();
    const frame = screen.getByTestId('artifact-frame');
    expect(frame).toHaveAttribute('data-count', '1');
  });
});
