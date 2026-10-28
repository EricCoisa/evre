import { createRef } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextInput } from './rich-text-input';

const LABELS = { bold: 'Bold', italic: 'Italic', strikethrough: 'Strikethrough', code: 'Monospace' };

describe('RichTextInput', () => {
  it('renders WhatsApp formatting and exposes accessible formatting controls', () => {
    render(
      <RichTextInput
        value={'*bold* _italic_ ~strikethrough~ ```code```'}
        onChange={vi.fn()}
        placeholder="Write a message"
        ariaLabel="Message"
        formatLabels={{
          bold: 'Bold',
          italic: 'Italic',
          strikethrough: 'Strikethrough',
          code: 'Monospace',
        }}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
    expect(screen.getByText('strikethrough')).toHaveClass('line-through');
    expect(screen.getByText('code')).toHaveClass('font-mono');
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Strikethrough' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Monospace' })).toBeInTheDocument();
  });

  it('disables formatting controls together with the editor', () => {
    render(
      <RichTextInput
        value=""
        onChange={vi.fn()}
        placeholder="Write a message"
        ariaLabel="Message"
        disabled
        formatLabels={{
          bold: 'Bold',
          italic: 'Italic',
          strikethrough: 'Strikethrough',
          code: 'Monospace',
        }}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Bold' })).toBeDisabled();
  });

  it('mostra o placeholder quando o valor está vazio', () => {
    render(
      <RichTextInput
        value=""
        onChange={vi.fn()}
        placeholder="Write a message"
        ariaLabel="Message"
        formatLabels={LABELS}
      />,
    );

    expect(screen.getByText('Write a message')).toBeInTheDocument();
  });

  it('clicar num botão de formatação não quebra o editor', () => {
    render(
      <RichTextInput
        value=""
        onChange={vi.fn()}
        placeholder="Write a message"
        ariaLabel="Message"
        formatLabels={LABELS}
      />,
    );

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Bold' }))).not.toThrow();
  });

  it('repassa onKeyDown e onPaste para o campo editável', async () => {
    const onKeyDown = vi.fn();
    const onPaste = vi.fn();
    render(
      <RichTextInput
        value=""
        onChange={vi.fn()}
        placeholder="Write a message"
        ariaLabel="Message"
        formatLabels={LABELS}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />,
    );

    const textbox = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.keyDown(textbox, { key: 'Enter' });
    await act(async () => {
      const transfer = {
        files: [],
        types: ['text/plain'],
        getData: (type: string) => {
          if (type === 'text/plain') return '';
          return '';
        },
      };
      fireEvent.paste(textbox, {
        clipboardData: transfer,
        dataTransfer: transfer,
      });
      await Promise.resolve();
    });

    expect(onKeyDown).toHaveBeenCalled();
    expect(onPaste).toHaveBeenCalled();
  });

  it('encaminha o inputRef para o elemento editável', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <RichTextInput
        value=""
        onChange={vi.fn()}
        placeholder="Write a message"
        ariaLabel="Message"
        formatLabels={LABELS}
        inputRef={ref}
      />,
    );

    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(screen.getByRole('textbox', { name: 'Message' }));
  });

  it('ao mudar o value por fora, sincroniza o conteúdo do editor', async () => {
    const { rerender } = render(
      <RichTextInput
        value="hello"
        onChange={vi.fn()}
        placeholder="Write a message"
        ariaLabel="Message"
        formatLabels={LABELS}
      />,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();

    rerender(
      <RichTextInput
        value="*bold*"
        onChange={vi.fn()}
        placeholder="Write a message"
        ariaLabel="Message"
        formatLabels={LABELS}
      />,
    );

    await waitFor(() => expect(screen.getByText('bold').tagName).toBe('STRONG'));
  });
});
