import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentChatProvider, { useAgentChat } from './agent-chat-provider';
import { useAiStream } from '@/lib/actions/ai/use-ai-stream';

vi.mock('@/lib/actions/ai/use-ai-stream', () => ({ useAiStream: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(useAiStream).mockReturnValue({} as unknown as ReturnType<typeof useAiStream>);
});

function Consumer() {
  const ctx = useAgentChat();
  return (
    <div>
      <span data-testid="mode">{ctx.mode}</span>
      <span data-testid="conv">{ctx.conversationId}</span>
      <span data-testid="model">{ctx.model}</span>
      <button onClick={() => ctx.setMode('window')}>set-window</button>
      <button onClick={() => ctx.toggleMode()}>toggle</button>
      <button onClick={() => ctx.setConversationId('c1')}>set-conv</button>
      <button onClick={() => ctx.setModel('gpt-4')}>set-model</button>
    </div>
  );
}

describe('AgentChatProvider', () => {
  it('throws when useAgentChat is used outside the provider', () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow('useAgentChat must be used within an AgentChatProvider');
    consoleErr.mockRestore();
  });

  it('starts in route mode with empty conversation and model', () => {
    render(<AgentChatProvider><Consumer /></AgentChatProvider>);

    expect(screen.getByTestId('mode')).toHaveTextContent('route');
    expect(screen.getByTestId('conv')).toHaveTextContent('');
    expect(screen.getByTestId('model')).toHaveTextContent('');
  });

  it('restores a saved mode from localStorage on mount', () => {
    localStorage.setItem('agent-mode', 'window');

    render(<AgentChatProvider><Consumer /></AgentChatProvider>);

    expect(screen.getByTestId('mode')).toHaveTextContent('window');
  });

  it('ignores an invalid saved mode and keeps the default', () => {
    localStorage.setItem('agent-mode', 'bogus');

    render(<AgentChatProvider><Consumer /></AgentChatProvider>);

    expect(screen.getByTestId('mode')).toHaveTextContent('route');
  });

  it('setMode updates state and persists to localStorage', async () => {
    const user = userEvent.setup();
    render(<AgentChatProvider><Consumer /></AgentChatProvider>);

    await user.click(screen.getByText('set-window'));

    expect(screen.getByTestId('mode')).toHaveTextContent('window');
    expect(localStorage.getItem('agent-mode')).toBe('window');
  });

  it('toggleMode flips between route and window', async () => {
    const user = userEvent.setup();
    render(<AgentChatProvider><Consumer /></AgentChatProvider>);

    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode')).toHaveTextContent('window');

    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode')).toHaveTextContent('route');
  });

  it('updates conversationId and model independently', async () => {
    const user = userEvent.setup();
    render(<AgentChatProvider><Consumer /></AgentChatProvider>);

    await user.click(screen.getByText('set-conv'));
    await user.click(screen.getByText('set-model'));

    expect(screen.getByTestId('conv')).toHaveTextContent('c1');
    expect(screen.getByTestId('model')).toHaveTextContent('gpt-4');
  });

  it('passes conversationId and model through to useAiStream', async () => {
    const user = userEvent.setup();
    render(<AgentChatProvider><Consumer /></AgentChatProvider>);

    await user.click(screen.getByText('set-conv'));
    await user.click(screen.getByText('set-model'));

    expect(useAiStream).toHaveBeenLastCalledWith('c1', 'gpt-4');
  });
});
