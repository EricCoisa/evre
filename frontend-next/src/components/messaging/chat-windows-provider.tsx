'use client';

import { createContext, useContext, useState } from 'react';
import { format } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { Window } from '@/components/window';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import {
  useMessagingConnections,
  useMessagingContacts,
  useResolveConversations,
} from '@/lib/actions/messaging/queries';
import { connectionDisplayName } from '@/lib/messaging/connection';
import { contactDisplayName } from '@/lib/messaging/contact';
import type {
  MessagingConnection,
  MessagingConversationSummary,
} from '@/lib/actions/messaging/types';
import { ContactAvatar } from './contact-avatar';
import { MessageThread } from './message-thread';

/** O mínimo para abrir uma conversa: qualquer tela que conheça a conexão e o telefone pode abrir o chat. */
export interface ChatTarget {
  /** Conexão (número da casa) pela qual a conversa acontece. */
  connectionId: string;
  phone: string;
  name?: string | null;
  pushName?: string | null;
}

type ChatExtra = Pick<ChatTarget, 'name' | 'pushName'>;

/** A mesma pessoa em duas conexões são duas conversas. */
const chatKey = (chat: ChatTarget) => `${chat.connectionId}:${chat.phone}`;
const sameChat = (a: ChatTarget, b: ChatTarget) => chatKey(a) === chatKey(b);

interface ChatWindowsContextValue {
  /** `false` quando `MESSAGING_CHAT` está desligada ou o usuário não acessa o módulo. */
  chatEnabled: boolean;
  openChat: (target: ChatTarget) => void;
  /** Resolve qual conversa abrir para um telefone; ponto de entrada único de contatos e "nova conversa". */
  openChatForPhone: (phone: string, extra?: ChatExtra) => void;
}

const ChatWindowsContext = createContext<ChatWindowsContextValue | null>(null);

export function useChatWindows() {
  const value = useContext(ChatWindowsContext);
  if (!value) throw new Error('useChatWindows must be used inside ChatWindowsProvider');
  return value;
}

/** Mostra foto e nome no topo da janela, lendo o contato do servidor para acompanhar atualizações por push. */
function ChatTitle({ target }: { target: ChatTarget }) {
  const { data } = useMessagingContacts({
    connectionId: target.connectionId,
    search: target.phone,
    limit: 5,
  });
  const contact = data?.data.find((item) => item.phone === target.phone);
  const name = contactDisplayName({
    phone: target.phone,
    name: contact?.name ?? target.name,
    pushName: contact?.pushName ?? target.pushName,
  });

  return (
    <span className="flex min-w-0 items-center gap-2">
      <ContactAvatar
        contactId={contact?.id}
        name={name === target.phone ? null : name}
        hasProfilePicture={contact?.hasProfilePicture}
        className="size-7 shrink-0"
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Alvo que o seletor oferece: thread existente (viva ou arquivada) ou conversa nova numa conexão viva. */
interface PickerOption {
  connectionId: string;
  label: string;
  lastMessageAt?: string | null;
  archived: boolean;
  isNew: boolean;
}

interface Picker {
  phone: string;
  extra?: ChatExtra;
  options: PickerOption[];
}

const threadOptions = (
  conversations: MessagingConversationSummary[],
): PickerOption[] =>
  conversations.map((item) => ({
    connectionId: item.connectionId,
    label: item.connectionPhone ?? item.provider,
    lastMessageAt: item.lastMessageAt,
    archived: item.archived,
    isNew: false,
  }));

const newOptions = (connections: MessagingConnection[]): PickerOption[] =>
  connections.map((item) => ({
    connectionId: item.id,
    label: connectionDisplayName(item),
    archived: false,
    isNew: true,
  }));

/** Threads existentes e conexões vivas na mesma lista; arquivada abre em leitura, sem enviar. */
function ConversationPicker({
  picker,
  onPick,
  onOpenChange,
}: {
  picker: Picker | null;
  onPick: (connectionId: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useTranslation('messaging');
  const dateLocale = locale?.startsWith('pt') ? ptBR : enUS;

  return (
    <Dialog open={!!picker} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pickConversationTitle')}</DialogTitle>
          <DialogDescription>{picker?.phone}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {picker?.options.map((item) => (
            <button
              key={`${item.connectionId}:${item.archived}`}
              type="button"
              onClick={() => onPick(item.connectionId)}
              className="flex items-center justify-between gap-3 rounded-md border p-3 text-left text-sm hover:bg-accent"
            >
              <span className="truncate font-mono">{item.label}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {item.archived && <Badge variant="secondary">{t('conversationArchived')}</Badge>}
                {item.isNew && <Badge variant="outline">{t('newConversation')}</Badge>}
                {!item.isNew &&
                  (item.lastMessageAt
                    ? format(new Date(item.lastMessageAt), 'PPp', { locale: dateLocale })
                    : t('noActivity'))}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Gerencia as janelas de conversa, cada uma guardando posição e tamanho por conversa. */
export function ChatWindowsProvider({
  children,
  chatEnabled,
}: {
  children: React.ReactNode;
  chatEnabled: boolean;
}) {
  const [chats, setChats] = useState<ChatTarget[]>([]);
  const [picker, setPicker] = useState<Picker | null>(null);
  const { data: connections = [] } = useMessagingConnections(chatEnabled);
  const fetchConversations = useResolveConversations();

  const openChat = (target: ChatTarget) => {
    if (!chatEnabled) return;
    setChats((current) =>
      current.some((item) => sameChat(item, target))
        ? current.map((item) => (sameChat(item, target) ? { ...item, ...target } : item))
        : [...current, target],
    );
  };

  const closeChat = (chat: ChatTarget) => {
    setChats((current) => current.filter((item) => !sameChat(item, chat)));
  };

  /** Considera como alvo de envio apenas thread em conexão viva, ou conexão viva sem thread. */
  const openChatForPhone = async (phone: string, extra?: ChatExtra) => {
    if (!chatEnabled) return;
    const conversations = await fetchConversations(phone).catch(() => []);
    const live = conversations.filter((item) => !item.archived);
    const archived = conversations.filter((item) => item.archived);

    if (archived.length === 0) {
      if (live.length === 1) {
        openChat({ connectionId: live[0].connectionId, phone, ...extra });
        return;
      }
      if (live.length === 0 && connections.length === 1) {
        openChat({ connectionId: connections[0].id, phone, ...extra });
        return;
      }
    }

    const sendable = live.length > 0 ? threadOptions(live) : newOptions(connections);
    const options = [...sendable, ...threadOptions(archived)];
    if (options.length > 0) setPicker({ phone, extra, options });
  };

  const pickFromDialog = (connectionId: string) => {
    if (!picker) return;
    openChat({ connectionId, phone: picker.phone, ...picker.extra });
    setPicker(null);
  };

  return (
    <ChatWindowsContext.Provider value={{ chatEnabled, openChat, openChatForPhone }}>
      {children}
      {chatEnabled &&
        chats.map((chat, index) => (
          <Window
            key={chatKey(chat)}
            name={`chat-${chatKey(chat)}`}
            title={<ChatTitle target={chat} />}
            cascadeIndex={index}
            setClosed={() => closeChat(chat)}
          >
            <MessageThread connectionId={chat.connectionId} phone={chat.phone} />
          </Window>
        ))}
      <ConversationPicker
        picker={picker}
        onPick={pickFromDialog}
        onOpenChange={(open) => !open && setPicker(null)}
      />
    </ChatWindowsContext.Provider>
  );
}
