import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MessageThread } from './message-thread';

const mocks = vi.hoisted(() => ({
  capabilities: { data: undefined as unknown, isError: false, refetch: vi.fn() },
  health: { operational: true, reason: undefined as string | undefined },
  conversations: { data: undefined as unknown },
  composerProps: undefined as Record<string, unknown> | undefined,
  typing: null as string | null,
}));

vi.mock('@/lib/actions/messaging/queries', () => ({
  useMessagingCapabilities: () => mocks.capabilities,
  useMessagingHealth: () => mocks.health,
  useMessagingConversations: () => mocks.conversations,
}));
vi.mock('@/hooks/use-typing-indicator', () => ({
  useTypingIndicator: () => mocks.typing,
}));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'pt-BR' }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('./message-list', () => ({
  MessageList: ({ phone, scrollSignal }: { phone: string; scrollSignal: number }) => (
    <div data-testid="list" data-signal={scrollSignal}>{phone}</div>
  ),
}));
vi.mock('./message-composer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./message-composer')>()),
  MessageComposer: (props: Record<string, unknown>) => {
    mocks.composerProps = props;
    return (
      <button onClick={() => (props.onSent as () => void)()}>composer-sent</button>
    );
  },
}));

const CAPS = {
  provider: 'EVOLUTION_API',
  messageTypes: ['TEXT', 'IMAGE', 'DOCUMENT'],
  template: {
    approval: false,
    providerOwnedBody: [],
    components: { header: [], footer: false, buttons: [] },
  },
  voiceRecording: true,
  serviceWindowHours: null,
};
const file = new File(['x'], 'foto.png', { type: 'image/png' });
const drop = (section: Element, files: File[]) =>
  fireEvent.drop(section, { dataTransfer: { files, types: ['Files'] } });

