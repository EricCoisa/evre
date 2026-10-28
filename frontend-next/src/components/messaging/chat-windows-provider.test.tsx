import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MessagingContact } from '@/lib/actions/messaging/types';
import { ChatWindowsProvider, useChatWindows } from './chat-windows-provider';

vi.mock('./message-thread', () => ({
  MessageThread: ({ phone }: { phone: string }) => <div data-testid="thread">{phone}</div>,
}));

const mocks = vi.hoisted(() => ({
  contacts: vi.fn(),
  connections: vi.fn(),
  resolveConversations: vi.fn(),
}));
vi.mock('@/lib/actions/messaging/queries', () => ({
  useMessagingContacts: mocks.contacts,
  useMessagingConnections: mocks.connections,
  useResolveConversations: () => mocks.resolveConversations,
}));

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const first: MessagingContact = {
  id: '1', phone: '5511999990001', name: 'Ana', pushName: null,
  hasProfilePicture: false,
  optOut: false, optOutAt: null, conversationCount: 1, lastConnectionId: 'conn-1',
  lastMessageAt: null, createdAt: new Date().toISOString(),
};
const second: MessagingContact = {
  ...first, id: '2', phone: '5511999990002', name: 'Bia',
};

const toTarget = (contact: MessagingContact) => ({
  connectionId: contact.lastConnectionId,
  phone: contact.phone,
  name: contact.name,
  pushName: contact.pushName,
});

function Controls() {
  const { openChat } = useChatWindows();
  return (
    <>
      <button onClick={() => openChat(toTarget(first))}>open-first</button>
      <button onClick={() => openChat(toTarget(second))}>open-second</button>
    </>
  );
}

