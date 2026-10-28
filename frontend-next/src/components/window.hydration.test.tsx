import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act } from 'react';
import { Window } from './window';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** Garante que o portal da janela não exista no primeiro render do cliente, evitando mismatch de hidratação. */
describe('Window — hidratação', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hidrata sem divergência entre servidor e cliente', async () => {
    const errors: unknown[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args[0]));

    const element = (
      <Window title="Dev Tools" name="teste-hidratacao" enabled>
        <p>conteudo</p>
      </Window>
    );

    const container = document.createElement('div');
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);

    await act(async () => {
      hydrateRoot(container, element);
    });

    const mismatch = errors.filter((e) => String(e).includes('Hydration failed') || String(e).includes("didn't match"));
    expect(mismatch).toEqual([]);
  });

  it('o servidor não emite marcação nenhuma para a janela', () => {
    const html = renderToString(
      <Window title="Dev Tools" name="teste-ssr" enabled>
        <p>conteudo</p>
      </Window>,
    );
    expect(html).toBe('');
  });
});