describe('MessageThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.capabilities = { data: CAPS, isError: false, refetch: vi.fn() };
    mocks.health = { operational: true, reason: undefined };
    mocks.conversations = { data: undefined };
    mocks.composerProps = undefined;
    mocks.typing = null;
  });

  describe('janela de atendimento (provider que declara)', () => {
    it('provider não-Meta nunca mostra o aviso, mesmo sem lastInboundAt', () => {
      render(<MessageThread connectionId="conn-1" phone="1" />);
      expect(screen.queryByText('outsideServiceWindow')).not.toBeInTheDocument();
    });

    it('Meta sem lastInboundAt (nunca recebeu mensagem) mostra o aviso', () => {
      mocks.capabilities = { data: { ...CAPS, provider: 'META', serviceWindowHours: 24 }, isError: false, refetch: vi.fn() };
      render(<MessageThread connectionId="conn-1" phone="1" />);
      expect(screen.getByText('outsideServiceWindow')).toBeInTheDocument();
    });

    it('Meta com lastInboundAt recente não mostra o aviso', () => {
      mocks.capabilities = { data: { ...CAPS, provider: 'META', serviceWindowHours: 24 }, isError: false, refetch: vi.fn() };
      mocks.conversations = {
        data: [{ connectionId: 'conn-1', lastInboundAt: new Date().toISOString() }],
      };
      render(<MessageThread connectionId="conn-1" phone="1" />);
      expect(screen.queryByText('outsideServiceWindow')).not.toBeInTheDocument();
    });

    it('Meta com lastInboundAt há mais de 24h mostra o aviso', () => {
      mocks.capabilities = { data: { ...CAPS, provider: 'META', serviceWindowHours: 24 }, isError: false, refetch: vi.fn() };
      mocks.conversations = {
        data: [
          {
            connectionId: 'conn-1',
            lastInboundAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
          },
        ],
      };
      render(<MessageThread connectionId="conn-1" phone="1" />);
      expect(screen.getByText('outsideServiceWindow')).toBeInTheDocument();
      expect(mocks.composerProps).toMatchObject({ outsideServiceWindow: true });
    });
  });

  it('mostra o telefone, o estado do provider e a lista da conversa', () => {
    render(<MessageThread connectionId="conn-1" phone="5511987654321" />);
    expect(screen.getByTestId('list')).toHaveTextContent('5511987654321');
    expect(screen.getByText('connected')).toBeInTheDocument();
  });

  it('provider indisponível mostra o motivo', () => {
    mocks.health = { operational: false, reason: 'instância desconectada' };
    render(<MessageThread connectionId="conn-1" phone="1" />);
    expect(screen.getByText('unavailable')).toBeInTheDocument();
    expect(screen.getByText('instância desconectada')).toBeInTheDocument();
  });

  it('erro nas capabilities avisa e permite tentar de novo', () => {
    mocks.capabilities = { data: undefined, isError: true, refetch: vi.fn() };
    render(<MessageThread connectionId="conn-1" phone="1" />);
    expect(screen.getByRole('alert')).toHaveTextContent('capabilitiesFailed');
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    expect(mocks.capabilities.refetch).toHaveBeenCalledOnce();
  });

  it('o composer recebe o telefone, as capabilities e o estado do provider', () => {
    render(<MessageThread connectionId="conn-1" phone="5511987654321" />);
    expect(mocks.composerProps).toMatchObject({
      phone: '5511987654321',
      capabilities: CAPS,
      operational: true,
      attachment: null,
    });
  });

  it('arrastar um arquivo para a conversa o anexa como foto/vídeo', () => {
    render(<MessageThread connectionId="conn-1" phone="1" />);
    drop(screen.getByRole('region', { name: 'threadTitle' }), [file]);
    expect(mocks.composerProps?.attachment).toEqual({ file, asDocument: false });
  });

  it('arrastar com o provider fora do ar não anexa', () => {
    mocks.health = { operational: false, reason: 'x' };
    render(<MessageThread connectionId="conn-1" phone="1" />);
    drop(screen.getByRole('region', { name: 'threadTitle' }), [file]);
    expect(mocks.composerProps?.attachment).toBeNull();
  });

  it('cada envio aumenta o sinal que leva a lista ao fim', () => {
    render(<MessageThread connectionId="conn-1" phone="1" />);
    expect(screen.getByTestId('list')).toHaveAttribute('data-signal', '0');
    fireEvent.click(screen.getByRole('button', { name: 'composer-sent' }));
    expect(screen.getByTestId('list')).toHaveAttribute('data-signal', '1');
  });

  it('mostra que o contato está digitando', () => {
    mocks.typing = 'COMPOSING';
    render(<MessageThread connectionId="conn-1" phone="1" />);
    expect(screen.getByText('typingComposing')).toBeInTheDocument();
  });

  it('mostra que o contato está gravando áudio', () => {
    mocks.typing = 'RECORDING';
    render(<MessageThread connectionId="conn-1" phone="1" />);
    expect(screen.getByText('typingRecording')).toBeInTheDocument();
  });

  it('arrastar um arquivo por cima mostra o indicador visual de drop, que some ao soltar', () => {
    render(<MessageThread connectionId="conn-1" phone="1" />);
    const section = screen.getByRole('region', { name: 'threadTitle' });

    fireEvent.dragOver(section, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByText('dropToAttach')).toBeInTheDocument();

    drop(section, [file]);
    expect(screen.queryByText('dropToAttach')).not.toBeInTheDocument();
  });

  it('arrastar algo que não é arquivo não ativa o indicador visual', () => {
    render(<MessageThread connectionId="conn-1" phone="1" />);
    const section = screen.getByRole('region', { name: 'threadTitle' });

    fireEvent.dragOver(section, { dataTransfer: { types: ['text/plain'] } });

    expect(screen.queryByText('dropToAttach')).not.toBeInTheDocument();
  });

  it('sair da área de drop sem soltar esconde o indicador visual', () => {
    render(<MessageThread connectionId="conn-1" phone="1" />);
    const section = screen.getByRole('region', { name: 'threadTitle' });

    fireEvent.dragOver(section, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByText('dropToAttach')).toBeInTheDocument();

    fireEvent.dragLeave(section, { relatedTarget: document.body });
    expect(screen.queryByText('dropToAttach')).not.toBeInTheDocument();
  });
});
