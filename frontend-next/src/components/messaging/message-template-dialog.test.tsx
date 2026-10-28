import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MessageTemplateDialog } from './message-template-dialog';

const mocks = vi.hoisted(() => ({
  templates: [] as unknown[],
  types: [] as unknown[],
  reserved: [] as unknown[],
}));

vi.mock('@/lib/actions/messaging/queries', () => ({
  useTemplatesForConnection: () => ({ data: mocks.templates }),
  useTemplateTypes: () => ({ data: mocks.types }),
  useTemplateVariables: () => ({ data: mocks.reserved }),
}));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'pt-BR' }),
}));

const TYPE = {
  id: 'type-1',
  variables: [
    { name: 'first_name', type: 'STRING', required: true },
    { name: 'discount', type: 'STRING', required: false, default: '10%' },
  ],
};
const APPROVED = { id: 'tpl-approved', key: 'pedido', language: 'pt-BR', typeId: 'type-1', approvalStatus: 'APPROVED' };
const PENDING = { id: 'tpl-pending', key: 'promo', language: 'pt-BR', typeId: 'type-1', approvalStatus: 'PENDING' };

function setup(props: Partial<React.ComponentProps<typeof MessageTemplateDialog>> = {}) {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <MessageTemplateDialog
      open
      onOpenChange={onOpenChange}
      connectionId="conn-1"
      template={{ approval: false, providerOwnedBody: [], components: { header: [], footer: false, buttons: [] } }}
      pending={false}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, onOpenChange };
}

describe('MessageTemplateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.templates = [APPROVED, PENDING];
    mocks.types = [TYPE];
    mocks.reserved = [];
  });

  it('sem aprovação exigida (Evolution), lista todo o catálogo', () => {
    setup({ template: { approval: false, providerOwnedBody: [], components: { header: [], footer: false, buttons: [] } } });
    fireEvent.click(screen.getByRole('combobox', { name: 'pickTemplate' }));
    expect(screen.getByRole('option', { name: 'pedido (pt-BR)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'promo (pt-BR)' })).toBeInTheDocument();
  });

  it('com aprovação exigida (Meta), só lista o que está APPROVED', () => {
    setup({ template: { approval: true, providerOwnedBody: [], components: { header: [], footer: false, buttons: [] } } });
    fireEvent.click(screen.getByRole('combobox', { name: 'pickTemplate' }));
    expect(screen.getByRole('option', { name: 'pedido (pt-BR)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'promo (pt-BR)' })).not.toBeInTheDocument();
  });

  it('sem nenhum template disponível, avisa em vez do seletor', () => {
    mocks.templates = [];
    setup({ template: { approval: true, providerOwnedBody: [], components: { header: [], footer: false, buttons: [] } } });
    expect(screen.getByText('noTemplatesAvailable')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('variável obrigatória vazia desabilita o envio; variável opcional não', () => {
    setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'pickTemplate' }));
    fireEvent.click(screen.getByRole('option', { name: 'pedido (pt-BR)' }));

    expect(screen.getByRole('button', { name: 'send' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('first_name'), { target: { value: 'Ana' } });
    expect(screen.getByRole('button', { name: 'send' })).toBeEnabled();
  });

  it('envia só o templateId e os valores digitados', () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'pickTemplate' }));
    fireEvent.click(screen.getByRole('option', { name: 'pedido (pt-BR)' }));
    fireEvent.change(screen.getByLabelText('first_name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    expect(onSubmit).toHaveBeenCalledWith({ templateId: 'tpl-approved', values: { first_name: 'Ana' } });
  });

  it('variável reservada derivada não aparece no form, mesmo declarada no tipo — e não bloqueia o envio', () => {
    mocks.reserved = [
      { name: 'first_name', type: 'STRING', labelKey: 'variable.first_name', callerProvided: false },
    ];
    setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'pickTemplate' }));
    fireEvent.click(screen.getByRole('option', { name: 'pedido (pt-BR)' }));

    expect(screen.queryByLabelText('first_name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'send' })).toBeEnabled();
  });

  it('template usando variável fornecida pelo chamador é bloqueado no chat', () => {
    mocks.reserved = [
      { name: 'payment_code', type: 'STRING', labelKey: 'variable.payment_code', callerProvided: true },
    ];
    mocks.templates = [
      { ...APPROVED, body: 'Código: {{ payment_code }}' },
    ];
    setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'pickTemplate' }));
    fireEvent.click(screen.getByRole('option', { name: 'pedido (pt-BR)' }));

    expect(screen.getByText('templateBlockedCallerProvided')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'send' })).toBeDisabled();
  });

  it('template com link do sistema (espaço URL do tipo) é bloqueado no chat: o sufixo é do código', () => {
    mocks.reserved = [];
    mocks.templates = [
      {
        ...APPROVED,
        buttons: [{ kind: 'URL', label: 'Ver', url: 'https://app.test/o/{{ track }}', slot: 'track' }],
      },
    ];
    setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'pickTemplate' }));
    fireEvent.click(screen.getByRole('option', { name: 'pedido (pt-BR)' }));

    expect(screen.getByText('templateBlockedSystemLink')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'send' })).toBeDisabled();
  });

  it('botão livre com URL (link do usuário) não bloqueia', () => {
    mocks.reserved = [];
    mocks.templates = [
      { ...APPROVED, buttons: [{ kind: 'URL', label: 'Site', url: 'https://meu.site' }] },
    ];
    setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'pickTemplate' }));
    fireEvent.click(screen.getByRole('option', { name: 'pedido (pt-BR)' }));

    expect(screen.queryByText('templateBlockedSystemLink')).not.toBeInTheDocument();
  });

  it('template que requer ajuste (tipo mudou) nem aparece na lista de envio', () => {
    mocks.reserved = [];
    mocks.templates = [APPROVED, { ...PENDING, approvalStatus: 'APPROVED', invalidReason: 'tipo mudou' }];
    setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'pickTemplate' }));
    expect(screen.getByRole('option', { name: 'pedido (pt-BR)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'promo (pt-BR)' })).not.toBeInTheDocument();
  });
});
