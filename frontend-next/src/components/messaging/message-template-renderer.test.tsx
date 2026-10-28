import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageTemplateRenderer } from './message-template-renderer';
import type { MessagingMessage } from '@/lib/actions/messaging/types';

function baseMessage(overrides: Partial<MessagingMessage>): MessagingMessage {
  return {
    id: '1',
    connectionId: 'c1',
    direction: 'OUTBOUND',
    status: 'SENT',
    phone: '5500000000',
    type: 'TEMPLATE',
    createdAt: new Date().toISOString(),
    templateData: {
      name: 'tpl',
      language: 'pt_BR',
      category: 'UTILITY',
      body: 'corpo da mensagem',
    },
    ...overrides,
  } as MessagingMessage;
}

describe('MessageTemplateRenderer', () => {
  it('renders nothing when the message type is not TEMPLATE', () => {
    const message = { ...baseMessage({}), type: 'TEXT', templateData: undefined } as unknown as MessagingMessage;
    const { container } = render(<MessageTemplateRenderer message={message} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when templateData is missing even if type is TEMPLATE', () => {
    const message = { ...baseMessage({}), templateData: undefined } as unknown as MessagingMessage;
    const { container } = render(<MessageTemplateRenderer message={message} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the body', () => {
    render(<MessageTemplateRenderer message={baseMessage({})} />);
    expect(screen.getByText('corpo da mensagem')).toBeInTheDocument();
  });

  it('renders a TEXT header', () => {
    const message = baseMessage({
      templateData: {
        name: 'tpl',
        language: 'pt_BR',
        category: 'UTILITY',
        body: 'corpo',
        header: { kind: 'TEXT', text: 'Cabeçalho' },
      },
    });
    render(<MessageTemplateRenderer message={message} />);
    expect(screen.getByText('Cabeçalho')).toBeInTheDocument();
  });

  it('renders the footer', () => {
    const message = baseMessage({
      templateData: {
        name: 'tpl',
        language: 'pt_BR',
        category: 'UTILITY',
        body: 'corpo',
        footer: 'Rodapé',
      },
    });
    render(<MessageTemplateRenderer message={message} />);
    expect(screen.getByText('Rodapé')).toBeInTheDocument();
  });

  it('renders a URL button as a link opening in a new tab', () => {
    const message = baseMessage({
      templateData: {
        name: 'tpl',
        language: 'pt_BR',
        category: 'UTILITY',
        body: 'corpo',
        buttons: [{ kind: 'URL', label: 'Visitar', url: 'https://example.com' }],
      },
    });
    render(<MessageTemplateRenderer message={message} />);
    const link = screen.getByText('Visitar');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders a PHONE_NUMBER button as a tel: link', () => {
    const message = baseMessage({
      templateData: {
        name: 'tpl',
        language: 'pt_BR',
        category: 'UTILITY',
        body: 'corpo',
        buttons: [{ kind: 'PHONE_NUMBER', label: 'Ligar', phoneNumber: '5511999999999' }],
      },
    });
    render(<MessageTemplateRenderer message={message} />);
    expect(screen.getByText('Ligar')).toHaveAttribute('href', 'tel:5511999999999');
  });

  it('renders QUICK_REPLY and COPY_CODE buttons as plain labels, not links', () => {
    const message = baseMessage({
      templateData: {
        name: 'tpl',
        language: 'pt_BR',
        category: 'UTILITY',
        body: 'corpo',
        buttons: [
          { kind: 'QUICK_REPLY', label: 'Resposta rápida' },
          { kind: 'COPY_CODE', label: 'Copiar código' },
        ],
      },
    });
    render(<MessageTemplateRenderer message={message} />);
    expect(screen.getByText('Resposta rápida').tagName).toBe('DIV');
    expect(screen.getByText('Copiar código').tagName).toBe('DIV');
  });

  it('omits the buttons row entirely when there are no buttons', () => {
    render(<MessageTemplateRenderer message={baseMessage({})} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
