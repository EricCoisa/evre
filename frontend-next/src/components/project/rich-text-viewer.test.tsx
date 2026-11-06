import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RichTextViewer } from './rich-text-viewer';

describe('RichTextViewer', () => {
  it('renderiza texto vazio com fallbackText quando fornecido', () => {
    render(<RichTextViewer content="" fallbackText="Sem conteúdo registrado" />);
    expect(screen.getByText('Sem conteúdo registrado')).toBeInTheDocument();
  });

  it('renderiza texto formatado com negrito, itálico e código', () => {
    const content = 'Texto com *negrito*, _itálico_ e ```código inline```';
    render(<RichTextViewer content={content} />);

    expect(screen.getByText('negrito')).toHaveClass('font-semibold');
    expect(screen.getByText('itálico')).toHaveClass('italic');
    expect(screen.getByText('código inline')).toHaveClass('font-mono');
  });

  it('renderiza múltiplas linhas preservando quebras', () => {
    const content = 'Primeira linha\nSegunda linha';
    render(<RichTextViewer content={content} />);

    expect(screen.getByText(/Primeira linha/)).toBeInTheDocument();
    expect(screen.getByText(/Segunda linha/)).toBeInTheDocument();
  });
});

