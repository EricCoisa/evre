import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Modal from './modal';

describe('Modal', () => {
  it('fechado: não renderiza conteúdo', () => {
    render(
      <Modal title="Título" open={false} onOpenChange={vi.fn()}>
        <span>conteúdo</span>
      </Modal>
    );
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('aberto: renderiza título e children', () => {
    render(
      <Modal title="Meu Modal" open={true} onOpenChange={vi.fn()}>
        <span>corpo</span>
      </Modal>
    );
    expect(screen.getByText('Meu Modal')).toBeInTheDocument();
    expect(screen.getByText('corpo')).toBeInTheDocument();
  });

  it('aberto com description: renderiza description', () => {
    render(
      <Modal title="T" description="Descrição do modal" open={true} onOpenChange={vi.fn()}>
        <span>x</span>
      </Modal>
    );
    expect(screen.getByText('Descrição do modal')).toBeInTheDocument();
  });

  it('aberto sem description: não renderiza DialogDescription', () => {
    const { container } = render(
      <Modal title="T" open={true} onOpenChange={vi.fn()}>
        <span>x</span>
      </Modal>
    );
    expect(container.querySelector('[data-slot="dialog-description"]')).not.toBeInTheDocument();
  });
});
