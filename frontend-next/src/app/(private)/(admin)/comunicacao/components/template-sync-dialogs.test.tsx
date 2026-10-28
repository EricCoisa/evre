import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TemplateDeleteDialog, TemplateSyncPrompt, hasActiveSubmission } from './template-sync-dialogs';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'pt-BR' }),
}));

const CONNECTIONS = [{ id: 'c-1', provider: 'META', phone: '5511' }] as never;
const SUBMITTED = { id: 't-1', key: 'pedido', submissions: [{ connectionId: 'c-1' }] } as never;
const LOCAL = { id: 't-2', key: 'rascunho', submissions: [] } as never;

describe('TemplateSyncPrompt', () => {
  it('"Sincronizar agora" entrega o template; "Agora não" só fecha', () => {
    const onSync = vi.fn();
    const onClose = vi.fn();
    render(<TemplateSyncPrompt template={SUBMITTED} onSync={onSync} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'syncNow' }));
    expect(onSync).toHaveBeenCalledWith(SUBMITTED);

    fireEvent.click(screen.getByRole('button', { name: 'syncLater' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('TemplateDeleteDialog', () => {
  const setup = (template: unknown) => {
    const onConfirm = vi.fn();
    render(
      <TemplateDeleteDialog
        template={template as never}
        connections={CONNECTIONS}
        pending={false}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );
    return onConfirm;
  };

  it('template submetido remove também na Meta por padrão', () => {
    const onConfirm = setup(SUBMITTED);
    fireEvent.click(screen.getByRole('button', { name: 'deleteConfirm' }));
    expect(onConfirm).toHaveBeenCalledWith(SUBMITTED, true);
  });

  it('desmarcar a opção apaga só localmente', () => {
    const onConfirm = setup(SUBMITTED);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'deleteConfirm' }));
    expect(onConfirm).toHaveBeenCalledWith(SUBMITTED, false);
  });

  it('template nunca submetido não oferece a opção da Meta', () => {
    const onConfirm = setup(LOCAL);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'deleteConfirm' }));
    expect(onConfirm).toHaveBeenCalledWith(LOCAL, false);
  });

  it('template nunca submetido mostra só o aviso neutro, sem citar provedor', () => {
    setup(LOCAL);
    expect(screen.getByText('deleteTemplateDescription')).toBeInTheDocument();
    expect(screen.queryByText('deleteSubmittedBody')).not.toBeInTheDocument();
  });

  // Provedor trocado: a conexão onde foi submetido foi arquivada, então não há mais o que remover lá.
  it('submissão em conexão arquivada é tratada como nunca submetido', () => {
    const archived = { id: 't-3', key: 'antigo', submissions: [{ connectionId: 'arquivada' }] } as never;
    const onConfirm = setup(archived);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'deleteConfirm' }));
    expect(onConfirm).toHaveBeenCalledWith(archived, false);
  });
});

describe('hasActiveSubmission', () => {
  it('só conta submissão em conexão ativa', () => {
    expect(hasActiveSubmission(SUBMITTED, CONNECTIONS)).toBe(true);
    expect(hasActiveSubmission(SUBMITTED, [])).toBe(false);
    expect(hasActiveSubmission(LOCAL, CONNECTIONS)).toBe(false);
  });
});
