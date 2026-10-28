import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import PageEditor from './editor';
import { BLOCK_META } from '../blocks.meta';
import { EMPTY_LAYOUT } from './mutations';

/** Smoke test da cola React do editor: paleta, contexto, grid e painel ligados. */

// Polyfill de PointerEvent (ausente no jsdom), com isPrimary/pointerId.
if (!('PointerEvent' in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    isPrimary: boolean;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.isPrimary = params.isPrimary ?? false;
    }
  }
  // @ts-expect-error polyfill só pra este arquivo de teste.
  window.PointerEvent = PointerEventPolyfill;
}

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Referências estáveis (não recriadas a cada render) para inspecionar os argumentos da
// mutation e simular o onSuccess manualmente a partir do teste.
const mockSave = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const mockSaveAsDefault = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));

vi.mock('@/lib/actions/pageBuilder/queries', () => ({
  usePageSources: () => ({
    data: [
      {
        key: 'logs.list',
        kind: 'list',
        description: 'Logs de auditoria.',
        fields: ['module', 'action'],
        params: [{ name: 'limit', type: 'number', description: 'Linhas.' }],
      },
    ],
    isLoading: false,
  }),
  useSavePageLayout: () => mockSave,
  useSaveSystemPageLayout: () => mockSaveAsDefault,
}));

// test-setup mocka useMe devolvendo null (não-admin); os testes de admin sobrescrevem.
const mockMe = vi.hoisted(() => ({ current: null as { role: string } | null }));
vi.mock('@/lib/actions/auth/queries', () => ({
  useMe: () => ({ data: mockMe.current, isLoading: false, error: null }),
}));

// O bloco em si não busca dado neste teste — quem tem teste de dado é o renderer.
vi.mock('@/lib/api/collector', () => ({
  Collector: (fn: unknown) => fn,
  errorStatus: () => undefined,
}));
vi.mock('../data-sources', () => ({ getDataSource: () => undefined }));

function renderEditor(onExit: () => void = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return {
    onExit,
    ...render(
      <PageEditor pageKey="/dashboard" initial={EMPTY_LAYOUT} onExit={onExit} />,
      { wrapper },
    ),
  };
}

const addButton = (type: string) =>
  screen.getByRole('button', { name: new RegExp(type.replace('.', '\\.')) });

describe('PageEditor', () => {
  beforeEach(() => {
    mockMe.current = null;
  });

  it('abre vazio, com o painel pedindo uma seleção', () => {
    renderEditor();

    expect(screen.getByText('editor.emptyPage')).toBeInTheDocument();
    expect(screen.getByText('editor.nothingSelected')).toBeInTheDocument();
  });

  it('adiciona um bloco pela paleta e já o seleciona no painel', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(addButton('alert.banner'));

    expect(screen.queryByText('editor.emptyPage')).not.toBeInTheDocument();
    // A description do bloco só existe no painel (o botão da paleta mostra só o type), então
    // achá-la prova que o bloco novo já entrou selecionado.
    expect(screen.getByText(BLOCK_META['alert.banner'].description)).toBeInTheDocument();
    // E o campo gerado a partir de BLOCK_META.
    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it('gera o formulário a partir do BLOCK_META, não de código por bloco', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(addButton('table.basic'));

    // props de table.basic: title + columns
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('columns')).toBeInTheDocument();
    // e o seletor de fonte, porque table.basic consome `list`
    expect(screen.getByText('editor.dataSource')).toBeInTheDocument();
  });

  it('bloco container não oferece fonte de dados', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(addButton('group'));

    expect(screen.queryByText('editor.dataSource')).not.toBeInTheDocument();
  });

  it('remover pela toolbar tira o bloco da página e limpa a seleção', async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();

    await user.click(addButton('alert.banner'));
    const block = container.querySelector('[data-testid^="pb-block-"]')!;
    expect(block).toBeInTheDocument();

    await user.click(
      within(block as HTMLElement).getByRole('button', { name: 'editor.remove' }),
    );

    expect(container.querySelector('[data-testid^="pb-block-"]')).toBeNull();
    expect(screen.getByText('editor.nothingSelected')).toBeInTheDocument();
  });

  it('deixa selecionar um bloco DENTRO de um group', async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();

    await user.click(addButton('group'));
    // Com o group selecionado, a paleta adiciona dentro dele.
    await user.click(addButton('table.basic'));

    const group = container.querySelector('[data-testid^="pb-block-group-"]')!;
    const child = container.querySelector('[data-testid^="pb-block-table-basic-"]')!;
    expect(child).toBeInTheDocument();

    // O invariante que fazia a seleção cair sempre no group: o conteúdo de um CONTAINER não
    // pode desligar o ponteiro, senão o filho nunca recebe o clique. Num bloco comum tem que
    // continuar desligado, senão clicar numa linha da tabela não seleciona o bloco.
    // (Asserção na classe porque o jsdom não aplica o CSS do Tailwind — um clique aqui
    // passaria mesmo com o bug presente.)
    expect(group.querySelector(':scope > [data-pb-content]')).not.toHaveClass(
      'pointer-events-none',
    );
    expect(child.querySelector(':scope > [data-pb-content]')).toHaveClass(
      'pointer-events-none',
    );

    await user.click(child as HTMLElement);

    expect(
      screen.getByText(BLOCK_META['table.basic'].description),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(BLOCK_META.group.description),
    ).not.toBeInTheDocument();
  });

  it('arrastar um bloco aninhado mostra o mesmo DragOverlay que arrastar um da raiz', async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();

    await user.click(addButton('alert.banner'));
    await user.click(addButton('group'));
    await user.click(addButton('table.basic'));

    const rootBlock = container.querySelector('[data-testid^="pb-block-alert-banner-"]')!;
    const nestedBlock = container.querySelector('[data-testid^="pb-block-table-basic-"]')!;
    expect(rootBlock).toBeInTheDocument();
    expect(nestedBlock).toBeInTheDocument();

    const startDrag = (block: Element) => {
      const grip = within(block as HTMLElement).getByRole('button', {
        name: 'editor.drag',
      });
      fireEvent.pointerDown(grip, {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX: 0,
        clientY: 0,
      });
      fireEvent.pointerMove(document, { pointerId: 1, clientX: 20, clientY: 20 });
    };
    const endDrag = () => fireEvent.pointerUp(document, { pointerId: 1 });

    expect(screen.queryByTestId('pb-drag-preview')).not.toBeInTheDocument();

    startDrag(rootBlock);
    expect(screen.getByTestId('pb-drag-preview')).toHaveTextContent('alert.banner');
    endDrag();
    await waitFor(() =>
      expect(screen.queryByTestId('pb-drag-preview')).not.toBeInTheDocument(),
    );

    startDrag(nestedBlock);
    expect(screen.getByTestId('pb-drag-preview')).toHaveTextContent('table.basic');
    endDrag();
    await waitFor(() =>
      expect(screen.queryByTestId('pb-drag-preview')).not.toBeInTheDocument(),
    );
  }, 15000);

  it('"Salvar como Padrão" só aparece para ADMIN', () => {
    const { unmount } = renderEditor();
    expect(
      screen.queryByRole('button', { name: 'editor.saveAsDefault' }),
    ).not.toBeInTheDocument();
    unmount();

    mockMe.current = { role: 'ADMIN' };
    renderEditor();

    // Publicar o padrão do sistema não exige alteração pendente: o admin pode promover o
    // layout que já está na tela (por exemplo, o dele) para padrão de todos.
    expect(
      screen.getByRole('button', { name: 'editor.saveAsDefault' }),
    ).toBeEnabled();
  });

  it('salvar só habilita depois de alguma alteração', async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(screen.getByRole('button', { name: 'editor.save' })).toBeDisabled();

    await user.click(addButton('alert.banner'));

    expect(screen.getByRole('button', { name: 'editor.save' })).toBeEnabled();
  });
});

