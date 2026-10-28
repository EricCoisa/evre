import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TemplateTypeTab } from './template-type-tab';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  types: [] as unknown[],
}));

vi.mock('@/lib/actions/messaging/queries', () => ({
  useTemplateTypes: () => ({
    data: { data: mocks.types, meta: { total: mocks.types.length, page: 1, limit: 20, totalPages: 1 } },
    error: null,
    isLoading: false,
  }),
  useCreateTemplateType: () => ({ mutateAsync: mocks.create }),
  useUpdateTemplateType: () => ({ mutateAsync: mocks.update }),
  useRemoveTemplateType: () => ({ mutateAsync: mocks.remove }),
  useTemplateVariables: () => ({ data: [{ name: 'first_name', type: 'STRING', labelKey: 'variable.first_name', allowUse: true }] }),
  useTemplateButtons: () => ({ data: { reserved: [], handlers: [] } }),
}));
vi.mock('@/contexts/filter-sidebar-context', () => ({ useFilterSidebar: () => ({ open: vi.fn() }) }));
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => ({ getQueryState: () => undefined, refetchQueries: vi.fn() }),
}));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { count?: number }) => (opts?.count !== undefined ? `${key}:${opts.count}` : key), locale: 'pt-BR' }),
}));

const type = (over: Record<string, unknown>) => ({
  id: 't',
  key: 'ORDER',
  name: 'Pedido',
  variables: [{ name: 'order', type: 'STRING', required: true }],
  buttons: [],
  templatesCount: 0,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...over,
});

describe('TemplateTypeTab — tipo em uso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // O Radix (dialog/select) mede o conteúdo; o jsdom não tem ResizeObserver.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    mocks.update.mockResolvedValue({});
    mocks.types = [
      type({ id: 'free', key: 'FREE', templatesCount: 0 }),
      type({ id: 'used', key: 'USED', templatesCount: 3 }),
    ];
  });

  it('exclusão fica bloqueada (com o motivo no hover) para tipo que tem template', () => {
    render(<TemplateTypeTab />);
    const [freeDelete, usedDelete] = screen.getAllByRole('button', { name: 'deleteTemplateTypeTitle' });
    expect(freeDelete).toBeEnabled();
    expect(usedDelete).toBeDisabled();
    expect(usedDelete).toHaveAttribute('title', 'typeInUseCannotDelete:3');
  });

  const openUsedEdit = () => {
    const edits = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-pencil'));
    fireEvent.click(edits[1]);
  };
  const submit = () => fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|common/i }));

  it('mudar variável de tipo em uso pede confirmação; cancelar não grava e o formulário segue aberto', async () => {
    render(<TemplateTypeTab />);
    openUsedEdit();
    fireEvent.change(screen.getByDisplayValue('order'), { target: { value: 'order_id' } });
    submit();

    expect(await screen.findByText('typeChangeConfirmTitle')).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByText('typeChangeConfirmTitle')).not.toBeInTheDocument());
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('order_id')).toBeInTheDocument(); // formulário continua aberto
  });

  it('confirmar grava as variáveis alteradas', async () => {
    render(<TemplateTypeTab />);
    openUsedEdit();
    fireEvent.change(screen.getByDisplayValue('order'), { target: { value: 'order_id' } });
    submit();

    fireEvent.click(await screen.findByRole('button', { name: 'typeChangeConfirm' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      id: 'used',
      payload: { variables: [expect.objectContaining({ name: 'order_id' })] },
    });
  });

  it('mudar só o nome do tipo não pede confirmação', async () => {
    render(<TemplateTypeTab />);
    openUsedEdit();
    fireEvent.change(screen.getByDisplayValue('Pedido'), { target: { value: 'Pedido novo' } });
    submit();

    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(screen.queryByText('typeChangeConfirmTitle')).not.toBeInTheDocument();
  });
});