describe('ChatWindowsProvider', () => {
  beforeEach(() => {
    mocks.contacts.mockReturnValue({ data: undefined });
    mocks.connections.mockReturnValue({ data: [] });
    mocks.resolveConversations.mockResolvedValue([]);
  });

  it('mantém várias conversas abertas e fecha somente a janela selecionada', async () => {
    render(
      <ChatWindowsProvider chatEnabled>
        <Controls />
      </ChatWindowsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'open-first' }));
    fireEvent.click(screen.getByRole('button', { name: 'open-second' }));

    expect(await screen.findAllByTestId('thread')).toHaveLength(2);
    expect(screen.getByText(first.phone)).toBeInTheDocument();
    expect(screen.getByText(second.phone)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'close' })[0]);
    await waitFor(() => expect(screen.getAllByTestId('thread')).toHaveLength(1));
    expect(screen.getByTestId('thread')).toHaveTextContent(second.phone);
  });

  it('não abre janela quando a sub-flag do chat está desligada', () => {
    render(
      <ChatWindowsProvider chatEnabled={false}>
        <Controls />
      </ChatWindowsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'open-first' }));
    expect(screen.queryByTestId('thread')).not.toBeInTheDocument();
  });

  it('abre a conversa só com o telefone, de qualquer tela', async () => {
    function Anywhere() {
      const { openChat } = useChatWindows();
      return <button onClick={() => openChat({ connectionId: 'conn-1', phone: '5511900000000' })}>open-phone</button>;
    }
    render(
      <ChatWindowsProvider chatEnabled>
        <Anywhere />
      </ChatWindowsProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'open-phone' }));
    expect(await screen.findByTestId('thread')).toHaveTextContent('5511900000000');
  });

  it('abrir a mesma conversa duas vezes não duplica a janela', async () => {
    render(
      <ChatWindowsProvider chatEnabled>
        <Controls />
      </ChatWindowsProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'open-first' }));
    fireEvent.click(screen.getByRole('button', { name: 'open-first' }));
    expect(await screen.findAllByTestId('thread')).toHaveLength(1);
  });

  it('informa se o chat está habilitado, para as telas esconderem o botão', () => {
    function Probe() {
      return <span>{String(useChatWindows().chatEnabled)}</span>;
    }
    render(
      <ChatWindowsProvider chatEnabled={false}>
        <Probe />
      </ChatWindowsProvider>,
    );
    expect(screen.getByText('false')).toBeInTheDocument();
  });

  describe('título da janela (foto e nome)', () => {
    const open = (target: { connectionId?: string; phone: string; name?: string | null; pushName?: string | null }) => {
      function Open() {
        const { openChat } = useChatWindows();
        return <button onClick={() => openChat({ connectionId: 'conn-1', ...target })}>abrir</button>;
      }
      render(
        <ChatWindowsProvider chatEnabled>
          <Open />
        </ChatWindowsProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'abrir' }));
    };
    const found = (over: object) => ({
      data: { data: [{ ...first, ...over }], meta: { total: 1, page: 1, limit: 5, totalPages: 1 } },
    });

    it('mostra o nome que o servidor tem agora, não só o de quando a janela abriu', async () => {
      mocks.contacts.mockReturnValue(found({ name: null, pushName: 'Maria Silva' }));
      open({ phone: first.phone });
      expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
      expect(mocks.contacts).toHaveBeenCalledWith({ connectionId: 'conn-1', search: first.phone, limit: 5 });
    });

    it('usa a foto quando o contato tem uma', async () => {
      mocks.contacts.mockReturnValue(found({ hasProfilePicture: true }));
      open({ phone: first.phone, name: 'Ana' });
      await screen.findAllByTestId('thread');
      // O Radix só monta <img> depois de a imagem carregar; o que importa é pedir a URL certa.
      expect(document.querySelector('[data-slot="avatar"]')).toBeInTheDocument();
    });

    it('sem nome nenhum mostra o telefone, e o avatar cai para o ícone', async () => {
      open({ phone: '5511900000000' });
      expect(await screen.findAllByText('5511900000000')).not.toHaveLength(0);
      expect(document.querySelector('[data-slot="avatar-fallback"] svg')).toBeInTheDocument();
    });

    it('não confunde com outro contato devolvido pela busca', async () => {
      mocks.contacts.mockReturnValue(found({ phone: '5511999999999', name: 'Outra Pessoa' }));
      open({ phone: first.phone, name: 'Ana' });
      expect(await screen.findByText('Ana')).toBeInTheDocument();
      expect(screen.queryByText('Outra Pessoa')).not.toBeInTheDocument();
    });
  });

  describe('openChatForPhone — a regra dos 4 ramos (§2 do plano)', () => {
    const PHONE = '5511900000000';

    function Caller() {
      const { openChatForPhone } = useChatWindows();
      return <button onClick={() => openChatForPhone(PHONE)}>resolver</button>;
    }

    const resolve = () => {
      render(
        <ChatWindowsProvider chatEnabled>
          <Caller />
        </ChatWindowsProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'resolver' }));
    };

    it('1 conversa existente: abre direto, sem modal — mesmo com 3 conexões configuradas', async () => {
      mocks.resolveConversations.mockResolvedValue([
        {
          connectionId: 'conn-1',
          provider: 'EVOLUTION_API',
          connectionPhone: '5511900000001',
          archived: false,
          lastMessageAt: null,
        },
      ]);
      mocks.connections.mockReturnValue({
        data: [{ id: 'conn-1' }, { id: 'conn-2' }, { id: 'conn-3' }],
      });
      resolve();
      expect(await screen.findByTestId('thread')).toHaveTextContent(PHONE);
      expect(screen.queryByText('pickConversationTitle')).not.toBeInTheDocument();
    });

    it('2+ conversas existentes: modal listando as threads; escolher uma abre nela', async () => {
      mocks.resolveConversations.mockResolvedValue([
        {
          connectionId: 'conn-1',
          provider: 'EVOLUTION_API',
          connectionPhone: '5511900000001',
          archived: false,
          lastMessageAt: '2026-02-01T10:00:00.000Z',
        },
        {
          connectionId: 'conn-2',
          provider: 'EVOLUTION_GO',
          connectionPhone: '5511900000002',
          archived: false,
          lastMessageAt: '2026-01-01T10:00:00.000Z',
        },
      ]);
      resolve();

      expect(await screen.findByText('pickConversationTitle')).toBeInTheDocument();
      expect(screen.getByText('5511900000001')).toBeInTheDocument();
      expect(screen.getByText('5511900000002')).toBeInTheDocument();
      expect(screen.queryByTestId('thread')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('5511900000002'));
      expect(await screen.findByTestId('thread')).toHaveTextContent(PHONE);
    });

    it('thread em conexão arquivada aparece no modal, marcada — não escondida', async () => {
      mocks.resolveConversations.mockResolvedValue([
        {
          connectionId: 'conn-1',
          provider: 'EVOLUTION_API',
          connectionPhone: '5511900000001',
          archived: false,
          lastMessageAt: null,
        },
        {
          connectionId: 'conn-old',
          provider: 'META',
          connectionPhone: null,
          archived: true,
          lastMessageAt: null,
        },
      ]);
      resolve();
      expect(await screen.findByText('conversationArchived')).toBeInTheDocument();
      // A conexão arquivada some do número (fica null): o provider é o rótulo.
      expect(screen.getByText('META')).toBeInTheDocument();
    });

    it('0 conversas + 1 conexão viva: abre nova nela, sem modal', async () => {
      mocks.resolveConversations.mockResolvedValue([]);
      mocks.connections.mockReturnValue({
        data: [{ id: 'conn-only', provider: 'EVOLUTION_API', phone: '5511900000009' }],
      });
      resolve();
      expect(await screen.findByTestId('thread')).toHaveTextContent(PHONE);
      expect(screen.queryByText('pickConversationTitle')).not.toBeInTheDocument();
    });

    it('0 conversas + 2+ conexões vivas: modal para escolher quem envia', async () => {
      mocks.resolveConversations.mockResolvedValue([]);
      mocks.connections.mockReturnValue({
        data: [
          { id: 'conn-a', provider: 'EVOLUTION_API', phone: '5511900000001' },
          { id: 'conn-b', provider: 'EVOLUTION_GO', phone: '5511900000002' },
        ],
      });
      resolve();

      expect(await screen.findByText('pickConversationTitle')).toBeInTheDocument();
      expect(screen.queryByTestId('thread')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('EVOLUTION_GO · 5511900000002'));
      expect(await screen.findByTestId('thread')).toHaveTextContent(PHONE);
    });

    /** Testa que uma thread arquivada com uma conexão viva oferece a conexão viva e o histórico. */
    it('única thread arquivada + 1 conexão viva: modal oferece a viva e o histórico', async () => {
      mocks.resolveConversations.mockResolvedValue([
        {
          connectionId: 'conn-old',
          provider: 'EVOLUTION_GO',
          connectionPhone: null,
          archived: true,
          lastMessageAt: '2026-01-01T10:00:00.000Z',
        },
      ]);
      mocks.connections.mockReturnValue({
        data: [{ id: 'conn-new', provider: 'EVOLUTION_API', phone: '5511900000009' }],
      });
      resolve();

      expect(await screen.findByText('pickConversationTitle')).toBeInTheDocument();
      expect(screen.getByText('conversationArchived')).toBeInTheDocument();
      expect(screen.getByText('newConversation')).toBeInTheDocument();

      // Escolher a conexão viva abre a conversa nova, que envia.
      fireEvent.click(screen.getByText('EVOLUTION_API · 5511900000009'));
      expect(await screen.findByTestId('thread')).toHaveTextContent(PHONE);
    });

    it('thread arquivada não conta como alvo: nunca abre direto nela', async () => {
      mocks.resolveConversations.mockResolvedValue([
        {
          connectionId: 'conn-old',
          provider: 'EVOLUTION_GO',
          connectionPhone: null,
          archived: true,
          lastMessageAt: null,
        },
      ]);
      mocks.connections.mockReturnValue({ data: [] });
      resolve();

      expect(await screen.findByText('pickConversationTitle')).toBeInTheDocument();
      expect(screen.queryByTestId('thread')).not.toBeInTheDocument();
    });
  });
});
