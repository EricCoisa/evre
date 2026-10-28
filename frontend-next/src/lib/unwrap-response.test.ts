import { describe, it, expect } from 'vitest';
import { QueryClient, dehydrate } from '@tanstack/react-query';
import { unwrap } from './unwrap-response';

/** O que `lib/api/api.ts` devolve quando a chamada falha — resolvido, não rejeitado. */
const failed = { success: false, data: null, message: 'backend fora do ar', status: 500 };
const ok = { success: true, data: { value: 'dark' }, message: '', status: 200 };

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('unwrap + dehydrate', () => {
  it('deixa a query de fora da desidratação quando a chamada falhou', async () => {
    const qc = client();
    await qc.prefetchQuery({
      queryKey: ['user-configuration', 'qualquer-chave'],
      queryFn: () => unwrap(Promise.resolve(failed)),
    });

    // Fora da desidratação = o cliente busca por conta própria, passando pelo Alive
    // (401 → refresh → logout). É o comportamento que existia antes do prefetch.
    expect(dehydrate(qc).queries).toHaveLength(0);
  });

  it('entrega o dado ao cliente quando a chamada deu certo', async () => {
    const qc = client();
    await qc.prefetchQuery({
      queryKey: ['user-configuration', 'qualquer-chave'],
      queryFn: () => unwrap(Promise.resolve(ok)),
    });

    const [query] = dehydrate(qc).queries;
    expect(query.queryKey).toEqual(['user-configuration', 'qualquer-chave']);
    expect(query.state.data).toEqual({ value: 'dark' });
  });

  // Guarda o motivo do unwrap existir: sem o throw, falha vira null cacheado como sucesso.
  // Com refetchOnMount: false, ninguém busca de novo e a preferência cai no default calada.
  it('sem o unwrap, a falha viajaria para o cliente como sucesso com null', async () => {
    const qc = client();
    await qc.prefetchQuery({
      queryKey: ['user-configuration', 'qualquer-chave'],
      queryFn: async () => (await Promise.resolve(failed)).data,
    });

    const [query] = dehydrate(qc).queries;
    expect(query.state.status).toBe('success');
    expect(query.state.data).toBeNull();
  });
});
