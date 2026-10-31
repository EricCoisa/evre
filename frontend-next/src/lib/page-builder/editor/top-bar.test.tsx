import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EditorTopBar } from './top-bar';
import { EditorProvider } from './context';
import { EMPTY_LAYOUT } from './mutations';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderTopBar(onPreview?: () => void, onDescribe?: () => void) {
  return render(
    <EditorProvider initial={EMPTY_LAYOUT}>
      <EditorTopBar
        pageKey="/dashboard"
        dirty={false}
        saving={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onPreview={onPreview}
        onDescribe={onDescribe}
      />
    </EditorProvider>,
  );
}

describe('EditorTopBar — preview', () => {
  it('mostra o botão de preview quando onPreview é passado', () => {
    const onPreview = vi.fn();
    renderTopBar(onPreview);

    const button = screen.getByRole('button', { name: 'editor.preview' });
    button.click();
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it('não mostra o botão de preview quando onPreview não é passado', () => {
    renderTopBar(undefined);

    expect(screen.queryByRole('button', { name: 'editor.preview' })).not.toBeInTheDocument();
  });
});

describe('EditorTopBar — describe', () => {
  it('mostra o botão de describe quando onDescribe é passado', () => {
    const onDescribe = vi.fn();
    renderTopBar(undefined, onDescribe);

    const button = screen.getByRole('button', { name: 'editor.describe' });
    button.click();
    expect(onDescribe).toHaveBeenCalledTimes(1);
  });

  it('não mostra o botão de describe quando onDescribe não é passado', () => {
    renderTopBar(undefined, undefined);

    expect(screen.queryByRole('button', { name: 'editor.describe' })).not.toBeInTheDocument();
  });
});
