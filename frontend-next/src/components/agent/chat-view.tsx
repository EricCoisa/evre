"use client";

import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/use-translation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAgentChat } from './agent-chat-provider';
import { useAiHealth } from '@/lib/actions/ai/use-ai-health';
import { useCreateConversation, useAiTools } from '@/lib/actions/ai/queries';
import { useAiModels } from '@/lib/actions/ai/queries';
import type { ChatMessage, ToolEvent } from '@/lib/actions/ai/use-ai-stream';
import { toast } from 'sonner';
import ConversationList from './conversation-list';
import MessageItem from './message-item';
import ToolCallGroup from './tool-call-group';
import ApprovalCard from './approval-card';
import ThinkingPanel from './thinking-panel';
import { Button } from '@/components/ui/button';
import { RichTextInput } from '@/components/rich-text-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Square, ArrowUp, Bot, PanelLeft, PanelLeftClose } from 'lucide-react';

/** Resolve qual modelo o seletor deve mostrar, mantendo a escolha atual se ela ainda for válida. */
export function resolveSelectedModel(
  current: string,
  available: string[],
  fallback: string,
): string {
  return current && available.includes(current) ? current : fallback;
}

const ModelSelector = memo(function ModelSelector({
  model, onValueChange, disabled, models, placeholder,
}: {
  model: string; onValueChange: (v: string) => void;
  disabled: boolean; models: string[]; placeholder: string;
}) {
  return (
    <Select value={model} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {models.map((m) => (
          <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

interface ChatViewProps {
  compact?: boolean;
}

function useSlashTools(input: string, tools?: Array<{ name: string; description: string }>) {
  const slashQuery = useMemo(
    () => (input.startsWith('/') ? input.slice(1).toLowerCase() : null),
    [input],
  );
  const slashTools = useMemo(() => {
    if (slashQuery === null) return [];
    return (tools ?? []).filter(
      (tool) =>
        tool.name.toLowerCase().includes(slashQuery) ||
        tool.description.toLowerCase().includes(slashQuery),
    );
  }, [tools, slashQuery]);
  const slashOpen = slashQuery !== null && slashTools.length > 0;
  return { slashTools, slashOpen };
}

function buildToolNameMap(messages: ChatMessage[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const msg of messages) {
    const calls = msg.toolCalls as Array<{ id: string; name: string }> | undefined;
    if (calls) {
      for (const c of calls) {
        map[c.id] = c.name;
      }
    }
  }
  return map;
}

type TranslateFn = ReturnType<typeof useTranslation>['t'];

type DisplayItem =
  | { type: 'message'; msg: ChatMessage & { role: 'user' | 'assistant' } }
  | { type: 'toolGroup'; msgs: ChatMessage[] };

function buildDisplayItems(messages: ChatMessage[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  for (const msg of messages) {
    if (msg.role === 'assistant' && !msg.content.trim()) continue;
    if (msg.role === 'tool') {
      const last = items[items.length - 1];
      if (last?.type === 'toolGroup') {
        last.msgs.push(msg);
      } else {
        items.push({ type: 'toolGroup', msgs: [msg] });
      }
      continue;
    }
    items.push({ type: 'message', msg: msg as ChatMessage & { role: 'user' | 'assistant' } });
  }
  return items;
}

function ChatHeader({
  showSidebar,
  onToggleSidebar,
  modelData,
  model,
  onModelChange,
  isStreaming,
  compact,
  mode,
  onToggleMode,
  t,
}: {
  showSidebar: boolean;
  onToggleSidebar: () => void;
  modelData: ReturnType<typeof useAiModels>['data'];
  model: string;
  onModelChange: (v: string) => void;
  isStreaming: boolean;
  compact: boolean;
  mode: string;
  onToggleMode: () => void;
  t: (k: string) => string;
}) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          onClick={onToggleSidebar}
          title={t(showSidebar ? 'hideConversations' : 'showConversations')}
        >
          {showSidebar ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
        </Button>
        <h2 className="text-sm font-medium">{t('chatWithAI')}</h2>
      </div>
      <div className="flex items-center gap-2">
        {modelData && (
          <ModelSelector
            model={model}
            onValueChange={onModelChange}
            disabled={isStreaming || !modelData.models.length}
            models={modelData.models}
            placeholder={t('selectModel')}
          />
        )}
        {isStreaming && <Badge variant="secondary">{t('streaming')}</Badge>}
        {!compact && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleMode}
            disabled={isStreaming}
            className="hidden md:inline-flex"
          >
            {mode === 'window' ? t('bringBack') : t('windowMode')}
          </Button>
        )}
      </div>
    </div>
  );
}

function ChatStatusAlerts({
  isBlocked,
  byokRequired,
  reason,
  configHref,
  error,
  onNavigate,
  t,
}: {
  isBlocked: boolean;
  byokRequired: boolean;
  reason?: string | null;
  configHref: string;
  error?: string | null;
  onNavigate: (href: string) => void;
  t: (k: string) => string;
}) {
  return (
    <>
      {isBlocked && (
        <Alert variant="destructive" className="m-4">
          <AlertDescription className="flex flex-col gap-2">
            <span>{byokRequired ? t('notConfiguredByokHint') : t('notConfiguredAdminHint')}</span>
            {reason && <span className="text-xs opacity-80">{reason}</span>}
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => onNavigate(configHref)}
            >
              {t('configureNow')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="m-4">
          <AlertDescription className="break-words">{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}

function ChatMessageList({
  displayItems,
  toolNameByCallId,
  isEmpty,
  isStreaming,
  pendingText,
  pendingApproval,
  reasoning,
  toolEvents,
  lastMessage,
  canRetry,
  canRewind,
  onRetry,
  onEditFrom,
  onApproval,
  bottomRef,
  t,
}: {
  displayItems: DisplayItem[];
  toolNameByCallId: Record<string, string>;
  isEmpty: boolean;
  isStreaming: boolean;
  pendingText: string;
  pendingApproval: { toolCallId: string; scope: string } | null;
  reasoning: string;
  toolEvents: ToolEvent[];
  lastMessage?: ChatMessage;
  canRetry: boolean;
  canRewind: boolean;
  onRetry: (id: string) => void;
  onEditFrom: (id: string) => void;
  onApproval: (decision: 'once' | 'conversation' | 'deny') => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  t: (k: string) => string;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-3 p-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <Bot className="size-10 opacity-40" />
            <p className="text-sm">{t('emptyState')}</p>
          </div>
        )}

        {displayItems.map((item) =>
          item.type === 'toolGroup' ? (
            <ToolCallGroup
              key={item.msgs[0].id}
              messages={item.msgs}
              toolNameByCallId={toolNameByCallId}
            />
          ) : (
            <MessageItem
              key={item.msg.id}
              message={item.msg}
              onRetry={
                canRetry && item.msg.id === lastMessage?.id
                  ? () => void onRetry(item.msg.id)
                  : undefined
              }
              onRewind={
                canRewind && item.msg.role === 'user' && item.msg.id !== lastMessage?.id
                  ? () => void onEditFrom(item.msg.id)
                  : undefined
              }
            />
          ),
        )}

        {isStreaming && pendingText && (
          <MessageItem message={{ id: 'streaming', role: 'assistant', content: pendingText }} streaming />
        )}

        {pendingApproval && (
          <ApprovalCard scope={pendingApproval.scope} onApprove={onApproval} />
        )}

        <ThinkingPanel reasoning={reasoning} toolEvents={toolEvents} />

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function ChatInputBar({
  input,
  setInput,
  inputRef,
  onSend,
  onStop,
  canSend,
  isStreaming,
  pendingApproval,
  isBlocked,
  slashTools,
  slashOpen,
  onPickTool,
  t,
}: {
  input: string;
  setInput: (v: string) => void;
  inputRef: React.RefObject<HTMLDivElement | null>;
  onSend: () => void;
  onStop: () => void;
  canSend: boolean;
  isStreaming: boolean;
  pendingApproval: { toolCallId: string; scope: string } | null;
  isBlocked: boolean;
  slashTools: Array<{ name: string; description?: string }>;
  slashOpen: boolean;
  onPickTool: (name: string) => void;
  t: TranslateFn;
}) {
  return (
    <div className="border-t p-2">
      <Popover open={slashOpen}>
        <PopoverTrigger asChild>
          <div className="flex w-full gap-2">
            <RichTextInput
              inputRef={inputRef}
              value={input}
              onChange={setInput}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                onSend();
              }}
              placeholder={t('typeMessage')}
              disabled={isStreaming || Boolean(pendingApproval) || isBlocked}
              ariaLabel={t('typeMessage')}
              formatLabels={{
                bold: t('formatBold'),
                italic: t('formatItalic'),
                strikethrough: t('formatStrikethrough'),
                code: t('formatCode'),
              }}
              className="flex-1"
            />
            {isStreaming ? (
              <Button size="icon" variant="outline" onClick={onStop} title={t('stopStream')}>
                <Square className="size-4" />
              </Button>
            ) : (
              <Button size="icon" onClick={onSend} disabled={!canSend}>
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <ul className="max-h-56 overflow-y-auto text-sm">
            {slashTools.map((tool) => (
              <li key={tool.name}>
                <button
                  type="button"
                  onClick={() => onPickTool(tool.name)}
                  className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left hover:bg-accent"
                >
                  <span className="font-mono text-xs">/{tool.name}</span>
                  <span className="text-xs text-muted-foreground">{tool.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function useChatActions({
  input,
  setInput,
  canSend,
  conversationId,
  setConversationId,
  createConversation,
  sendMessage,
  rewindTo,
  inputRef,
  isStreaming,
  pendingApproval,
}: {
  input: string;
  setInput: (v: string) => void;
  canSend: boolean;
  conversationId: string;
  setConversationId: (id: string) => void;
  createConversation: ReturnType<typeof useCreateConversation>;
  sendMessage: (text: string, convId: string) => Promise<void>;
  rewindTo: (id: string) => Promise<string | undefined>;
  inputRef: React.RefObject<HTMLDivElement | null>;
  isStreaming: boolean;
  pendingApproval: { toolCallId: string; scope: string } | null;
}) {
  const [rewinding, setRewinding] = useState(false);
  const canRewind = !isStreaming && !pendingApproval && Boolean(conversationId) && !rewinding;

  const handleSendMessage = async () => {
    if (!canSend) return;
    let id = conversationId;
    if (!id) {
      id = await createConversation.mutateAsync({});
      if (!id) return;
      setConversationId(id);
    }
    const text = input;
    setInput('');
    await sendMessage(text, id);
  };

  const handleRetry = async (messageId: string) => {
    if (!canRewind) return;
    setRewinding(true);
    try {
      const text = await rewindTo(messageId);
      if (text) await sendMessage(text, conversationId);
    } finally {
      setRewinding(false);
    }
  };

  const handleEditFrom = async (messageId: string) => {
    if (!canRewind) return;
    setRewinding(true);
    try {
      const text = await rewindTo(messageId);
      if (text !== undefined) {
        setInput(text);
        inputRef.current?.focus();
      }
    } finally {
      setRewinding(false);
    }
  };

  return { rewinding, canRewind, handleSendMessage, handleRetry, handleEditFrom };
}

function getChatStatusFlags({
  messages,
  pendingText,
  isStreaming,
  pendingApproval,
  rewinding,
}: {
  messages: ChatMessage[];
  pendingText: string;
  isStreaming: boolean;
  pendingApproval: unknown;
  rewinding: boolean;
}) {
  const isEmpty = messages.length === 0 && !pendingText && !isStreaming;
  const lastMessage = messages[messages.length - 1];
  const canRetry = !isStreaming && !pendingApproval && !rewinding && lastMessage?.role === 'user';
  return { isEmpty, lastMessage, canRetry };
}

function useAgentChatState(props: ChatViewProps) {
  const compact = props.compact ?? false;
  const isMobile = useIsMobile();
  const { t } = useTranslation('agent');
  const router = useRouter();
  const { mode, setMode, toggleMode, conversationId, setConversationId, stream, model, setModel } = useAgentChat();
  const { operational, byokRequired, reason, isLoading: healthLoading } = useAiHealth();
  const { data: modelData } = useAiModels();
  const { data: tools } = useAiTools();
  const createConversation = useCreateConversation();
  const isBlocked = !healthLoading && !operational;
  const [input, setInput] = useState('');
  const configHref = byokRequired ? '/profile?tab=agenteConfig' : '/settings?tab=agenteConfig';
  const [showSidebar, setShowSidebar] = useState(!compact && !isMobile);

  const { messages, isStreaming, pendingText, reasoning, toolEvents, pendingApproval, error, sendMessage, resolveApproval, rewindTo, stopStream } = stream;
  const { slashTools, slashOpen } = useSlashTools(input, tools);

  const pickTool = (name: string) => setInput(t('useToolPrompt', { tool: name }));

  useEffect(() => {
    if (!modelData?.default) return;
    const next = resolveSelectedModel(model, modelData.models, modelData.default);
    if (next !== model) setModel(next);
  }, [modelData, model, setModel]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const inputRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingText, pendingApproval]);

  const canSend = Boolean(input.trim()) && !isStreaming && !pendingApproval && !isBlocked;

  return {
    compact,
    isMobile,
    t,
    router,
    mode,
    setMode,
    toggleMode,
    conversationId,
    setConversationId,
    model,
    setModel,
    modelData,
    createConversation,
    isBlocked,
    byokRequired,
    reason,
    configHref,
    showSidebar,
    setShowSidebar,
    input,
    setInput,
    inputRef,
    bottomRef,
    messages,
    isStreaming,
    pendingText,
    reasoning,
    toolEvents,
    pendingApproval,
    error,
    sendMessage,
    resolveApproval,
    rewindTo,
    stopStream,
    slashTools,
    slashOpen,
    pickTool,
    canSend,
  };
}

const ChatView = (props: ChatViewProps) => {
  const state = useAgentChatState(props);
  const {
    compact,
    isMobile,
    t,
    router,
    mode,
    setMode,
    toggleMode,
    conversationId,
    setConversationId,
    model,
    setModel,
    modelData,
    createConversation,
    isBlocked,
    byokRequired,
    reason,
    configHref,
    showSidebar,
    setShowSidebar,
    input,
    setInput,
    inputRef,
    bottomRef,
    messages,
    isStreaming,
    pendingText,
    reasoning,
    toolEvents,
    pendingApproval,
    error,
    sendMessage,
    resolveApproval,
    rewindTo,
    stopStream,
    slashTools,
    slashOpen,
    pickTool,
    canSend,
  } = state;

  const {
    rewinding,
    canRewind,
    handleSendMessage,
    handleRetry,
    handleEditFrom,
  } = useChatActions({
    input,
    setInput,
    canSend,
    conversationId,
    setConversationId,
    createConversation,
    sendMessage,
    rewindTo,
    inputRef,
    isStreaming,
    pendingApproval,
  });

  const handleApproval = (decision: 'once' | 'conversation' | 'deny') => {
    if (pendingApproval) resolveApproval(pendingApproval.toolCallId, decision);
  };

  const handleDeleteConversation = (id: string) => {
    if (conversationId === id) setConversationId('');
  };

  const { isEmpty, lastMessage, canRetry } = getChatStatusFlags({
    messages,
    pendingText,
    isStreaming,
    pendingApproval,
    rewinding,
  });

  const toolNameByCallId = useMemo(() => buildToolNameMap(messages), [messages]);
  const displayItems = useMemo(() => buildDisplayItems(messages), [messages]);

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden rounded-lg border bg-card">
      {/* Desktop inline sidebar */}
      {showSidebar && !isMobile && !compact && (
        <ConversationList
          selectedId={conversationId}
          onSelectConversation={(id) => {
            setConversationId(id);
          }}
          onDeleteConversation={handleDeleteConversation}
        />
      )}

      {/* Mobile / Compact overlay sidebar */}
      {showSidebar && (isMobile || compact) && (
        <div className="absolute inset-0 z-30 flex">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in-50 cursor-pointer"
            onClick={() => setShowSidebar(false)}
            aria-hidden="true"
          />
          <div className="relative z-40 h-full w-72 max-w-[85%] bg-card shadow-2xl border-r animate-in slide-in-from-left duration-200">
            <ConversationList
              selectedId={conversationId}
              onSelectConversation={(id) => {
                setConversationId(id);
                setShowSidebar(false);
              }}
              onDeleteConversation={handleDeleteConversation}
              onClose={() => setShowSidebar(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          showSidebar={showSidebar}
          onToggleSidebar={() => setShowSidebar((v) => !v)}
          modelData={modelData}
          model={model}
          onModelChange={setModel}
          isStreaming={isStreaming}
          compact={compact}
          mode={mode}
          onToggleMode={toggleMode}
          t={t}
        />

        <ChatStatusAlerts
          isBlocked={isBlocked}
          byokRequired={byokRequired}
          reason={reason}
          configHref={configHref}
          error={error}
          onNavigate={(href) => {
            if (mode === 'window') {
              setMode('route');
            }
            router.push(href);
          }}
          t={t}
        />

        <ChatMessageList
          displayItems={displayItems}
          toolNameByCallId={toolNameByCallId}
          isEmpty={isEmpty}
          isStreaming={isStreaming}
          pendingText={pendingText}
          pendingApproval={pendingApproval}
          reasoning={reasoning}
          toolEvents={toolEvents}
          lastMessage={lastMessage}
          canRetry={canRetry}
          canRewind={canRewind}
          onRetry={handleRetry}
          onEditFrom={handleEditFrom}
          onApproval={handleApproval}
          bottomRef={bottomRef}
          t={t}
        />

        <ChatInputBar
          input={input}
          setInput={setInput}
          inputRef={inputRef}
          onSend={() => void handleSendMessage()}
          onStop={stopStream}
          canSend={canSend}
          isStreaming={isStreaming}
          pendingApproval={pendingApproval}
          isBlocked={isBlocked}
          slashTools={slashTools}
          slashOpen={slashOpen}
          onPickTool={pickTool}
          t={t}
        />
      </div>
    </div>
  );
};

export default ChatView;
