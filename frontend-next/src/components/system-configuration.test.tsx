import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUseConfiguration = vi.hoisted(() => vi.fn());
const mockUseUpdateConfiguration = vi.hoisted(() => vi.fn());
const mockUseScreenItem = vi.hoisted(() => vi.fn());

vi.mock('@/lib/actions/systemConfiguration/queries', () => ({
  useConfiguration: mockUseConfiguration,
  useUpdateConfiguration: mockUseUpdateConfiguration,
}));
vi.mock('@/components/agent/screen-registry', () => ({
  useScreenItem: mockUseScreenItem,
}));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

import { SystemConfiguration } from './system-configuration';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const baseData = {
  id: 'cfg-1',
  labelKey: 'SOME_KEY',
  valueType: 'BOOLEAN' as const,
  value: 'true',
};

beforeEach(() => {
  mockUseConfiguration.mockReturnValue({ data: baseData });
  mockUseUpdateConfiguration.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  mockUseScreenItem.mockReturnValue(undefined);
  vi.clearAllMocks();
});

describe('SystemConfiguration', () => {
  it('renderiza o switch de configuração', () => {
    render(<SystemConfiguration labelKey="SOME_KEY" />, { wrapper });
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('blocked=true: switch fica desabilitado', () => {
    mockUseConfiguration.mockReturnValue({ data: { ...baseData, blocked: true } });
    render(<SystemConfiguration labelKey="SOME_KEY" />, { wrapper });
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('disabled=true: switch fica desabilitado', () => {
    render(<SystemConfiguration labelKey="SOME_KEY" disabled={true} />, { wrapper });
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('data=null: renderiza fallback de not_found', () => {
    mockUseConfiguration.mockReturnValue({ data: null });
    render(<SystemConfiguration labelKey="MISSING_KEY" />, { wrapper });
    expect(screen.getByText(/not_found/)).toBeInTheDocument();
  });
});
