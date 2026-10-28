import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationBell } from './notification-bell';

const mocks = vi.hoisted(() => ({
  role: 'USER' as string,
  unreadCount: 0 as number | undefined,
  notifications: [] as { id: string }[],
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('@/lib/actions/auth/queries', () => ({
  useMe: () => ({ data: { role: mocks.role } }),
}));
vi.mock('@/lib/actions/notification/queries', () => ({
  useUnreadCount: () => ({ data: mocks.unreadCount }),
  useMyNotifications: () => ({ data: { data: mocks.notifications } }),
  useMarkNotificationRead: () => ({ mutate: mocks.markRead }),
  useMarkAllNotificationsRead: () => ({ mutate: mocks.markAllRead }),
  useDismissNotification: () => ({ mutate: mocks.dismiss }),
}));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
// A lógica deste componente é o gate de admin, não o formulário do modal — stub só sinaliza `open`.
vi.mock('@/components/notification/send-notification-modal', () => ({
  SendNotificationModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="broadcast-modal" /> : null,
}));
vi.mock('@/components/notification/renderer-registry', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  NotificationItem: ({ notification, onMarkRead, onDismiss }: any) => (
    <div>
      <span>notif-{notification.id}</span>
      <button onClick={onMarkRead}>mark-{notification.id}</button>
      <button onClick={onDismiss}>dismiss-{notification.id}</button>
    </div>
  ),
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.role = 'USER';
    mocks.unreadCount = 0;
    mocks.notifications = [];
  });

  it('usuário não-admin não vê a ação de enviar notificação', () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'bell_label' }));
    expect(screen.queryByText('send_broadcast_action')).not.toBeInTheDocument();
  });

  it('admin vê a ação e consegue abrir o composer', () => {
    mocks.role = 'ADMIN';
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'bell_label' }));

    expect(screen.queryByTestId('broadcast-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('send_broadcast_action'));
    expect(screen.getByTestId('broadcast-modal')).toBeInTheDocument();
  });

  it('mostra a contagem de não lidas no sininho, e "99+" acima de 99', () => {
    mocks.unreadCount = 5;
    const { rerender } = render(<NotificationBell />);
    expect(screen.getByText('5')).toBeInTheDocument();

    mocks.unreadCount = 150;
    rerender(<NotificationBell />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('sem notificações não lidas, não mostra o badge', () => {
    mocks.unreadCount = 0;
    render(<NotificationBell />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('com não lidas, mostra "marcar todas como lidas" e dispara a mutação ao clicar', () => {
    mocks.unreadCount = 3;
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: /bell_label/ }));

    fireEvent.click(screen.getByText('mark_all_read'));
    expect(mocks.markAllRead).toHaveBeenCalled();
  });

  it('sem notificações não lidas e usuário comum, não mostra nenhuma ação no cabeçalho', () => {
    mocks.unreadCount = 0;
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'bell_label' }));

    expect(screen.queryByText('mark_all_read')).not.toBeInTheDocument();
    expect(screen.queryByText('send_broadcast_action')).not.toBeInTheDocument();
  });

  it('lista vazia mostra a mensagem de vazio', () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'bell_label' }));
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('renderiza cada notificação e encaminha marcar como lida / descartar', () => {
    mocks.notifications = [{ id: 'n1' }, { id: 'n2' }];
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'bell_label' }));

    expect(screen.getByText('notif-n1')).toBeInTheDocument();
    expect(screen.getByText('notif-n2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('mark-n1'));
    expect(mocks.markRead).toHaveBeenCalledWith('n1');

    fireEvent.click(screen.getByText('dismiss-n2'));
    expect(mocks.dismiss).toHaveBeenCalledWith('n2');
  });
});
