import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConversationList from './conversation-list';
import { useAiConversationList, useDeleteConversation } from '@/lib/actions/ai/queries';

vi.mock('@/lib/actions/ai/queries', () => ({
  useAiConversationList: vi.fn(),
  useDeleteConversation: vi.fn(),
}));

// `t` devolve a própria chave, e anexa o count quando ele existe — assim dá
// para afirmar que o diálogo recebeu a quantidade certa sem depender do texto.
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.count === undefined ? key : `${key}:${String(params.count)}`,
  }),
}));

const mutateAsync = vi.fn().mockResolvedValue(undefined);

function setup() {
  vi.mocked(useAiConversationList).mockReturnValue({
    data: {
      data: [
        { id: 'c1', title: 'primeira' },
        { id: 'c2', title: 'segunda' },
        { id: 'c3', title: 'terceira' },
      ],
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useAiConversationList>);

  vi.mocked(useDeleteConversation).mockReturnValue({
    mutateAsync,
  } as unknown as ReturnType<typeof useDeleteConversation>);

  const onDeleteConversation = vi.fn();
  render(
    <ConversationList
      selectedId="c1"
      onSelectConversation={vi.fn()}
      onDeleteConversation={onDeleteConversation}
    />,
  );
  return { onDeleteConversation };
}

describe('ConversationList — seleção múltipla', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('turns on selection mode and shows how many are selected', async () => {
    const user = userEvent.setup();
    setup();

    // O botão em lote não existe enquanto nada está marcado.
    expect(screen.queryByLabelText('deleteSelected')).toBeNull();

    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.getByLabelText('deleteSelected')).toHaveTextContent('1');

    await user.click(screen.getAllByRole('checkbox')[2]);
    expect(screen.getByLabelText('deleteSelected')).toHaveTextContent('2');
  });

  it('asks for confirmation with the number of conversations and deletes each one', async () => {
    const user = userEvent.setup();
    const { onDeleteConversation } = setup();

    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(screen.getByLabelText('deleteSelected'));

    // Diálogo plural, com a contagem — não o texto de "esta conversa".
    expect(await screen.findByText('confirmDeleteMany:2')).toBeInTheDocument();

    await user.click(screen.getByText('confirm'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync).toHaveBeenCalledWith('c1');
    expect(mutateAsync).toHaveBeenCalledWith('c2');
    // A tela precisa saber, para fechar a conversa aberta se ela foi apagada.
    expect(onDeleteConversation).toHaveBeenCalledWith('c1');
  });

  it('keeps the single-conversation wording when deleting just one', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(screen.getByLabelText('deleteSelected'));

    expect(await screen.findByText('confirmDelete')).toBeInTheDocument();
    expect(screen.queryByText(/confirmDeleteMany/)).toBeNull();
  });

  // `ConfirmDialog.onConfirm` é `() => void`, chamado de um onClick que não
  // espera a Promise — sem o catch, uma falha aqui virava unhandled rejection
  // no console. `Alive` (dentro de useDeleteConversation, não mockado neste
  // teste) já cuida do toast; o que este teste garante é só que o handler não
  // deixa a rejeição escapar sem tratamento e que o diálogo ainda fecha.
  it('closes the dialog instead of leaving the rejection unhandled when a deletion fails', async () => {
    const user = userEvent.setup();
    mutateAsync.mockRejectedValueOnce(new Error('falhou'));
    const { onDeleteConversation } = setup();

    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByLabelText('deleteSelected'));
    await user.click(screen.getByText('confirm'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('confirmDelete')).toBeNull());
    expect(onDeleteConversation).not.toHaveBeenCalled();
  });
});
