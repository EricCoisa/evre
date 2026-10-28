import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TemplateSubmitDialog } from './template-submit-dialog';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  error: undefined as Error | undefined,
  issues: [] as unknown[],
}));

vi.mock('@/lib/actions/messaging/queries', () => ({
  useMessagingConnections: () => ({ data: [{ id: 'conn-1', provider: 'META', phone: '5511' }] }),
  useNativeButtonsSupport: () => ({ approval: true, supported: true, approvalConnectionIds: ['conn-1'], isLoading: false }),
  useTemplateVariables: () => ({ data: [{ name: 'first_name', dummy: 'Ana' }] }),
  useMetaTemplateCheck: () => ({ issues: mocks.issues, isChecking: false }),
  useSubmitTemplate: () => ({ mutateAsync: mocks.mutateAsync, isPending: false, error: mocks.error }),
}));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'pt-BR' }),
}));

const TYPE = {
  id: 'type-1',
  variables: [
    { name: 'order_id', type: 'STRING', required: true },
    { name: 'unused', type: 'STRING', required: true },
  ],
};
const TEMPLATE = {
  id: 'tpl-1',
  key: 'pedido',
  language: 'pt-BR',
  category: 'UTILITY',
  typeId: 'type-1',
  body: 'Olá {{ first_name }}, pedido {{ order_id }}',
};

function setup() {
  const onOpenChange = vi.fn();
  render(
    <TemplateSubmitDialog template={TEMPLATE as never} types={[TYPE] as never} onOpenChange={onOpenChange} />,
  );
  return { onOpenChange };
}

describe('TemplateSubmitDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.error = undefined;
    mocks.issues = [];
    mocks.mutateAsync.mockResolvedValue({});
  });

  it('pede exemplo só das variáveis do tipo que o texto usa (reservada e não usada ficam de fora)', () => {
    setup();
    expect(screen.getByLabelText(/order_id/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/unused/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/first_name/)).not.toBeInTheDocument();
  });

  it('só habilita submeter com todos os exemplos preenchidos, e envia só os exemplos', async () => {
    const { onOpenChange } = setup();
    const submit = screen.getByRole('button', { name: 'submitToMeta' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/order_id/), { target: { value: ' 42 ' } });
    expect(submit).toBeEnabled();
    // A prévia usa o exemplo digitado e o dummy da reservada.
    expect(screen.getByText('Olá Ana, pedido 42')).toBeInTheDocument();

    fireEvent.click(submit);
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        id: 'tpl-1',
        payload: { connectionId: 'conn-1', examples: { order_id: '42' } },
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('mostra na própria janela o erro devolvido pelo servidor', () => {
    mocks.error = new Error('Recusado pelo provider: Invalid parameter');
    setup();
    expect(screen.getByRole('alert')).toHaveTextContent('Recusado pelo provider: Invalid parameter');
  });

  describe('regras da Meta', () => {
    const ERROR = {
      code: 'BODY_ENDS_WITH_VARIABLE',
      severity: 'error',
      field: 'body',
      message: 'O corpo não pode terminar com uma variável.',
    };

    it('erro das regras bloqueia o envio à Meta, mesmo com tudo preenchido, e mostra o motivo', () => {
      mocks.issues = [ERROR];
      setup();
      fireEvent.change(screen.getByLabelText(/order_id/), { target: { value: '42' } });

      expect(screen.getByText('metaRulesErrorsTitle')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'submitToMeta' })).toBeDisabled();
    });

    it('aviso não bloqueia', () => {
      mocks.issues = [{ ...ERROR, code: 'UTILITY_WITHOUT_VARIABLES', severity: 'warning' }];
      setup();
      fireEvent.change(screen.getByLabelText(/order_id/), { target: { value: '42' } });

      expect(screen.getByText('metaRulesWarningsTitle')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'submitToMeta' })).toBeEnabled();
    });
  });
});
