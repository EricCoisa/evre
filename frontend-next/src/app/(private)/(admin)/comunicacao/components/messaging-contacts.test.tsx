import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { MessagingContact } from '@/lib/actions/messaging/types';
import { MessagingContacts } from './messaging-contacts';

const mocks = vi.hoisted(() => ({
  useMessagingContacts: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  openChat: vi.fn(),
  connections: [{ id: 'conn-1', provider: 'EVOLUTION_API', phone: '5511900000000' }],
  capability: { disabled: false, reason: undefined as string | undefined },
}));

vi.mock('@/lib/actions/messaging/queries', () => ({
  useMessagingContacts: mocks.useMessagingContacts,
  messagingContactsKey: (params: unknown) => ['messaging', 'contacts', params],
  useMessagingConnections: () => ({ data: mocks.connections }),
  useUpdateMessagingContact: () => ({ mutate: mocks.update, isPending: false }),
  useCreateMessagingContact: () => ({ mutate: mocks.create, isPending: false }),
}));
vi.mock('@/components/messaging/chat-windows-provider', () => ({
  useChatWindows: () => ({ chatEnabled: true, openChat: mocks.openChat }),
}));
vi.mock('@/lib/actions/capability/queries', () => ({
  useCapability: () => mocks.capability,
}));
vi.mock('@/contexts/filter-sidebar-context', () => ({
  useFilterSidebar: () => ({ open: vi.fn() }),
}));
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => ({ getQueryState: () => undefined, refetchQueries: vi.fn() }),
}));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'pt-BR' }),
}));

// Contato achado pelo servidor só pelo telefone: sem `name` e sem `pushName` que casem com o texto buscado.
const contact: MessagingContact = {
  id: '1',
  phone: '5534998956461',
  name: null,
  pushName: null,
  hasProfilePicture: false,
  optOut: false,
  optOutAt: null,
  conversationCount: 1,
  lastConnectionId: 'conn-1',
  // Com data, `lastMessageAt` é uma coluna string e o filtro do cliente passa a valer — como em produção.
  lastMessageAt: '2026-10-03T14:05:00',
  createdAt: '2026-10-01T10:00:00',
};

const result = {
  data: [contact],
  meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  filter: { optOut: ['false', 'true'] },
};

const lastParams = () => mocks.useMessagingContacts.mock.calls.at(-1)![0];

