import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessagingChatProvider } from './messaging-chat-provider';
import { serverCanAccessRoute, serverFeatureFlag } from '@/lib/server-context';

vi.mock('@/lib/server-context', () => ({
  serverFeatureFlag: vi.fn(),
  serverCanAccessRoute: vi.fn(),
}));
vi.mock('./chat-windows-provider', () => ({
  ChatWindowsProvider: ({ chatEnabled, children }: { chatEnabled: boolean; children: React.ReactNode }) => (
    <div data-testid="chat-windows-provider" data-enabled={String(chatEnabled)}>
      {children}
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MessagingChatProvider', () => {
  it('enables the chat when the flag is on and the route is reachable', async () => {
    vi.mocked(serverFeatureFlag).mockResolvedValue(true);
    vi.mocked(serverCanAccessRoute).mockResolvedValue(true);

    const node = await MessagingChatProvider({ children: <span>conteudo</span> });
    render(node);

    expect(serverFeatureFlag).toHaveBeenCalledWith('MESSAGING_CHAT');
    expect(serverCanAccessRoute).toHaveBeenCalledWith('/comunicacao');
    expect(screen.getByTestId('chat-windows-provider')).toHaveAttribute('data-enabled', 'true');
    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });

  it('disables the chat when the flag is off, even with route access', async () => {
    vi.mocked(serverFeatureFlag).mockResolvedValue(false);
    vi.mocked(serverCanAccessRoute).mockResolvedValue(true);

    const node = await MessagingChatProvider({ children: <span>conteudo</span> });
    render(node);

    expect(screen.getByTestId('chat-windows-provider')).toHaveAttribute('data-enabled', 'false');
  });

  it('disables the chat when the route is not reachable, even with the flag on', async () => {
    vi.mocked(serverFeatureFlag).mockResolvedValue(true);
    vi.mocked(serverCanAccessRoute).mockResolvedValue(false);

    const node = await MessagingChatProvider({ children: <span>conteudo</span> });
    render(node);

    expect(screen.getByTestId('chat-windows-provider')).toHaveAttribute('data-enabled', 'false');
  });

  it('still renders children even when the chat is disabled', async () => {
    vi.mocked(serverFeatureFlag).mockResolvedValue(false);
    vi.mocked(serverCanAccessRoute).mockResolvedValue(false);

    const node = await MessagingChatProvider({ children: <span>conteudo</span> });
    render(node);

    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });
});
