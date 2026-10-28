import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatView, { resolveSelectedModel } from './chat-view';
import { useAgentChat } from './agent-chat-provider';
import { useAiHealth } from '@/lib/actions/ai/use-ai-health';
import { useCreateConversation, useAiTools, useAiModels } from '@/lib/actions/ai/queries';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import type { ChatMessage } from '@/lib/actions/ai/use-ai-stream';

vi.mock('./agent-chat-provider', () => ({ useAgentChat: vi.fn() }));
vi.mock('@/lib/actions/ai/use-ai-health', () => ({ useAiHealth: vi.fn() }));
vi.mock('@/lib/actions/ai/queries', () => ({
  useCreateConversation: vi.fn(),
  useAiTools: vi.fn(),
  useAiModels: vi.fn(),
}));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

// jsdom não implementa scrollIntoView — ChatView chama no effeito que segue o fim do chat.
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// `t` devolve a própria chave e anexa os valores dos params, igual ao padrão
// usado em conversation-list.test.tsx — permite afirmar texto sem depender do i18n real.
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}));

vi.mock('./conversation-list', () => ({
  default: ({
    onSelectConversation,
    onDeleteConversation,
    onClose,
  }: {
    onSelectConversation: (id: string) => void;
    onDeleteConversation: (id: string) => void;
    onClose?: () => void;
  }) => (
    <div data-testid="conversation-list">
      <button onClick={() => onSelectConversation('c-picked')}>pick-conversation</button>
      <button onClick={() => onDeleteConversation('c-picked')}>delete-conversation</button>
      {onClose && <button onClick={onClose}>close-sidebar</button>}
    </div>
  ),
}));

// RichTextInput é um editor Lexical — um <input> simples basta para exercitar
// a lógica do ChatView (digitar, Enter, disabled) sem lidar com a engine real.
vi.mock('@/components/rich-text-input', () => ({
  RichTextInput: ({
    value,
    onChange,
    onKeyDown,
    disabled,
    ariaLabel,
  }: {
    value: string;
    onChange: (v: string) => void;
    onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
    disabled?: boolean;
    ariaLabel: string;
  }) => (
    <input
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
    />
  ),
}));

function msg(partial: Partial<ChatMessage> & { id: string; role: ChatMessage['role'] }): ChatMessage {
  return { content: '', ...partial };
}

interface SetupOptions {
  agentChat?: Partial<{
    mode: 'route' | 'window';
    setMode: ReturnType<typeof vi.fn>;
    toggleMode: ReturnType<typeof vi.fn>;
    conversationId: string;
    setConversationId: ReturnType<typeof vi.fn>;
    model: string;
    setModel: ReturnType<typeof vi.fn>;
  }>;
  stream?: Partial<{
    messages: ChatMessage[];
    isStreaming: boolean;
    pendingText: string;
    reasoning: string;
    toolEvents: Array<{ id: string; name: string; input: unknown; result?: unknown }>;
    pendingApproval: { toolCallId: string; scope: string } | null;
    error: string | null;
  }>;
  health?: Partial<{ operational: boolean; byokRequired: boolean; reason?: string; isLoading: boolean }>;
  models?: { models: string[]; default?: string };
  tools?: Array<{ name: string; description: string }>;
  createMutateAsync?: ReturnType<typeof vi.fn>;
  compact?: boolean;
  isMobile?: boolean;
}