describe('MessagingContacts — busca e filtro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.useMessagingContacts.mockReturnValue({ data: result, error: null, isLoading: false });
  });

  it('a busca vai ao servidor e NÃO esconde de volta o contato que ele achou por telefone', () => {
    render(<MessagingContacts />);
    expect(lastParams()).toMatchObject({ page: 1, limit: 20 });
    expect(lastParams().search).toBeUndefined();

    fireEvent.change(screen.getAllByPlaceholderText('searchContacts')[0], {
      target: { value: '5534998956461' },
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(lastParams()).toMatchObject({ search: '5534998956461', page: 1 });
    // Antes do ajuste, o `includesString` do cliente comparava o texto só com `name` (nulo) e zerava a lista.
    expect(screen.getAllByText('5534998956461').length).toBeGreaterThan(0);
    expect(screen.queryByText('emptyContacts')).not.toBeInTheDocument();
  });

  it('buscar volta para a primeira página', () => {
    mocks.useMessagingContacts.mockReturnValue({
      data: { ...result, meta: { total: 60, page: 3, limit: 20, totalPages: 3 } },
      error: null,
      isLoading: false,
    });
    render(<MessagingContacts />);
    fireEvent.click(screen.getByRole('button', { name: /next|próxima/i }));
    expect(lastParams().page).toBe(2);

    fireEvent.change(screen.getAllByPlaceholderText('searchContacts')[0], { target: { value: 'ana' } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(lastParams()).toMatchObject({ search: 'ana', page: 1 });
  });

  it('o filtro de opt-out oferece os valores do servidor', () => {
    render(<MessagingContacts />);
    expect(screen.getAllByText('optOut').length).toBeGreaterThan(0);
    expect(screen.queryByText(/filterValuesUnavailable/)).not.toBeInTheDocument();
  });

  describe('filtro de conexão (DataTable.Select com options)', () => {
    const singleConnection = mocks.connections;
    const connA = { id: 'conn-1', provider: 'EVOLUTION_API', phone: '5511900000000' };
    const connB = { id: 'conn-2', provider: 'META_CLOUD_API', phone: '5511911111111' };

    // Só com >1 conexão o filtro aparece — mesma regra de `multipleConnections` de antes do refactor.
    beforeEach(() => {
      mocks.connections = [connA, connB];
    });

    afterEach(() => {
      mocks.connections = singleConnection;
    });

    const openConnectionSelect = () => {
      const label = screen.getByText('connection', { selector: 'label' });
      fireEvent.click(within(label.parentElement!).getByRole('combobox'));
    };

    it('com uma única conexão, o filtro não aparece', () => {
      mocks.connections = [connA];
      render(<MessagingContacts />);
      expect(screen.queryByText('connection', { selector: 'label' })).not.toBeInTheDocument();
    });

    it('mostra o nome de exibição (provider · telefone) de cada conexão, não o UUID', () => {
      render(<MessagingContacts />);
      openConnectionSelect();
      expect(screen.getByRole('option', { name: 'EVOLUTION_API · 5511900000000' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'META_CLOUD_API · 5511911111111' })).toBeInTheDocument();
      expect(screen.queryByText('conn-1')).not.toBeInTheDocument();
      expect(screen.queryByText('conn-2')).not.toBeInTheDocument();
    });

    it('selecionar uma conexão manda o UUID como `connectionId` próprio, fora de `filter`', () => {
      render(<MessagingContacts />);
      openConnectionSelect();
      fireEvent.click(screen.getByRole('option', { name: 'META_CLOUD_API · 5511911111111' }));

      expect(lastParams().connectionId).toBe('conn-2');
      expect(lastParams().filter).toBeUndefined();
    });

    it('"all" remove o connectionId e volta a listar todas as conexões', () => {
      render(<MessagingContacts />);
      openConnectionSelect();
      fireEvent.click(screen.getByRole('option', { name: 'META_CLOUD_API · 5511911111111' }));
      expect(lastParams().connectionId).toBe('conn-2');

      openConnectionSelect();
      fireEvent.click(screen.getByRole('option', { name: 'all' }));
      expect(lastParams().connectionId).toBeUndefined();
    });

    it('conexão e opt-out filtram juntos: connectionId separado, optOut dentro de `filter`', () => {
      render(<MessagingContacts />);
      openConnectionSelect();
      fireEvent.click(screen.getByRole('option', { name: 'META_CLOUD_API · 5511911111111' }));

      const optOutLabel = screen.getByText('optOut', { selector: 'label' });
      fireEvent.click(within(optOutLabel.parentElement!).getByRole('combobox'));
      fireEvent.click(screen.getByRole('option', { name: 'true' }));

      expect(lastParams().connectionId).toBe('conn-2');
      expect(JSON.parse(lastParams().filter)).toEqual({ optOut: 'true' });
    });
  });

  describe('colunas', () => {
    const rowOf = (over: Partial<MessagingContact>) => {
      mocks.useMessagingContacts.mockReturnValue({
        data: { ...result, data: [{ ...contact, name: 'Maria Silva', ...over }] },
        error: null,
        isLoading: false,
      });
      render(<MessagingContacts />);
    };

    it('tem a coluna de foto e mostra as iniciais de quem não tem foto', () => {
      rowOf({ hasProfilePicture: false });
      expect(screen.getByText('photo')).toBeInTheDocument();
      expect(screen.getByText('MS')).toBeInTheDocument();
    });

    it('envio permitido é um badge verde', () => {
      rowOf({ optOut: false });
      const badge = screen.getByText('active');
      expect(badge).toHaveAttribute('data-slot', 'badge');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('envio bloqueado (opt-out) é um badge vermelho', () => {
      rowOf({ optOut: true });
      const badge = screen.getByText('optedOut');
      expect(badge).toHaveAttribute('data-slot', 'badge');
      expect(badge).toHaveClass('bg-red-100', 'text-red-800');
    });

    it('o nome mostrado cai para o pushName e depois para o telefone', () => {
      rowOf({ name: null, pushName: 'Mari do Zap' });
      expect(screen.getByText('Mari do Zap')).toBeInTheDocument();
    });

    it('mais de uma conversa mostra um indicador; uma só, não', () => {
      rowOf({ conversationCount: 2 });
      expect(screen.getByText('conversationCount')).toBeInTheDocument();
    });

    it('uma única conversa não mostra indicador', () => {
      rowOf({ conversationCount: 1 });
      expect(screen.queryByText('conversationCount')).not.toBeInTheDocument();
    });

    describe('capability MESSAGING', () => {
      afterEach(() => {
        mocks.capability = { disabled: false, reason: undefined };
      });

      it('capability operacional: botão de chat da linha fica habilitado', () => {
        rowOf({ name: 'Maria Silva' });
        expect(screen.getByRole('button', { name: /openChatWith/ })).toBeEnabled();
      });

      it('capability fora do ar: botão de chat da linha fica desabilitado', () => {
        mocks.capability = { disabled: true, reason: 'Evolution API: Unauthorized' };
        rowOf({ name: 'Maria Silva' });
        const chatButton = screen.getByRole('button', { name: /openChatWith/ });
        expect(chatButton).toBeDisabled();
        expect(chatButton).toHaveAttribute('title', 'Evolution API: Unauthorized');
      });
    });
  });
});
