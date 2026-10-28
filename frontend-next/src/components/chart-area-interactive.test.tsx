import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

// ResponsiveContainer never gets a real size under jsdom, so recharts' real chart primitives
// never draw anything — mock them to expose the data/props they receive instead.
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
  AreaChart: ({ data, children }: { data: { date: string }[]; children: ReactNode }) => (
    <div data-testid="area-chart" data-count={data.length}>
      {children}
    </div>
  ),
  Area: ({ dataKey }: { dataKey: string }) => <div data-testid={`area-${dataKey}`} />,
  CartesianGrid: () => null,
  XAxis: () => null,
  Tooltip: () => null,
}));

const useMobileMock = vi.hoisted(() => vi.fn().mockReturnValue(false));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: useMobileMock }));

import { ChartAreaInteractive } from './chart-area-interactive';

function toggleGroup() {
  return within(document.querySelector('[data-slot="toggle-group"]') as HTMLElement);
}

beforeEach(() => {
  useMobileMock.mockReturnValue(false);
});

describe('ChartAreaInteractive', () => {
  it('renderiza título, descrição e os dois Area (desktop/mobile) por padrão em 90d', () => {
    render(<ChartAreaInteractive />);

    expect(screen.getByText('Total Visitors')).toBeInTheDocument();
    expect(screen.getByTestId('area-desktop')).toBeInTheDocument();
    expect(screen.getByTestId('area-mobile')).toBeInTheDocument();
    expect(screen.getByTestId('area-chart')).toHaveAttribute('data-count', '91');
  });

  it('o toggle "Last 3 months" começa selecionado', () => {
    render(<ChartAreaInteractive />);
    expect(toggleGroup().getByRole('radio', { name: 'Last 3 months' })).toHaveAttribute('data-state', 'on');
  });

  it('clicar em "Last 30 days" filtra para 31 dias e seleciona esse toggle', async () => {
    render(<ChartAreaInteractive />);

    await userEvent.click(toggleGroup().getByRole('radio', { name: 'Last 30 days' }));

    expect(screen.getByTestId('area-chart')).toHaveAttribute('data-count', '31');
    expect(toggleGroup().getByRole('radio', { name: 'Last 30 days' })).toHaveAttribute('data-state', 'on');
    expect(toggleGroup().getByRole('radio', { name: 'Last 3 months' })).toHaveAttribute('data-state', 'off');
  });

  it('clicar em "Last 7 days" filtra para 8 dias', async () => {
    render(<ChartAreaInteractive />);

    await userEvent.click(toggleGroup().getByRole('radio', { name: 'Last 7 days' }));

    expect(screen.getByTestId('area-chart')).toHaveAttribute('data-count', '8');
  });

  it('entrar em mobile depois do mount força o range para 7d', () => {
    const { rerender } = render(<ChartAreaInteractive />);
    expect(screen.getByTestId('area-chart')).toHaveAttribute('data-count', '91');

    useMobileMock.mockReturnValue(true);
    rerender(<ChartAreaInteractive />);

    expect(screen.getByTestId('area-chart')).toHaveAttribute('data-count', '8');
  });

  it('iniciar já em mobile não força 7d (só a transição força)', () => {
    useMobileMock.mockReturnValue(true);
    render(<ChartAreaInteractive />);

    expect(screen.getByTestId('area-chart')).toHaveAttribute('data-count', '91');
  });
});