describe('Palette — alvo de inserção', () => {
  it('bloco adicionado com um filho do group selecionado vai para o MESMO group', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: /group/i }));
    await user.click(screen.getByRole('button', { name: /alert\.banner/i }));
    // Seleção está no alert.banner (filho). O próximo bloco deve nascer irmão dele, não na raiz.
    await user.click(screen.getByRole('button', { name: /table\.basic/i }));

    const group = screen
      .getAllByTestId(/^pb-block-/)
      .find((el) => el.dataset.testid?.startsWith('pb-block-group-'))!;
    expect(group).toBeTruthy();
    expect(group.querySelectorAll('[data-testid^="pb-block-"]')).toHaveLength(2);
  });
});

describe('EditorShell — salvar, salvar como padrão e cancelar', () => {
  beforeEach(() => {
    mockMe.current = null;
    mockSave.mutate.mockReset();
    mockSave.isPending = false;
    mockSaveAsDefault.mutate.mockReset();
    mockSaveAsDefault.isPending = false;
  });

  it('salvar aciona a mutation com o pageKey e o draft; sucesso avisa e sai do editor', async () => {
    const user = userEvent.setup();
    const { onExit } = renderEditor();

    await user.click(addButton('alert.banner'));
    await user.click(screen.getByRole('button', { name: 'editor.save' }));

    expect(mockSave.mutate).toHaveBeenCalledTimes(1);
    const [arg, opts] = mockSave.mutate.mock.calls[0];
    expect(arg).toMatchObject({ pageKey: '/dashboard' });
    expect(arg.layout.blocks).toHaveLength(1);

    opts.onSuccess();
    expect(toast.success).toHaveBeenCalledWith('editor.saved');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('salvar como padrão pede confirmação; recusar não chama a mutation', async () => {
    const user = userEvent.setup();
    mockMe.current = { role: 'ADMIN' };
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderEditor();

    await user.click(screen.getByRole('button', { name: 'editor.saveAsDefault' }));

    expect(confirmSpy).toHaveBeenCalledWith('editor.saveAsDefaultConfirm');
    expect(mockSaveAsDefault.mutate).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('salvar como padrão confirmado chama a mutation; sucesso avisa e sai do editor', async () => {
    const user = userEvent.setup();
    mockMe.current = { role: 'ADMIN' };
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onExit } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'editor.saveAsDefault' }));

    expect(mockSaveAsDefault.mutate).toHaveBeenCalledTimes(1);
    const [, opts] = mockSaveAsDefault.mutate.mock.calls[0];
    opts.onSuccess();
    expect(toast.success).toHaveBeenCalledWith('editor.savedAsDefault');
    expect(onExit).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it('cancelar sem alteração sai direto, sem pedir confirmação', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { onExit } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'editor.cancel' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it('cancelar com alteração pendente pede confirmação; recusar mantém o editor aberto', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onExit } = renderEditor();

    await user.click(addButton('alert.banner'));
    await user.click(screen.getByRole('button', { name: 'editor.cancel' }));

    expect(confirmSpy).toHaveBeenCalledWith('editor.discardConfirm');
    expect(onExit).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('cancelar com alteração pendente e confirmação aceita sai do editor', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onExit } = renderEditor();

    await user.click(addButton('alert.banner'));
    await user.click(screen.getByRole('button', { name: 'editor.cancel' }));

    expect(onExit).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });
});
