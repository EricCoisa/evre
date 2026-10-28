import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSuspenseQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { AsyncBoundary } from '@/components/async-boundary';
import { ConfigRow } from '@/components/config-row';
import i18n from '../../i18n';

// A chave nasce fora: `useState` dentro de um componente que suspende re-roda o
// inicializador a cada retentativa, gerando chave nova e suspendendo para sempre.
let probeId = 0;
const nextKey = () => ['probe', probeId++];

function Probe({ queryKey, fetcher }: { queryKey: unknown[]; fetcher: () => Promise<string> }) {
  const { data } = useSuspenseQuery({ queryKey, queryFn: fetcher });
  return <span>{data}</span>;
}

/** Testa o ciclo completo do boundary: skeleton, erro e retry refazendo a busca. */
describe('AsyncBoundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mostra o skeleton enquanto suspenso e o conteúdo depois', async () => {
    const fetcher = vi.fn().mockResolvedValue('carregado');
    const { container } = render(
      <AsyncBoundary>
        <Probe queryKey={nextKey()} fetcher={fetcher} />
      </AsyncBoundary>,
    );

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    await waitFor(() => expect(screen.getByText('carregado')).toBeTruthy());
  });

  it('em falha mostra o ErrorState e o retry refaz a busca', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('recuperado');

    render(
      <AsyncBoundary>
        <Probe queryKey={nextKey()} fetcher={fetcher} />
      </AsyncBoundary>,
    );

    await waitFor(() => expect(screen.getByText('boom')).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: i18n.t('tryAgain', { ns: 'common' }) }));
    await waitFor(() => expect(screen.getByText('recuperado')).toBeTruthy());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('com errorFallback customizado, usa-o no lugar do ErrorState padrão e repassa o retry', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('recuperado');

    render(
      <AsyncBoundary errorFallback={(retry) => <button onClick={retry}>tentar de novo custom</button>}>
        <Probe queryKey={nextKey()} fetcher={fetcher} />
      </AsyncBoundary>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'tentar de novo custom' })).toBeTruthy());
    expect(screen.queryByText('boom')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'tentar de novo custom' }));
    await waitFor(() => expect(screen.getByText('recuperado')).toBeTruthy());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

/** Testa que o skeleton cobre título, descrição e campo juntos como unidade de carregamento. */
describe('ConfigRow — boundary por linha', () => {
  it('esconde título e descrição enquanto o campo carrega', async () => {
    const fetcher = vi.fn().mockResolvedValue('valor');

    render(
      <ConfigRow title="Limite de log" description="quantos registros guardar">
        <Probe queryKey={nextKey()} fetcher={fetcher} />
      </ConfigRow>,
    );

    expect(screen.queryByText('Limite de log')).toBeNull();
    expect(screen.queryByText('quantos registros guardar')).toBeNull();

    await waitFor(() => expect(screen.getByText('valor')).toBeTruthy());
    expect(screen.getByText('Limite de log')).toBeTruthy();
  });

  it('linha sem query renderiza direto, sem passar pelo boundary', () => {
    render(
      <ConfigRow title="Tema" description="claro ou escuro">
        <button>alternar</button>
      </ConfigRow>,
    );

    expect(screen.getByText('Tema')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'alternar' })).toBeTruthy();
  });
});
