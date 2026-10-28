import { StrictMode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Window } from './window';
import { useIsMobile } from '@/hooks/use-mobile';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Default ao comportamento real (desktop) — o teste de visão mobile sobrescreve pontualmente.
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: vi.fn(() => false) }));

/** Host da janela no <body> — o empilhamento é a posição dele entre os irmãos. */
function host(el: HTMLElement) {
  return el.closest('.fixed')!.parentElement as HTMLElement;
}

function isOnTop(el: HTMLElement) {
  return host(el).nextElementSibling === null;
}

describe('Window', () => {
  it('traz a janela clicada para cima das outras', async () => {
    render(
      <>
        <Window title="primeira" name="w1"><p>conteudo 1</p></Window>
        <Window title="segunda" name="w2"><p>conteudo 2</p></Window>
      </>
    );

    const first = await screen.findByText('conteudo 1');
    const second = screen.getByText('conteudo 2');

    // A última a montar abre no topo.
    expect(isOnTop(second)).toBe(true);

    await userEvent.click(first);
    expect(isOnTop(first)).toBe(true);

    // O handle de resize dá stopPropagation — o capture tem que pegar mesmo assim.
    await userEvent.pointer({ keys: '[MouseLeft>]', target: host(second).querySelector('.cursor-nwse-resize')! });
    expect(isOnTop(second)).toBe(true);
  });

  it('fica abaixo da faixa dos overlays (z-50) para não cobrir dropdowns de dentro dela', async () => {
    render(<Window title="uma" name="wz"><p>conteudo</p></Window>);

    const root = (await screen.findByText('conteudo')).closest('.fixed')!;
    expect(root.className).toContain('z-40');
    expect(root.className).not.toContain('z-50');
  });

  it('mantém tamanho e posição ao desmontar e montar de novo', async () => {
    window.innerWidth = 1200;
    window.innerHeight = 900;
    localStorage.setItem('reopen', JSON.stringify({ size: { width: 500, height: 400 }, position: { x: 111, y: 222 } }));

    // StrictMode porque é o que o Next roda em dev: os effects duplicam, e era aí que o
    // effect de gravação salvava o default antes da leitura acontecer.
    const view = render(<StrictMode><Window title="a" name="reopen"><p>conteudo</p></Window></StrictMode>);
    view.unmount();
    render(<StrictMode><Window title="a" name="reopen"><p>conteudo</p></Window></StrictMode>);

    const root = (await screen.findByText('conteudo')).closest('.fixed') as HTMLElement;
    expect([root.style.left, root.style.top]).toEqual(['111px', '222px']);
    expect([root.style.width, root.style.height]).toEqual(['500px', '400px']);
  });

  it('encaixa no viewport uma janela salva fora da tela', async () => {
    window.innerWidth = 800;
    window.innerHeight = 600;
    localStorage.setItem('offscreen', JSON.stringify({ size: { width: 400, height: 300 }, position: { x: 3000, y: 2000 } }));

    render(<Window title="a" name="offscreen"><p>conteudo</p></Window>);

    const root = (await screen.findByText('conteudo')).closest('.fixed') as HTMLElement;
    // 800 - 400 e 600 - 300
    expect([root.style.left, root.style.top]).toEqual(['400px', '300px']);
  });

  it('abre no canto inferior direito com tamanho padrão quando não há nada salvo', async () => {
    window.innerWidth = 1200;
    window.innerHeight = 900;

    render(<Window title="nova" name="w3"><p>conteudo</p></Window>);

    const root = (await screen.findByText('conteudo')).closest('.fixed') as HTMLElement;
    expect(root.style.width).toBe('460px');
    expect(root.style.height).toBe('620px');
    // 1200 - 460 - 24 e 900 - 620 - 24
    expect(root.style.left).toBe('716px');
    expect(root.style.top).toBe('256px');
  });

  it('desloca novas janelas em cascata sem substituir geometria salva', async () => {
    window.innerWidth = 1200;
    window.innerHeight = 900;
    render(<Window title="segunda" name="cascade" cascadeIndex={1}><p>conteudo</p></Window>);

    const root = (await screen.findByText('conteudo')).closest('.fixed') as HTMLElement;
    expect([root.style.left, root.style.top]).toEqual(['684px', '224px']);
  });

  it('arrasta e redimensiona por Pointer Events', async () => {
    window.innerWidth = 1200;
    window.innerHeight = 900;
    localStorage.removeItem('pointer');
    render(<Window title="pointer" name="pointer"><p>conteudo</p></Window>);

    const root = (await screen.findByText('conteudo')).closest('.fixed') as HTMLElement;
    const titleBar = root.querySelector('.cursor-grab')!;
    act(() => titleBar.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 720, clientY: 260 })));
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 760, clientY: 300 }));
      window.dispatchEvent(new MouseEvent('pointerup'));
    });
    expect(root.style.left).not.toBe('716px');
    expect(root.style.top).not.toBe('256px');
    expect(Number.parseFloat(root.style.left)).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(root.style.top)).toBeGreaterThanOrEqual(0);

    window.innerWidth = 1400;
    window.innerHeight = 1100;
    const resizeHandle = root.querySelector('.cursor-nwse-resize')!;
    act(() => resizeHandle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 1196, clientY: 896 })));
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 1206, clientY: 908 }));
      window.dispatchEvent(new MouseEvent('pointerup'));
    });
    expect(root.style.width).not.toBe('460px');
    expect(root.style.height).not.toBe('620px');
    expect(Number.parseFloat(root.style.width)).toBeLessThanOrEqual(window.innerWidth);
    expect(Number.parseFloat(root.style.height)).toBeLessThanOrEqual(window.innerHeight);
  });

  it('fica oculta (display:none) quando enabled=false', async () => {
    render(<Window title="a" name="disabled-window" enabled={false}><p>conteudo</p></Window>);
    const root = (await screen.findByText('conteudo')).closest('.fixed') as HTMLElement;
    expect(root.style.display).toBe('none');
  });

  it('chama setClosed(false) ao clicar no botão de fechar', async () => {
    const user = userEvent.setup();
    const setClosed = vi.fn();
    render(<Window title="a" name="close-window" setClosed={setClosed}><p>conteudo</p></Window>);

    await user.click(await screen.findByText('close'));
    expect(setClosed).toHaveBeenCalledWith(false);
  });

  it('renderiza a visão mobile em tela cheia, sem drag/resize, quando useIsMobile() é true', async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const setClosed = vi.fn();
    render(<Window title="titulo mobile" name="mobile-window" setClosed={setClosed}><p>conteudo mobile</p></Window>);

    const content = await screen.findByText('conteudo mobile');
    const root = content.closest('.inset-0') as HTMLElement;
    expect(root).not.toBeNull();
    // Desktop usa z-40; a visão mobile usa z-50 (acima dos overlays) e ocupa a tela cheia.
    expect(root.className).toContain('z-50');
    expect(root.className).not.toContain('z-40');
    expect(root.querySelector('.cursor-nwse-resize')).toBeNull();
    expect(root.querySelector('.cursor-grab')).toBeNull();

    await userEvent.setup().click(screen.getByText('close'));
    expect(setClosed).toHaveBeenCalledWith(false);
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  it('trava o scroll do body enquanto a visão mobile está enabled', async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const { unmount } = render(<Window title="a" name="mobile-scroll-lock" enabled><p>conteudo</p></Window>);
    await screen.findByText('conteudo');
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
    vi.mocked(useIsMobile).mockReturnValue(false);
  });
});
