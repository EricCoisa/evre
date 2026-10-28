import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BaseConfiguration } from '@/components/base-configuration';
import i18n from '../../i18n';

/** Os botões são identificados pelo `title`, que é traduzido — não fixe a cópia no teste. */
const title = (key: string) => i18n.t(key, { ns: 'common' });

/** Testa os três modos de salvamento do campo de texto: auto-save, manualSave e secret. */
const base = {
  labelKey: 'SYSTEM_AI_SYSTEM_PROMPT',
  isPending: false,
  disableLabel: true,
};

const field = (overrides: Record<string, unknown> = {}) => ({
  id: 'cfg-1',
  labelKey: 'SYSTEM_AI_SYSTEM_PROMPT',
  valueType: 'STRING',
  value: 'prompt gravado',
  ...overrides,
});

describe('BaseConfiguration — salvamento manual', () => {
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onUpdate = vi.fn().mockResolvedValue(undefined);
  });

  it('digitar não salva sozinho — só o ✓ grava', async () => {
    render(
      <BaseConfiguration
        {...base}
        manualSave
        forceType="textarea"
        data={field()}
        onUpdate={onUpdate}
      />,
    );

    await userEvent.type(screen.getByRole('textbox'), '!');
    expect(onUpdate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTitle(title('confirm')));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('prompt gravado!'));
  });

  it('hidrata o valor gravado (ao contrário do campo secreto)', () => {
    render(
      <BaseConfiguration {...base} manualSave data={field()} onUpdate={onUpdate} />,
    );

    expect(screen.getByRole('textbox')).toHaveValue('prompt gravado');
  });

  it('✗ descarta a edição e volta ao valor gravado', async () => {
    render(
      <BaseConfiguration {...base} manualSave data={field()} onUpdate={onUpdate} />,
    );

    const input = screen.getByRole('textbox');
    await userEvent.type(input, ' editado');
    await userEvent.click(screen.getByTitle(title('cancel')));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(input).toHaveValue('prompt gravado');
  });

  it('os botões só aparecem com edição pendente', async () => {
    render(
      <BaseConfiguration {...base} manualSave data={field()} onUpdate={onUpdate} />,
    );

    expect(screen.queryByTitle(title('confirm'))).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox'), 'x');
    expect(screen.getByTitle(title('confirm'))).toBeInTheDocument();
  });

  it('campo secreto continua mascarado e só envia o que foi digitado', async () => {
    render(
      <BaseConfiguration
        {...base}
        data={field({ secret: true, value: 'valor-cifrado' })}
        onUpdate={onUpdate}
      />,
    );

    // password input não tem role textbox
    const input = document.getElementById('SYSTEM_AI_SYSTEM_PROMPT') as HTMLInputElement;
    expect(input.value).toBe('****');

    await userEvent.click(input);
    await userEvent.type(input, 'nova-chave');
    await userEvent.click(screen.getByTitle(title('confirm')));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('nova-chave'));
  });

  it('sem manualSave, o texto salva sozinho (debounce)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<BaseConfiguration {...base} data={field()} onUpdate={onUpdate} />);

    await userEvent.type(screen.getByRole('textbox'), '!');
    expect(onUpdate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1100);
    expect(onUpdate).toHaveBeenCalledWith('prompt gravado!');
    vi.useRealTimers();
  });
});
