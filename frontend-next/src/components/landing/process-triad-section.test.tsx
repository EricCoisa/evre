import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProcessTriadSection } from './process-triad-section';
import type { HomeProcessStep } from '@/lib/actions/cms/home/type';

describe('ProcessTriadSection', () => {
  it('renders default title, description and the 3 default steps', () => {
    render(<ProcessTriadSection />);

    expect(screen.getByText('Como trabalhamos')).toBeInTheDocument();
    expect(
      screen.getByText('Processo direto e transparente para garantir previsibilidade em cada etapa.')
    ).toBeInTheDocument();

    expect(screen.getByText('Planejamento & Arquitetura')).toBeInTheDocument();
    expect(screen.getByText('Desenvolvimento & Validação')).toBeInTheDocument();
    expect(screen.getByText('Implantação & Suporte')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
  });

  it('renders a custom title/description/steps set', () => {
    const steps: HomeProcessStep[] = [
      { id: 'a', stepNumber: '01', symbol: '<', title: 'Etapa Custom', description: 'Descrição custom' },
    ];
    render(
      <ProcessTriadSection title="Título custom" description="Descrição geral custom" steps={steps} />
    );

    expect(screen.getByText('Título custom')).toBeInTheDocument();
    expect(screen.getByText('Descrição geral custom')).toBeInTheDocument();
    expect(screen.getByText('Etapa Custom')).toBeInTheDocument();
    expect(screen.getByText('Descrição custom')).toBeInTheDocument();
    expect(screen.getAllByAltText('Etapa Custom').length).toBeGreaterThan(0);
  });

  it('falls back to the slash icon for an unmapped step symbol', () => {
    const steps = [
      {
        stepNumber: '09',
        symbol: '?' as unknown as HomeProcessStep['symbol'],
        title: 'Simbolo Desconhecido',
        description: 'desc',
      },
    ];
    render(<ProcessTriadSection steps={steps} />);

    const icons = screen.getAllByAltText('Simbolo Desconhecido') as HTMLImageElement[];
    expect(icons.length).toBeGreaterThan(0);
    const srcs = icons.map((img) => img.getAttribute('src') ?? '');
    expect(srcs.some((src) => src.includes('icon-slash'))).toBe(true);
  });

  it('renders no step cards when steps is an empty array', () => {
    render(<ProcessTriadSection steps={[]} />);

    expect(screen.queryByText('Planejamento & Arquitetura')).not.toBeInTheDocument();
  });
});
