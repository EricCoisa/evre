import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorProvider, useEditorOrThrow } from './context';
import { InlineRichText } from './inline-rich-text';
import { BlockChrome } from './block-chrome';
import type { PageBlock, PageLayout } from '../schema';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
}));

const mockLayout: PageLayout = {
  v: 1,
  blocks: [
    {
      id: 'text-1',
      type: 'text.rich',
      span: 12,
      props: { content: '*Texto em negrito* inicial' },
    },
    {
      id: 'chart-1',
      type: 'chart.area',
      span: 12,
      props: { title: 'Gráfico' },
    },
  ],
};

function TestEditorShell({ children }: { children: React.ReactNode }) {
  return (
    <EditorProvider initial={mockLayout} profile="dashboard">
      {children}
    </EditorProvider>
  );
}

function InlineEditorBlockHarness({ block }: { block: PageBlock }) {
  const editor = useEditorOrThrow();
  return (
    <BlockChrome block={block} spanClass="col-span-12">
      <InlineRichText
        blockId={block.id}
        propName="content"
        value={String(block.props?.content ?? '')}
        onChange={(val) => editor.setProp(block.id, 'content', val)}
        placeholder="Digite algo..."
        showFontSize
        variables={[{ token: 'total', label: 'Total de Usuários' }]}
      />
    </BlockChrome>
  );
}

describe('InlineRichText & Suspended Toolbar', () => {
  it('renderiza o texto formatado no canvas e permite digitação inline', () => {
    render(
      <TestEditorShell>
        <InlineEditorBlockHarness block={mockLayout.blocks[0]} />
      </TestEditorShell>,
    );

    const textbox = screen.getByRole('textbox', { name: 'content' });
    expect(textbox).toBeInTheDocument();
    expect(screen.getByText('Texto em negrito').tagName).toBe('STRONG');
  });

  it('exibe a barra suspensa de rich text quando o editor do bloco é selecionado/focado', async () => {
    const user = userEvent.setup();
    render(
      <TestEditorShell>
        <InlineEditorBlockHarness block={mockLayout.blocks[0]} />
      </TestEditorShell>,
    );

    const blockElement = screen.getByTestId('pb-block-text-1');
    await user.click(blockElement);

    // Toolbar contextual suspensa fica ativa
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Negrito (*texto*)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Itálico (_texto_)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Riscado (~texto~)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Código (```texto```)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tamanho de fonte' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Variável' })).toBeInTheDocument();
    });
  });

  it('não polui a UI: não exibe barra de rich text quando um bloco que não é editor está ativo', async () => {
    const user = userEvent.setup();
    render(
      <TestEditorShell>
        <BlockChrome block={mockLayout.blocks[1]} spanClass="col-span-12">
          <div>Conteúdo do Gráfico</div>
        </BlockChrome>
      </TestEditorShell>,
    );

    const chartBlock = screen.getByTestId('pb-block-chart-1');
    await user.click(chartBlock);

    // A barra de rich text NÃO aparece para o gráfico, mantendo a UI limpa
    expect(screen.queryByRole('button', { name: 'Negrito (*texto*)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tamanho de fonte' })).not.toBeInTheDocument();
  });
});

