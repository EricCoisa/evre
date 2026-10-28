import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SendNotificationModal } from './send-notification-modal';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

const mocks = vi.hoisted(() => ({
  roles: [] as Array<{ value: string; label: string }>,
  mutateAsync: vi.fn(),
}));

vi.mock('@/lib/actions/user/queries', () => ({
  useRoles: () => ({ data: mocks.roles }),
}));
vi.mock('@/lib/actions/notification/queries', () => ({
  useSendBroadcastNotification: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('sonner', () => ({ toast }));

function setup() {
  const onOpenChange = vi.fn();
  render(<SendNotificationModal open onOpenChange={onOpenChange} />);
  return { onOpenChange };
}

describe('SendNotificationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roles = [
      { value: 'role-admin', label: 'ADMIN' },
      { value: 'role-user', label: 'USER' },
    ];
    mocks.mutateAsync.mockResolvedValue(undefined);
  });

  it('envia all=true e roleNames vazio quando audiência é "todos" (default)', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('field_title'), { target: { value: 'Aviso' } });
    fireEvent.change(screen.getByLabelText('field_message'), { target: { value: 'Mensagem' } });

    fireEvent.click(screen.getByText('submit'));

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      title: 'Aviso',
      message: 'Mensagem',
      actionUrl: undefined,
      all: true,
      roleNames: [],
    });
  });

  it('não envia sem título/mensagem — mostra validação em vez de chamar a mutation', () => {
    setup();
    fireEvent.click(screen.getByText('submit'));

    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getAllByText('validation_required').length).toBeGreaterThan(0);
  });

  it('audiência "roles": exige ao menos uma role marcada antes de enviar', () => {
    setup();
    fireEvent.change(screen.getByLabelText('field_title'), { target: { value: 'Aviso' } });
    fireEvent.change(screen.getByLabelText('field_message'), { target: { value: 'Mensagem' } });
    fireEvent.click(screen.getByLabelText('audience_roles'));

    fireEvent.click(screen.getByText('submit'));
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('audience_roles_required')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('ADMIN'));
    fireEvent.click(screen.getByText('submit'));

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      title: 'Aviso',
      message: 'Mensagem',
      actionUrl: undefined,
      all: false,
      roleNames: ['ADMIN'],
    });
  });

  it('desmarcar uma role já selecionada a remove da lista', () => {
    setup();
    fireEvent.click(screen.getByLabelText('audience_roles'));
    fireEvent.click(screen.getByLabelText('ADMIN'));
    fireEvent.click(screen.getByLabelText('USER'));
    fireEvent.click(screen.getByLabelText('ADMIN')); // desmarca

    fireEvent.change(screen.getByLabelText('field_title'), { target: { value: 'Aviso' } });
    fireEvent.change(screen.getByLabelText('field_message'), { target: { value: 'Mensagem' } });
    fireEvent.click(screen.getByText('submit'));

    expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ roleNames: ['USER'] }));
  });

  it('sem roles cadastradas, mostra o aviso de "nenhuma role"', () => {
    mocks.roles = [];
    setup();
    fireEvent.click(screen.getByLabelText('audience_roles'));

    expect(screen.getByText('no_roles')).toBeInTheDocument();
  });

  it('envia a actionUrl aparada quando preenchida', () => {
    setup();
    fireEvent.change(screen.getByLabelText('field_title'), { target: { value: 'Aviso' } });
    fireEvent.change(screen.getByLabelText('field_message'), { target: { value: 'Mensagem' } });
    fireEvent.change(screen.getByLabelText('field_action_url'), { target: { value: '  /destino  ' } });
    fireEvent.click(screen.getByText('submit'));

    expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ actionUrl: '/destino' }));
  });

  it('sucesso: mostra toast, reseta o formulário e fecha o modal', async () => {
    const { onOpenChange } = setup();
    fireEvent.change(screen.getByLabelText('field_title'), { target: { value: 'Aviso' } });
    fireEvent.change(screen.getByLabelText('field_message'), { target: { value: 'Mensagem' } });
    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('successMessage'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('erro na mutation: mantém o modal aberto sem propagar a exceção', async () => {
    mocks.mutateAsync.mockRejectedValue(new Error('falhou'));
    const { onOpenChange } = setup();
    fireEvent.change(screen.getByLabelText('field_title'), { target: { value: 'Aviso' } });
    fireEvent.change(screen.getByLabelText('field_message'), { target: { value: 'Mensagem' } });
    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('cancelar reseta o formulário e avisa o pai para fechar', () => {
    const { onOpenChange } = setup();
    fireEvent.change(screen.getByLabelText('field_title'), { target: { value: 'Rascunho' } });

    fireEvent.click(screen.getByText('cancel'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
