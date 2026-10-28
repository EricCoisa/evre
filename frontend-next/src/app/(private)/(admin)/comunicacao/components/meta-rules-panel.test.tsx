import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetaRulesPanel } from './meta-rules-panel';

// Como o `t` do projeto: sem tradução devolve a própria chave; com `{param}` substitui.
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const table: Record<string, string> = {
        'metaRule.URL_SHORTENER': 'Link encurtado ({host}) é recusado.',
      };
      const base = table[key] ?? key;
      return Object.entries(params ?? {}).reduce((out, [k, v]) => out.replace(`{${k}}`, String(v)), base);
    },
  }),
}));

const issue = (over: Record<string, unknown>) => ({
  code: 'X',
  severity: 'error',
  field: 'body',
  message: 'mensagem do servidor',
  ...over,
});

describe('MetaRulesPanel', () => {
  it('sem problemas não renderiza nada', () => {
    const { container } = render(<MetaRulesPanel issues={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('separa erros (bloqueiam) de avisos, e usa a tradução com os parâmetros', () => {
    render(
      <MetaRulesPanel
        issues={[
          issue({ code: 'URL_SHORTENER', params: { host: 'bit.ly' } }),
          issue({ code: 'UTILITY_WITHOUT_VARIABLES', severity: 'warning', message: 'aviso do servidor' }),
        ] as never}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Link encurtado (bit.ly) é recusado.');
    expect(screen.getByRole('note')).toHaveTextContent('aviso do servidor'); // sem tradução: mensagem do servidor
    expect(screen.getByText('metaRulesErrorsHelp')).toBeInTheDocument();
  });

  it('só avisos: não mostra o bloco de erro', () => {
    render(<MetaRulesPanel issues={[issue({ code: 'A', severity: 'warning' })] as never} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('note')).toBeInTheDocument();
  });
});
