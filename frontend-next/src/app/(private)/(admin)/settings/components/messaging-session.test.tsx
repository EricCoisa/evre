import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MessagingSession } from '@/lib/actions/messaging/types';
import { MessagingSessionCard } from './messaging-session';

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock('@/lib/actions/messaging/api', () => ({
  getMessagingSession: mocks.getSession,
  connectMessagingSession: vi.fn(),
  disconnectMessagingSession: vi.fn(),
}));
// O Collector real desembrulha o ApiResponse e lança em erro; aqui só o desembrulho importa.
vi.mock('@/lib/api/collector', () => ({
  Collector:
    (fn: (...args: unknown[]) => Promise<{ data: unknown }>) =>
    async (...args: unknown[]) =>
      (await fn(...args)).data,
}));

const respond = (session: Partial<MessagingSession> & { supported?: boolean }) =>
  mocks.getSession.mockResolvedValue({ success: true, data: session, message: '', status: 200 });

function renderCard(phone?: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MessagingSessionCard connectionId="conn-1" phone={phone} />
    </QueryClientProvider>,
  );
}

describe('MessagingSessionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('instância nunca criada tem rótulo próprio e oferece conectar (que a cria)', async () => {
    respond({ supported: true, status: 'NOT_CREATED' });
    renderCard();
    expect(await screen.findByText('Instância não criada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Conectar WhatsApp/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Desconectar/ })).not.toBeInTheDocument();
  });

  it('desconectada é diferente de não criada', async () => {
    respond({ supported: true, status: 'DISCONNECTED' });
    renderCard();
    expect(await screen.findByText('Desconectado')).toBeInTheDocument();
    expect(screen.queryByText('Instância não criada')).not.toBeInTheDocument();
  });

  it('conectada mostra o número pareado e só oferece desconectar', async () => {
    respond({ supported: true, status: 'CONNECTED', phoneNumber: '5534998956461' });
    renderCard();
    expect(await screen.findByText('Conectado')).toBeInTheDocument();
    expect(screen.getByText(/5534998956461/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Desconectar/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Conectar WhatsApp/ })).not.toBeInTheDocument();
  });

  it('pareando mostra o QR e o código', async () => {
    respond({ supported: true, status: 'CONNECTING', qrCode: 'data:image/png;base64,AAAA', pairingCode: 'ABCD-1234' });
    renderCard();
    expect(await screen.findByAltText(/QR code/)).toBeInTheDocument();
    expect(screen.getByText('ABCD-1234')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerar novo QR/ })).toBeInTheDocument();
  });

  /** Testa que o status "aguardando leitura" sem QR pronto explica que o provider ainda não gerou o código. */
  it('pareando sem QR pronto explica que o provider ainda não gerou', async () => {
    respond({ supported: true, status: 'CONNECTING' });
    renderCard();
    expect(await screen.findByRole('status')).toHaveTextContent(
      /ainda não gerou o código/,
    );
    expect(screen.queryByAltText(/QR code/)).not.toBeInTheDocument();
  });

  it('número diferente do da conexão: avisa e lembra qual número parear', async () => {
    respond({ supported: true, status: 'DISCONNECTED', error: 'PHONE_MISMATCH', expectedPhone: '5534998956461' });
    renderCard('5534998956461');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Número diferente.*5534998956461/);
    expect(screen.getByText(/Pareie com o número 5534998956461/)).toBeInTheDocument();
  });

  it('número já usado por outra conexão tem aviso próprio', async () => {
    respond({ supported: true, status: 'DISCONNECTED', error: 'PHONE_IN_USE' });
    renderCard();
    expect(await screen.findByRole('alert')).toHaveTextContent(/outra conexão/);
  });

  it('Meta (sem sessão) não renderiza o card', async () => {
    respond({ supported: false, status: 'CONNECTED' });
    const { container } = renderCard();
    await vi.waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
