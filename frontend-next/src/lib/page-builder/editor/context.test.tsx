import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import {
  EditorProvider,
  useEditingEffectParams,
  useEditor,
  useEditorOrThrow,
} from './context';
import { EMPTY_LAYOUT } from './mutations';
import type { PageLayout } from '../schema';

function ThrowingConsumer() {
  useEditorOrThrow();
  return null;
}

function NullConsumer({ onRead }: { onRead: (value: unknown) => void }) {
  onRead(useEditor());
  return null;
}

describe('useEditorOrThrow', () => {
  it('lança fora de <EditorProvider>', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<ThrowingConsumer />)).toThrow(
      'useEditorOrThrow fora de <EditorProvider>',
    );

    errorSpy.mockRestore();
  });

  it('não lança dentro de <EditorProvider>', () => {
    expect(() =>
      render(
        <EditorProvider initial={EMPTY_LAYOUT}>
          <ThrowingConsumer />
        </EditorProvider>,
      ),
    ).not.toThrow();
  });
});

describe('useEditor', () => {
  it('devolve null fora do modo de edição', () => {
    const onRead = vi.fn();
    render(<NullConsumer onRead={onRead} />);

    expect(onRead).toHaveBeenCalledWith(null);
  });

  it('devolve o contexto dentro de <EditorProvider>', () => {
    const onRead = vi.fn();
    render(
      <EditorProvider initial={EMPTY_LAYOUT}>
        <NullConsumer onRead={onRead} />
      </EditorProvider>,
    );

    expect(onRead).toHaveBeenCalledWith(expect.objectContaining({ draft: EMPTY_LAYOUT }));
  });
});

const layoutWithBlock: PageLayout = {
  v: 1,
  blocks: [{ id: 'b1', type: 'stat.card', props: { label: 'Total' } }],
};

function EffectParamsProbe({ blockId }: { blockId: string }) {
  const params = useEditingEffectParams(blockId);
  return <span data-testid="params">{JSON.stringify(params)}</span>;
}

function EffectHarness({ onReady }: { onReady: (editor: ReturnType<typeof useEditorOrThrow>) => void }) {
  const editor = useEditorOrThrow();
  onReady(editor);
  return <EffectParamsProbe blockId="b1" />;
}

describe('edição ao vivo de efeito', () => {
  it('startEditingEffect arma o rascunho sem tocar no draft', () => {
    let editor!: ReturnType<typeof useEditorOrThrow>;
    render(
      <EditorProvider initial={layoutWithBlock}>
        <EffectHarness onReady={(e) => (editor = e)} />
      </EditorProvider>,
    );

    act(() => editor.startEditingEffect('b1', 'tilt3d', { rotateX: 6 }));

    expect(editor.editingEffect).toEqual({ blockId: 'b1', type: 'tilt3d' });
    expect(screen.getByTestId('params')).toHaveTextContent('{"rotateX":6}');
  });

  it('updateEditingEffectParams mescla no rascunho e notifica quem usa useEditingEffectParams', () => {
    let editor!: ReturnType<typeof useEditorOrThrow>;
    render(
      <EditorProvider initial={layoutWithBlock}>
        <EffectHarness onReady={(e) => (editor = e)} />
      </EditorProvider>,
    );

    act(() => editor.startEditingEffect('b1', 'tilt3d', { rotateX: 6, rotateY: 3 }));
    act(() => editor.updateEditingEffectParams({ rotateX: 20 }));

    expect(screen.getByTestId('params')).toHaveTextContent('{"rotateX":20,"rotateY":3}');
  });

  it('saveEditingEffect grava o bloco em UMA mudança e sai do modo de edição', () => {
    let editor!: ReturnType<typeof useEditorOrThrow>;
    render(
      <EditorProvider initial={layoutWithBlock}>
        <EffectHarness onReady={(e) => (editor = e)} />
      </EditorProvider>,
    );

    act(() => editor.startEditingEffect('b1', 'tilt3d', {}));
    act(() => editor.updateEditingEffectParams({ rotateX: 12 }));
    act(() => editor.saveEditingEffect());

    expect(editor.editingEffect).toBeNull();
    expect(editor.draft.blocks[0].effect).toEqual({ type: 'tilt3d', params: { rotateX: 12 } });
    expect(editor.canUndo).toBe(true);
  });

  it('cancelEditingEffect descarta o rascunho sem tocar no draft', () => {
    let editor!: ReturnType<typeof useEditorOrThrow>;
    render(
      <EditorProvider initial={layoutWithBlock}>
        <EffectHarness onReady={(e) => (editor = e)} />
      </EditorProvider>,
    );

    act(() => editor.startEditingEffect('b1', 'tilt3d', { rotateX: 12 }));
    act(() => editor.cancelEditingEffect());

    expect(editor.editingEffect).toBeNull();
    expect(editor.draft.blocks[0].effect).toBeUndefined();
    expect(editor.canUndo).toBe(false);
  });

  it('Esc cancela a edição em andamento', () => {
    let editor!: ReturnType<typeof useEditorOrThrow>;
    render(
      <EditorProvider initial={layoutWithBlock}>
        <EffectHarness onReady={(e) => (editor = e)} />
      </EditorProvider>,
    );

    act(() => editor.startEditingEffect('b1', 'tilt3d', {}));
    expect(editor.editingEffect).not.toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(editor.editingEffect).toBeNull();
  });

  it('bloco que não está em edição recebe null estável — nunca re-renderiza por causa do outro', () => {
    let editor!: ReturnType<typeof useEditorOrThrow>;
    let otherBlockRenders = 0;
    function OtherBlockProbe() {
      otherBlockRenders += 1;
      useEditingEffectParams('other-block');
      return null;
    }

    render(
      <EditorProvider initial={layoutWithBlock}>
        <EffectHarness onReady={(e) => (editor = e)} />
        <OtherBlockProbe />
      </EditorProvider>,
    );
    const rendersBeforeEditing = otherBlockRenders;

    act(() => editor.startEditingEffect('b1', 'tilt3d', { rotateX: 6 }));
    act(() => editor.updateEditingEffectParams({ rotateX: 20 }));
    act(() => editor.updateEditingEffectParams({ rotateX: 40 }));

    // `editor.editingEffect` (blockId/type) muda com startEditingEffect — isso é um update normal
    // de contexto, então o probe de outro bloco PODE re-renderizar uma vez por isso. O que importa
    // é que as mudanças de PARÂMETRO (updateEditingEffectParams, a parte de alta frequência) não
    // disparem re-render adicional nenhum nele.
    const rendersAfterStart = otherBlockRenders;
    expect(screen.getByTestId('params')).toHaveTextContent('{"rotateX":40}'); // b1 (o editado) reagiu
    expect(otherBlockRenders).toBe(rendersAfterStart); // other-block não reagiu aos updates de params
    expect(rendersAfterStart).toBeLessThanOrEqual(rendersBeforeEditing + 1);
  });
});
