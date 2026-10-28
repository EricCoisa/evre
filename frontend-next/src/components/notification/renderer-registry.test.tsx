import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationItem } from './renderer-registry';
import type { Notification } from '@/lib/actions/notification/types';

const mocks = vi.hoisted(() => ({ locale: 'en-US' as string | undefined }));

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: mocks.locale }),
}));

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    type: 'unknown-type',
    title: 'Título',
    message: 'Mensagem',
    payload: null,
    readAt: null,
    dismissedAt: null,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  } as Notification;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = 'en-US';
});

describe('NotificationItem', () => {
  it('tipo sem renderer customizado cai no renderer padrão', () => {
    render(<NotificationItem notification={makeNotification()} onMarkRead={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByText('Título')).toBeInTheDocument();
    expect(screen.getByText('Mensagem')).toBeInTheDocument();
  });

  it('não renderiza título nem mensagem quando ambos são null', () => {
    render(
      <NotificationItem
        notification={makeNotification({ title: null, message: null })}
        onMarkRead={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.queryByText('Título')).not.toBeInTheDocument();
    expect(screen.queryByText('Mensagem')).not.toBeInTheDocument();
  });

  it('não lida: tem role="button" e clicar no container chama onMarkRead', () => {
    const onMarkRead = vi.fn();
    const { container } = render(
      <NotificationItem notification={makeNotification({ readAt: null })} onMarkRead={onMarkRead} onDismiss={vi.fn()} />,
    );

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute('role', 'button');
    fireEvent.click(root);
    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  it('lida: sem role="button" e clicar no container não chama onMarkRead', () => {
    const onMarkRead = vi.fn();
    const { container } = render(
      <NotificationItem
        notification={makeNotification({ readAt: new Date().toISOString() })}
        onMarkRead={onMarkRead}
        onDismiss={vi.fn()}
      />,
    );

    const root = container.firstChild as HTMLElement;
    expect(root).not.toHaveAttribute('role');
    fireEvent.click(root);
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it('botão de dispensar chama onDismiss e não propaga para onMarkRead', () => {
    const onMarkRead = vi.fn();
    const onDismiss = vi.fn();
    const { container } = render(
      <NotificationItem notification={makeNotification({ readAt: null })} onMarkRead={onMarkRead} onDismiss={onDismiss} />,
    );

    fireEvent.click(container.querySelector('button') as HTMLButtonElement);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it('locale pt-* usa o locale de data-fns ptBR (texto "há")', () => {
    mocks.locale = 'pt-BR';
    render(<NotificationItem notification={makeNotification()} onMarkRead={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByText(/há/)).toBeInTheDocument();
  });

  it('locale não-pt usa o locale de data-fns enUS (texto "ago")', () => {
    mocks.locale = 'en-US';
    render(<NotificationItem notification={makeNotification()} onMarkRead={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });
});
