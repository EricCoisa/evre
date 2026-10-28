import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EditorProvider, useEditor, useEditorOrThrow } from './context';
import { EMPTY_LAYOUT } from './mutations';

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