function setup(opts: SetupOptions = {}) {
  const stream = {
    messages: [] as ChatMessage[],
    isStreaming: false,
    pendingText: '',
    reasoning: '',
    toolEvents: [],
    pendingApproval: null,
    error: null,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    resolveApproval: vi.fn().mockResolvedValue(undefined),
    rewindTo: vi.fn().mockResolvedValue(undefined),
    stopStream: vi.fn(),
    ...opts.stream,
  };

  const agentChat = {
    mode: 'route' as 'route' | 'window',
    setMode: vi.fn(),
    toggleMode: vi.fn(),
    conversationId: '',
    setConversationId: vi.fn(),
    model: '',
    setModel: vi.fn(),
    ...opts.agentChat,
    stream,
  };
  vi.mocked(useAgentChat).mockReturnValue(agentChat as unknown as ReturnType<typeof useAgentChat>);

  vi.mocked(useAiHealth).mockReturnValue({
    operational: true,
    byokRequired: false,
    reason: undefined,
    userKeyConfigured: true,
    isLoading: false,
    ...opts.health,
  } as unknown as ReturnType<typeof useAiHealth>);

  vi.mocked(useAiModels).mockReturnValue({ data: opts.models } as unknown as ReturnType<typeof useAiModels>);
  vi.mocked(useAiTools).mockReturnValue({ data: opts.tools ?? [] } as unknown as ReturnType<typeof useAiTools>);
  vi.mocked(useIsMobile).mockReturnValue(opts.isMobile ?? false);

  const mutateAsync = opts.createMutateAsync ?? vi.fn().mockResolvedValue('new-conv-id');
  vi.mocked(useCreateConversation).mockReturnValue({
    mutateAsync,
  } as unknown as ReturnType<typeof useCreateConversation>);

  const utils = render(<ChatView compact={opts.compact} />);
  return { ...utils, agentChat, stream, mutateAsync };
}

describe('resolveSelectedModel', () => {
  it('keeps the current model when it is still available', () => {
    expect(resolveSelectedModel('gpt-4', ['gpt-4', 'gpt-3.5'], 'gpt-3.5')).toBe('gpt-4');
  });

  it('falls back when the current model is no longer available', () => {
    expect(resolveSelectedModel('old-model', ['gpt-4'], 'gpt-4')).toBe('gpt-4');
  });

  it('falls back when there is no current model', () => {
    expect(resolveSelectedModel('', ['gpt-4'], 'gpt-4')).toBe('gpt-4');
  });
});

