import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SolutionsBento } from './solutions-bento';
import type { HomeService } from '@/lib/actions/cms/home/type';

describe('SolutionsBento', () => {
  it('renders default title, description and the 3 default services', () => {
    render(<SolutionsBento />);

    expect(screen.getByText('O que desenvolvemos')).toBeInTheDocument();
    expect(
      screen.getByText('Soluções digitais sob medida para resolver necessidades reais da sua operação.')
    ).toBeInTheDocument();

    expect(screen.getByText('Sistemas Web & Plataformas')).toBeInTheDocument();
    expect(screen.getByText('Aplicativos Mobile (iOS & Android)')).toBeInTheDocument();
    expect(screen.getByText('Integrações & Automação')).toBeInTheDocument();
  });

  it('renders a custom title/description/services set', () => {
    const services: HomeService[] = [
      { id: 'a', iconName: 'database', title: 'Serviço Custom', description: 'Descrição custom' },
    ];
    render(<SolutionsBento title="Título custom" description="Descrição geral custom" services={services} />);

    expect(screen.getByText('Título custom')).toBeInTheDocument();
    expect(screen.getByText('Descrição geral custom')).toBeInTheDocument();
    expect(screen.getByText('Serviço Custom')).toBeInTheDocument();
    expect(screen.getByText('Descrição custom')).toBeInTheDocument();
  });

  it('falls back to the Layers icon for an unmapped iconName', () => {
    const services = [
      {
        iconName: 'unknown-icon' as unknown as HomeService['iconName'],
        title: 'Serviço Sem Icone',
        description: 'desc',
      },
    ];
    const { container } = render(<SolutionsBento services={services} />);

    expect(screen.getByText('Serviço Sem Icone')).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-layers')).toBeTruthy();
  });

  it('renders no service cards when services is an empty array', () => {
    render(<SolutionsBento services={[]} />);

    expect(screen.queryByText('Sistemas Web & Plataformas')).not.toBeInTheDocument();
  });
});
