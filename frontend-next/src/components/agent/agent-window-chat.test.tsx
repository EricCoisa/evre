import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentWindowChat } from './agent-window-chat';
import { useAgentChat } from './agent-chat-provider';
import { usePathname } from 'next/navigation';
import { useHasMounted } from '@/hooks/use-has-mounted';

vi.mock('./agent-chat-provider', () => ({ useAgentChat: vi.fn() }));
vi.mock('@/hooks/use-has-mounted', () => ({ useHasMounted: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('./chat-view', () => ({ default: () => <div data-testid="chat-view" /> }));
vi.mock('@/components/window', () => ({
  Window: ({ title, children, setClosed }: { title: React.ReactNode; children: React.ReactNode; setClosed?: () => void }) => (
    <div data-testid="window">
      <span>{title}</span>
      <button onClick={() => setClosed?.()}>close-window</button>
      {children}
    </div>
  ),
}));

function setup({ mode = 'route' as 'route' | 'window', mounted = true, pathname = '/' } = {}) {
  const setMode = vi.fn();
  vi.mocked(useAgentChat).mockReturnValue({ mode, setMode } as unknown as ReturnType<typeof useAgentChat>);
  vi.mocked(useHasMounted).mockReturnValue(mounted);
  vi.mocked(usePathname).mockReturnValue(pathname);

  const utils = render(<AgentWindowChat />);
  return { ...utils, setMode };
}

describe('AgentWindowChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing before mount (SSR/hydration guard)', () => {
    setup({ mounted: false });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the floating bubble button when not in window mode', () => {
    setup({ mode: 'route' });
    expect(screen.getByLabelText('chatWithAI')).toBeInTheDocument();
    expect(screen.queryByTestId('window')).not.toBeInTheDocument();
  });

  it('hides the bubble on the /agent route itself', () => {
    setup({ mode: 'route', pathname: '/agent' });
    expect(screen.queryByLabelText('chatWithAI')).not.toBeInTheDocument();
  });

  it('switches to window mode when the bubble is clicked', async () => {
    const user = userEvent.setup();
    const { setMode } = setup({ mode: 'route' });

    await user.click(screen.getByLabelText('chatWithAI'));

    expect(setMode).toHaveBeenCalledWith('window');
  });

  it('renders the floating window with ChatView when in window mode', () => {
    setup({ mode: 'window' });

    expect(screen.getByTestId('window')).toBeInTheDocument();
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
    expect(screen.getByText('agentTitle')).toBeInTheDocument();
  });

  it('switches back to route mode when the window is closed', async () => {
    const user = userEvent.setup();
    const { setMode } = setup({ mode: 'window' });

    await user.click(screen.getByText('close-window'));

    expect(setMode).toHaveBeenCalledWith('route');
  });
});
