import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { insertToken, VariableButtons } from './variable-insert';

function textarea(value: string, start: number, end = start) {
  const el = document.createElement('textarea');
  el.value = value;
  document.body.appendChild(el);
  el.setSelectionRange(start, end);
  el.scrollTop = 42;
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
  // @ts-expect-error — limpa o stub entre casos
  delete document.execCommand;
});

describe('insertToken', () => {
  it('insere na posição do cursor quando não há execCommand', async () => {
    const el = textarea('<p></p>', 3);
    const onChange = vi.fn();

    insertToken(el, el.value, 'name', onChange);

    expect(onChange).toHaveBeenCalledWith('<p>{{ name }}</p>');
  });

  it('substitui a seleção em vez de duplicar', () => {
    const el = textarea('<p>XX</p>', 3, 5);
    const onChange = vi.fn();

    insertToken(el, el.value, 'name', onChange);

    expect(onChange).toHaveBeenCalledWith('<p>{{ name }}</p>');
  });

  it('prefere execCommand, preservando o undo nativo, e não chama onChange direto', () => {
    const el = textarea('<p></p>', 3);
    const onChange = vi.fn();
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec;

    insertToken(el, el.value, 'name', onChange);

    expect(exec).toHaveBeenCalledWith('insertText', false, '{{ name }}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('restaura o scroll do campo após inserir', () => {
    const el = textarea('<p></p>', 3);
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec;
    el.scrollTop = 42;

    insertToken(el, el.value, 'name', vi.fn());

    expect(el.scrollTop).toBe(42);
  });
});

describe('VariableButtons', () => {
  it('não renderiza nada quando não há variáveis nem reservadas', () => {
    const { container } = render(
      <VariableButtons variables={[]} usedNames={new Set()} onInsert={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza um botão por variável com o token formatado', () => {
    render(
      <VariableButtons
        variables={[{ name: 'first_name' }]}
        usedNames={new Set()}
        onInsert={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '{{first_name}}' })).toBeInTheDocument();
  });

  it('variável já usada: fica destacada; não usada e obrigatória: destrutiva', () => {
    render(
      <VariableButtons
        variables={[{ name: 'used_var' }, { name: 'required_var', required: true }]}
        usedNames={new Set(['used_var'])}
        onInsert={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '{{used_var}}' })).toHaveClass('bg-success', { exact: false });
  });

  it('ao clicar numa variável, chama onInsert com o nome dela', async () => {
    const onInsert = vi.fn();
    render(
      <VariableButtons
        variables={[{ name: 'first_name', title: 'Nome' }]}
        usedNames={new Set()}
        onInsert={onInsert}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '{{first_name}}' }));

    expect(onInsert).toHaveBeenCalledWith('first_name');
  });

  it('mostra o separador quando há variáveis e reservadas, e renderiza as reservadas', async () => {
    const onInsert = vi.fn();
    render(
      <VariableButtons
        variables={[{ name: 'first_name' }]}
        reserved={[{ name: 'reserved_one' }]}
        usedNames={new Set(['reserved_one'])}
        onInsert={onInsert}
      />,
    );

    expect(document.querySelector('[aria-hidden]')).toBeInTheDocument();
    const reservedButton = screen.getByRole('button', { name: '{{reserved_one}}' });
    expect(reservedButton).toBeInTheDocument();

    await userEvent.click(reservedButton);
    expect(onInsert).toHaveBeenCalledWith('reserved_one');
  });

  it('sem variáveis mas com reservadas: não mostra separador', () => {
    render(
      <VariableButtons
        variables={[]}
        reserved={[{ name: 'reserved_one' }]}
        usedNames={new Set()}
        onInsert={vi.fn()}
      />,
    );
    expect(document.querySelector('[aria-hidden]')).not.toBeInTheDocument();
  });
});
