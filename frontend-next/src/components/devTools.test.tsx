import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DevTools } from './devTools';
import { useApp } from '@/contexts/appProvider';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/contexts/appProvider', () => ({
  useApp: vi.fn(),
}));

function setup(app: Partial<ReturnType<typeof useApp>> = {}, client = new QueryClient()) {
  vi.mocked(useApp).mockReturnValue({
    devTools: true,
    reactScan: false,
    setReactScan: vi.fn(),
    setDevTools: vi.fn(),
    emulateError: false,
    setEmulateError: vi.fn(),
    ...app,
  } as ReturnType<typeof useApp>);

  const view = render(
    <QueryClientProvider client={client}>
      <DevTools />
    </QueryClientProvider>,
  );
  return { ...view, app: vi.mocked(useApp).mock.results.at(-1)?.value, client };
}

describe('DevTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a message when there are no active queries', async () => {
    setup();
    expect(await screen.findByText('Nenhuma query ativa')).toBeInTheDocument();
  });

  it('lists an active query with its key and status', async () => {
    const client = new QueryClient();
    client.setQueryData(['my-query', 1], { hello: 'world' });
    setup({}, client);

    expect(await screen.findByText('["my-query",1]')).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();
  });

  it('shows the query data inside a details/summary, rendered by Tree', async () => {
    const client = new QueryClient();
    client.setQueryData(['my-query'], { hello: 'world' });
    const user = userEvent.setup();
    setup({}, client);

    await screen.findByText('["my-query"]');
    const summary = screen.getByText('Dados');
    await user.click(summary);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('"world"')).toBeInTheDocument();
  });

  it('shows an error message when the query failed', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['failing-query'], undefined);
    client.getQueryCache().build(client, {
      queryKey: ['failing-query'],
      queryFn: () => Promise.reject(new Error('boom')),
    });
    const query = client.getQueryCache().find({ queryKey: ['failing-query'] });
    query?.setState({ status: 'error', error: new Error('boom'), fetchStatus: 'idle' });
    setup({}, client);

    expect(await screen.findByText(/Erro: Error: boom/)).toBeInTheDocument();
  });

  it('refetches a single query when its Refetch button is clicked', async () => {
    const client = new QueryClient();
    client.setQueryData(['my-query'], { hello: 'world' });
    const refetchSpy = vi.spyOn(client, 'refetchQueries');
    const user = userEvent.setup();
    setup({}, client);

    await screen.findByText('["my-query"]');
    await user.click(screen.getByText('Refetch'));
    expect(refetchSpy).toHaveBeenCalledWith({ queryKey: ['my-query'] });
  });

  it('refetches all queries when "Refetch Todas" is clicked', async () => {
    const client = new QueryClient();
    const refetchSpy = vi.spyOn(client, 'refetchQueries');
    const user = userEvent.setup();
    setup({}, client);

    await user.click(screen.getByText('Refetch Todas'));
    expect(refetchSpy).toHaveBeenCalledWith();
  });

  it('toggles reactScan via its switch', async () => {
    const setReactScan = vi.fn();
    const user = userEvent.setup();
    setup({ reactScan: false, setReactScan });

    await screen.findByText('Nenhuma query ativa');
    await user.click(screen.getByLabelText('React Scan'));
    expect(setReactScan).toHaveBeenCalledWith(true);
  });

  it('toggles emulateError via its switch', async () => {
    const setEmulateError = vi.fn();
    const user = userEvent.setup();
    setup({ emulateError: false, setEmulateError });

    await screen.findByText('Nenhuma query ativa');
    await user.click(screen.getByLabelText('Emulate Error'));
    expect(setEmulateError).toHaveBeenCalledWith(true);
  });
});