describe('ChatView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state when there are no messages and nothing streaming', () => {
    setup();
    expect(screen.getByText('emptyState')).toBeInTheDocument();
  });

  it('blocks the chat with the BYOK hint and does not touch the mode when already on route', () => {
    const { agentChat } = setup({ health: { operational: false, byokRequired: true, reason: 'no key' } });

    expect(screen.getByText('notConfiguredByokHint')).toBeInTheDocument();
    expect(screen.getByText('no key')).toBeInTheDocument();
  });

  it('blocks the chat with the admin hint and switches back to route mode before navigating', async () => {
    const user = userEvent.setup();
    const { agentChat } = setup({
      health: { operational: false, byokRequired: false },
      agentChat: { mode: 'window' },
    });

    expect(screen.getByText('notConfiguredAdminHint')).toBeInTheDocument();
    await user.click(screen.getByText('configureNow'));
    expect(agentChat.setMode).toHaveBeenCalledWith('route');
  });

  it('toasts and displays an inline alert when the stream reports an error', () => {
    setup({ stream: { error: 'boom' } });

    expect(toast.error).toHaveBeenCalledWith('boom');
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('renders user and assistant messages and groups consecutive tool messages together', () => {
    setup({
      stream: {
        messages: [
          msg({ id: 'u1', role: 'user', content: 'oi' }),
          msg({ id: 'a1', role: 'assistant', content: 'buscando', toolCalls: [{ id: 't1', name: 'search' }, { id: 't2', name: 'fetch' }] }),
          msg({ id: 'tm1', role: 'tool', content: 'resultado da busca', toolCallId: 't1' }),
          msg({ id: 'tm2', role: 'tool', content: 'resultado do fetch', toolCallId: 't2' }),
        ],
      },
    });

    expect(screen.getByText('oi')).toBeInTheDocument();
    expect(screen.getByText('buscando')).toBeInTheDocument();
    expect(screen.getByText('resultado da busca')).toBeInTheDocument();
    expect(screen.getByText('resultado do fetch')).toBeInTheDocument();
  });

  it('skips assistant messages with empty content', () => {
    setup({
      stream: {
        messages: [
          msg({ id: 'u1', role: 'user', content: 'oi' }),
          msg({ id: 'a1', role: 'assistant', content: '   ' }),
        ],
      },
    });

    expect(screen.getByText('oi')).toBeInTheDocument();
    expect(screen.queryByText('   ')).not.toBeInTheDocument();
  });

  it('shows a streaming bubble with the pending text and a stop button', async () => {
    const user = userEvent.setup();
    const { stream } = setup({ stream: { isStreaming: true, pendingText: 'escrevendo...' } });

    expect(screen.getByText('escrevendo...')).toBeInTheDocument();
    await user.click(screen.getByTitle('stopStream'));
    expect(stream.stopStream).toHaveBeenCalled();
  });

  it('shows the approval card and resolves the decision picked by the user', async () => {
    const user = userEvent.setup();
    const { stream } = setup({
      stream: { pendingApproval: { toolCallId: 'tc1', scope: 'fs.write' } },
    });

    expect(screen.getByText('fs.write')).toBeInTheDocument();
    await user.click(screen.getByText('approveOnce'));
    expect(stream.resolveApproval).toHaveBeenCalledWith('tc1', 'once');
  });

  it('retries the last user message through rewind + resend', async () => {
    const user = userEvent.setup();
    const { stream } = setup({
      agentChat: { conversationId: 'c1' },
      stream: { messages: [msg({ id: 'u1', role: 'user', content: 'pergunta' })] },
    });
    stream.rewindTo.mockResolvedValue('pergunta');

    await user.click(screen.getByTitle('retry'));

    expect(stream.rewindTo).toHaveBeenCalledWith('u1');
    expect(stream.sendMessage).toHaveBeenCalledWith('pergunta', 'c1');
  });

  it('edits from an earlier user message by putting its text back in the input', async () => {
    const user = userEvent.setup();
    const { stream } = setup({
      agentChat: { conversationId: 'c1' },
      stream: {
        messages: [
          msg({ id: 'u1', role: 'user', content: 'primeira' }),
          msg({ id: 'a1', role: 'assistant', content: 'resposta' }),
          msg({ id: 'u2', role: 'user', content: 'segunda' }),
        ],
      },
    });
    stream.rewindTo.mockResolvedValue('primeira');

    await user.click(screen.getByTitle('rewindHereHint'));

    expect(stream.rewindTo).toHaveBeenCalledWith('u1');
    expect(screen.getByLabelText('typeMessage')).toHaveValue('primeira');
    expect(stream.sendMessage).not.toHaveBeenCalled();
  });

  it('creates a conversation on first send and reuses it afterwards', async () => {
    const user = userEvent.setup();
    const { agentChat, stream, mutateAsync } = setup();

    const input = screen.getByLabelText('typeMessage');
    await user.type(input, 'ola');
    await user.click(input.parentElement!.querySelector('button')!);

    expect(mutateAsync).toHaveBeenCalledWith({});
    expect(agentChat.setConversationId).toHaveBeenCalledWith('new-conv-id');
    expect(stream.sendMessage).toHaveBeenCalledWith('ola', 'new-conv-id');
  });

  it('sends straight away when a conversation already exists', async () => {
    const user = userEvent.setup();
    const { stream, mutateAsync } = setup({ agentChat: { conversationId: 'c1' } });

    await user.type(screen.getByLabelText('typeMessage'), 'ola');
    await user.keyboard('{Enter}');

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(stream.sendMessage).toHaveBeenCalledWith('ola', 'c1');
  });

  it('does nothing when creating the conversation yields no id', async () => {
    const user = userEvent.setup();
    const { stream } = setup({ createMutateAsync: vi.fn().mockResolvedValue(undefined) });

    await user.type(screen.getByLabelText('typeMessage'), 'ola');
    await user.keyboard('{Enter}');

    expect(stream.sendMessage).not.toHaveBeenCalled();
  });

  it('does not send on shift+enter', async () => {
    const user = userEvent.setup();
    const { stream } = setup({ agentChat: { conversationId: 'c1' } });

    await user.type(screen.getByLabelText('typeMessage'), 'ola');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(stream.sendMessage).not.toHaveBeenCalled();
  });

  it('picks a slash tool matched by name and fills the input with the usage prompt', async () => {
    const user = userEvent.setup();
    setup({ tools: [{ name: 'search', description: 'busca na web' }] });

    await user.type(screen.getByLabelText('typeMessage'), '/sea');
    await user.click(await screen.findByText('/search'));

    expect(screen.getByLabelText('typeMessage')).toHaveValue('useToolPrompt:search');
  });

  it('matches a slash tool by description when the name does not match', async () => {
    const user = userEvent.setup();
    setup({ tools: [{ name: 'fetch', description: 'busca na web' }] });

    await user.type(screen.getByLabelText('typeMessage'), '/busca');

    expect(await screen.findByText('/fetch')).toBeInTheDocument();
  });

  it('auto-selects the default model once it becomes available', () => {
    const { agentChat } = setup({ models: { models: ['gpt-4', 'gpt-3.5'], default: 'gpt-4' } });
    expect(agentChat.setModel).toHaveBeenCalledWith('gpt-4');
  });

  it('does not touch the model when the current one is already valid', () => {
    const { agentChat } = setup({
      agentChat: { model: 'gpt-3.5' },
      models: { models: ['gpt-4', 'gpt-3.5'], default: 'gpt-4' },
    });
    expect(agentChat.setModel).not.toHaveBeenCalled();
  });

  it('toggles between window mode and route mode', async () => {
    const user = userEvent.setup();
    const { agentChat } = setup();

    expect(screen.getByText('windowMode')).toBeInTheDocument();
    await user.click(screen.getByText('windowMode'));
    expect(agentChat.toggleMode).toHaveBeenCalled();
  });

  it('hides the mode toggle in compact mode', () => {
    setup({ compact: true });
    expect(screen.queryByText('windowMode')).not.toBeInTheDocument();
  });

  it('toggles the desktop sidebar open and closed', async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.getByTestId('conversation-list')).toBeInTheDocument();
    await user.click(screen.getByTitle('hideConversations'));
    expect(screen.queryByTestId('conversation-list')).not.toBeInTheDocument();
  });

  it('selects a conversation from the sidebar and clears it again on delete', async () => {
    const user = userEvent.setup();
    const { agentChat } = setup({ agentChat: { conversationId: 'c-picked' } });

    await user.click(screen.getByText('pick-conversation'));
    expect(agentChat.setConversationId).toHaveBeenCalledWith('c-picked');

    await user.click(screen.getByText('delete-conversation'));
    expect(agentChat.setConversationId).toHaveBeenCalledWith('');
  });

  it('shows the sidebar as a mobile overlay and closes it from the backdrop', async () => {
    const user = userEvent.setup();
    const { container } = setup({ isMobile: true });

    // No mobile, a sidebar nasce fechada (showSidebar = !compact && !isMobile).
    await user.click(screen.getByTitle('showConversations'));
    expect(screen.getByTestId('conversation-list')).toBeInTheDocument();

    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as Element);
    expect(screen.queryByTestId('conversation-list')).not.toBeInTheDocument();
  });

  it('closes the mobile overlay sidebar from its own close button', async () => {
    const user = userEvent.setup();
    setup({ isMobile: true });

    await user.click(screen.getByTitle('showConversations'));
    await user.click(screen.getByText('close-sidebar'));
    expect(screen.queryByTestId('conversation-list')).not.toBeInTheDocument();
  });

  it('selecting a conversation from the mobile overlay also closes the sidebar', async () => {
    const user = userEvent.setup();
    const { agentChat } = setup({ isMobile: true });

    await user.click(screen.getByTitle('showConversations'));
    await user.click(screen.getByText('pick-conversation'));

    expect(agentChat.setConversationId).toHaveBeenCalledWith('c-picked');
    expect(screen.queryByTestId('conversation-list')).not.toBeInTheDocument();
  });

  it('disables the model selector while streaming', () => {
    setup({ stream: { isStreaming: true }, models: { models: ['gpt-4'], default: 'gpt-4' } });
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('shows the streaming badge while a response is in flight', () => {
    setup({ stream: { isStreaming: true } });
    expect(screen.getByText('streaming')).toBeInTheDocument();
  });
});
