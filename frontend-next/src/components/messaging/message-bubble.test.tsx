import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MessagingMessage } from '@/lib/actions/messaging/types';
import { MessageBubble } from './message-bubble';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'pt-BR' }),
}));

const base: MessagingMessage = {
  id: 'm1',
  connectionId: 'conn-1',
  direction: 'INBOUND',
  status: 'DELIVERED',
  phone: '5511999990001',
  type: 'TEXT',
  text: null,
  createdAt: '2026-10-03T14:05:00',
};

const render1 = (message: Partial<MessagingMessage>, startsRun = true) =>
  render(<MessageBubble message={{ ...base, ...message } as MessagingMessage} startsRun={startsRun} locale="pt-BR" />);

describe('MessageBubble — texto', () => {
  it('mostra o texto preservando quebras de linha e a hora', () => {
    const { container } = render1({ text: 'linha 1\nlinha 2' });
    expect(container.querySelector('p')).toHaveClass('whitespace-pre-wrap');
    expect(screen.getByText(/linha 1/)).toBeInTheDocument();
    expect(screen.getByText('14:05')).toBeInTheDocument();
  });

  it('transforma URL em link seguro e não executa HTML', () => {
    render1({ text: 'veja https://exemplo.com/x e <b>negrito</b>' });
    const link = screen.getByRole('link', { name: 'https://exemplo.com/x' });
    expect(link).toHaveAttribute('href', 'https://exemplo.com/x');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText(/<b>negrito<\/b>/)).toBeInTheDocument();
  });

  it('só mostra os ticks nas mensagens enviadas', () => {
    render1({ direction: 'INBOUND', text: 'oi' });
    expect(screen.queryByRole('img', { name: 'status.DELIVERED' })).not.toBeInTheDocument();
  });

  it.each(['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'] as const)('mostra o status %s', (status) => {
    render1({ direction: 'OUTBOUND', status, text: 'oi' });
    expect(screen.getByRole('img', { name: `status.${status}` })).toBeInTheDocument();
  });

  it('falha de envio expõe o motivo', () => {
    render1({ direction: 'OUTBOUND', status: 'FAILED', error: 'Meta 401: token inválido', text: 'oi' });
    expect(screen.getByRole('alert')).toHaveTextContent('Meta 401: token inválido');
  });

  it('tipo não suportado vira aviso, nunca bolha vazia', () => {
    render1({ type: 'UNSUPPORTED' });
    expect(screen.getByText('unsupportedMessage')).toBeInTheDocument();
  });

  it('template mostra o rótulo "Template" com ícone e renderiza o corpo', () => {
    render1({
      type: 'TEMPLATE',
      text: null,
      templateData: {
        name: 'boas_vindas', language: 'pt-BR', category: 'MARKETING', body: 'Olá {{1}}!',
      },
    } as Partial<MessagingMessage>);

    expect(screen.getByText('Template')).toBeInTheDocument();
    expect(screen.getByText(/Olá/)).toBeInTheDocument();
  });

  it('alinha enviadas à direita e recebidas à esquerda; só a primeira da sequência ganha respiro', () => {
    const { container, rerender } = render1({ direction: 'OUTBOUND', text: 'a' }, true);
    expect(container.firstElementChild).toHaveClass('justify-end', 'mt-3');
    rerender(<MessageBubble message={{ ...base, text: 'b' }} startsRun={false} locale="pt-BR" />);
    expect(container.firstElementChild).toHaveClass('justify-start', 'mt-0.5');
  });
});

describe('MessageBubble — mídia', () => {
  const proxy = '/api/messaging/messages/m1/media';

  it('IMAGE usa o proxy e mostra a legenda abaixo', () => {
    render1({ type: 'IMAGE', text: 'minha foto' });
    expect(screen.getAllByRole('img', { name: 'minha foto' })[0]).toHaveAttribute('src', proxy);
    expect(screen.getAllByText('minha foto').length).toBeGreaterThan(0);
  });

  it('clicar na imagem abre a ampliação', () => {
    render1({ type: 'IMAGE' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'openImage' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('envio por link usa a própria URL, não o proxy', () => {
    render1({ direction: 'OUTBOUND', type: 'IMAGE', mediaUrl: 'https://cdn.exemplo.com/a.png' });
    expect(screen.getByRole('img', { name: 'image' })).toHaveAttribute('src', 'https://cdn.exemplo.com/a.png');
  });

  it('VIDEO e AUDIO usam elementos nativos com controles', () => {
    const { container, unmount } = render1({ type: 'VIDEO' });
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('src', proxy);
    expect(video).toHaveAttribute('controls');
    unmount();

    const audio = render1({ type: 'AUDIO' }).container.querySelector('audio')!;
    expect(audio).toHaveAttribute('src', proxy);
    expect(audio).toHaveAttribute('controls');
  });

  it('STICKER é imagem sem balão', () => {
    const { container } = render1({ type: 'STICKER' });
    expect(screen.getByRole('img', { name: 'sticker' })).toHaveAttribute('src', proxy);
    expect(container.querySelector('article')).toHaveClass('bg-transparent');
  });

  it('DOCUMENT é um link de download com o nome do arquivo', () => {
    render1({ type: 'DOCUMENT', fileName: 'relatório.pdf' });
    const link = screen.getByRole('link', { name: /relatório\.pdf/ });
    expect(link).toHaveAttribute('href', proxy);
    expect(link).toHaveAttribute('download', 'relatório.pdf');
  });

  it('mídia que o provider não tem mais mostra aviso e permite tentar de novo', () => {
    const { container } = render1({ type: 'IMAGE' });
    fireEvent.error(screen.getByRole('img', { name: 'image' }));

    expect(screen.getByText('mediaUnavailable')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    expect(container.querySelector('img')).toBeInTheDocument();
  });
});
