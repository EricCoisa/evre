import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TemplateButtonsEditor, draftsFrom, type ButtonDraft } from './template-buttons-editor';
import type { MessagingTemplateCategory, TemplateButton } from '@/lib/actions/messaging/types';
import type { SlotInfo } from '@/lib/messaging/template-buttons';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'pt-BR' }),
}));

function Harness({
  category = 'UTILITY',
  initial = [],
  onDrafts,
  showErrors = false,
  nativeSupported = true,
  slots = [],
}: {
  category?: MessagingTemplateCategory;
  initial?: TemplateButton[];
  onDrafts?: (d: ButtonDraft[]) => void;
  showErrors?: boolean;
  nativeSupported?: boolean;
  slots?: SlotInfo[];
}) {
  const [drafts, setDrafts] = useState(() => draftsFrom(initial));
  return (
    <TemplateButtonsEditor
      category={category}
      drafts={drafts}
      onChange={(next) => {
        setDrafts(next);
        onDrafts?.(next);
      }}
      variables={[]}
      reserved={[]}
      usedNames={new Set()}
      showErrors={showErrors}
      nativeSupported={nativeSupported}
      slots={slots}
    />
  );
}

describe('TemplateButtonsEditor', () => {
  it('AUTHENTICATION esconde a edição e explica o botão fixo da Meta', () => {
    render(<Harness category="AUTHENTICATION" />);
    expect(screen.getByText('buttonsAuthFixed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /buttonAdd/ })).not.toBeInTheDocument();
  });

  it('adiciona vários botões pelo menu e remove um deles', () => {
    const seen: ButtonDraft[][] = [];
    render(<Harness onDrafts={(d) => seen.push(d)} />);

    fireEvent.keyDown(screen.getByRole('button', { name: /buttonAdd/ }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: /buttonKind.URL/ }));
    fireEvent.keyDown(screen.getByRole('button', { name: /buttonAdd/ }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: /buttonKind.QUICK_REPLY/ }));
    expect(seen.at(-1)?.map((d) => d.button.kind)).toEqual(['URL', 'QUICK_REPLY']);

    fireEvent.click(screen.getAllByRole('button', { name: 'buttonRemove' })[0]);
    expect(seen.at(-1)?.map((d) => d.button.kind)).toEqual(['QUICK_REPLY']);
  });

  it('mostra o erro do botão incompleto só depois da tentativa de salvar', () => {
    const { rerender } = render(<Harness initial={[{ kind: 'URL', label: '', url: '' }]} />);
    expect(screen.queryByText('buttonErrLabel')).not.toBeInTheDocument();
    rerender(<Harness initial={[{ kind: 'URL', label: '', url: '' }]} showErrors />);
    expect(screen.getByText('buttonErrLabel')).toBeInTheDocument();
  });

  it('reordena com as setas', () => {
    const seen: ButtonDraft[][] = [];
    render(
      <Harness
        initial={[
          { kind: 'URL', label: 'A', url: 'https://a.com' },
          { kind: 'URL', label: 'B', url: 'https://b.com' },
        ]}
        onDrafts={(d) => seen.push(d)}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'buttonMoveDown' })[0]);
    expect(seen.at(-1)?.map((d) => d.button.label)).toEqual(['B', 'A']);
  });

  it('sem conexão que envie botões (Evolution): informa e desabilita o "Adicionar"', () => {
    render(<Harness nativeSupported={false} />);
    expect(screen.getByRole('note')).toHaveTextContent('buttonsUnsupported');
    expect(screen.getByRole('button', { name: /buttonAdd/ })).toBeDisabled();
  });

  it('botões já salvos ficam visíveis e só podem ser removidos quando não há suporte nativo', () => {
    const seen: ButtonDraft[][] = [];
    render(
      <Harness
        nativeSupported={false}
        initial={[{ kind: 'URL', label: 'Ver', url: 'https://x.com' }]}
        onDrafts={(d) => seen.push(d)}
      />,
    );
    expect(screen.getByRole('note')).toHaveTextContent('buttonsUnsupportedExisting');
    expect(screen.getByDisplayValue('Ver')).toBeDisabled();
    expect(screen.getByDisplayValue('https://x.com')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'buttonMoveDown' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'buttonRemove' }));
    expect(seen.at(-1)).toEqual([]);
  });

  describe('botões tipados do tipo', () => {
    const SLOTS: SlotInfo[] = [
      { key: 'accept', kind: 'QUICK_REPLY', reserved: false, required: true },
      { key: 'track', kind: 'URL', reserved: false, required: false, urlBase: 'https://app.test/o/' },
      { key: 'opt_out', kind: 'QUICK_REPLY', reserved: true, required: false, defaultLabel: 'Parar' },
    ];
    const accept: TemplateButton = { kind: 'QUICK_REPLY', label: 'Aceitar', slot: 'accept' };

    it('linha de espaço mostra a chave, trava o tipo e não deixa remover o obrigatório', () => {
      render(<Harness slots={SLOTS} initial={[accept]} />);
      expect(screen.getByText('accept')).toBeInTheDocument();
      expect(screen.getByText('buttonRequiredBadge')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'buttonRemove' })).not.toBeInTheDocument();
      // O texto continua sendo do operador.
      expect(screen.getByDisplayValue('Aceitar')).toBeEnabled();
    });

    it('link do sistema mostra a URL do tipo (somente leitura) em vez de um campo editável', () => {
      render(
        <Harness
          slots={SLOTS}
          initial={[accept, { kind: 'URL', label: 'Ver', url: 'https://app.test/o/{{ track }}', slot: 'track' }]}
        />,
      );
      expect(screen.getByText('https://app.test/o/{{ track }}')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/exemplo.com/)).not.toBeInTheDocument();
      // Opcional pode sair.
      expect(screen.getAllByRole('button', { name: 'buttonRemove' })).toHaveLength(1);
    });

    it('menu oferece os espaços opcionais ainda não usados e inclui o botão com o texto sugerido', () => {
      const seen: ButtonDraft[][] = [];
      render(<Harness slots={SLOTS} initial={[accept]} onDrafts={(d) => seen.push(d)} />);

      fireEvent.keyDown(screen.getByRole('button', { name: /buttonAdd/ }), { key: 'Enter' });
      expect(screen.getByRole('menuitem', { name: /track/ })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('menuitem', { name: /opt_out/ }));

      expect(seen.at(-1)?.[1].button).toEqual({ kind: 'QUICK_REPLY', label: 'Parar', slot: 'opt_out' });
    });

    it('sem suporte nativo, o texto do botão do tipo continua editável (só os livres travam)', () => {
      render(
        <Harness
          nativeSupported={false}
          slots={SLOTS}
          initial={[accept, { kind: 'URL', label: 'Site', url: 'https://meu.site' }]}
        />,
      );
      expect(screen.getByDisplayValue('Aceitar')).toBeEnabled();
      expect(screen.getByDisplayValue('Site')).toBeDisabled();
    });
  });
});
