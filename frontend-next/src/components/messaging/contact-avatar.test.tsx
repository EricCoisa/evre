import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ContactAvatar } from './contact-avatar';

/** O Radix só renderiza <img> depois que `new Image()` carrega; aqui o carregamento é controlado. */
function stubImage(outcome: 'load' | 'error') {
  const requested: string[] = [];
  class FakeImage extends EventTarget {
    crossOrigin?: string;
    referrerPolicy?: string;
    private current = '';
    private loaded = false;
    get src() {
      return this.current;
    }
    set src(value: string) {
      this.current = value;
      requested.push(value);
      queueMicrotask(() => {
        this.loaded = outcome === 'load';
        this.dispatchEvent(new Event(outcome));
      });
    }
    get complete() {
      return this.loaded;
    }
    get naturalWidth() {
      return this.loaded ? 1 : 0;
    }
  }
  vi.stubGlobal('Image', FakeImage);
  return requested;
}

describe('ContactAvatar', () => {
  beforeEach(() => {
    stubImage('load');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('com foto, pede a imagem pelo proxy do front e a exibe', async () => {
    const requested = stubImage('load');
    render(<ContactAvatar contactId="contact-1" name="Maria Silva" hasProfilePicture />);

    await waitFor(() => expect(document.querySelector('img')).toBeInTheDocument());
    expect(requested).toEqual(['/api/messaging/contacts/contact-1/photo']);
  });

  it('sem foto conhecida, nem pede a imagem — mostra as iniciais', () => {
    const requested = stubImage('load');
    render(<ContactAvatar contactId="contact-1" name="Maria Silva" hasProfilePicture={false} />);

    expect(screen.getByText('MS')).toBeInTheDocument();
    expect(requested).toEqual([]);
  });

  it('foto que falha (URL expirada e não renovada) cai para as iniciais', async () => {
    stubImage('error');
    render(<ContactAvatar contactId="contact-1" name="Ana" hasProfilePicture />);

    expect(await screen.findByText('A')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('sem nome, usa o ícone — a inicial de um número não diz nada', () => {
    const { container } = render(<ContactAvatar contactId="contact-1" name={null} />);
    expect(container.querySelector('[data-slot="avatar-fallback"] svg')).toBeInTheDocument();
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });
});
