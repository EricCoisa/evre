import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhoneInput, isValidPhone } from './phone-input';

describe('PhoneInput', () => {
  it('emite E.164 com o DDI do país selecionado', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} defaultCountry="BR" />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '11999998888' } });

    expect(onChange).toHaveBeenCalledWith('+5511999998888');
  });

  it('formata o número já existente em vez de mostrar E.164 cru', () => {
    render(<PhoneInput value="+5511999998888" onChange={vi.fn()} />);

    expect((screen.getByRole('textbox') as HTMLInputElement).value).not.toBe('+5511999998888');
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('11');
  });

  it('deriva o país a partir do valor, ignorando o default', () => {
    render(<PhoneInput value="+14155552671" onChange={vi.fn()} defaultCountry="BR" />);

    expect(screen.getByLabelText('country').textContent).toContain('+1');
  });

  it('campo vazio emite string vazia, não só o DDI', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="+5511999998888" onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('PhoneInput — número incompleto', () => {
  it('mostra o que foi digitado antes de o número ficar válido', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} defaultCountry="BR" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '11' } });

    expect(input.value).not.toBe('');
    expect(input.value).toContain('11');
  });

  it('dígito a dígito o campo nunca esvazia', () => {
    function Wrapper() {
      const [v, setV] = useState('');
      return <PhoneInput value={v} onChange={setV} defaultCountry="BR" />;
    }
    render(<Wrapper />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    for (const digits of ['1', '11', '119', '1199']) {
      fireEvent.change(input, { target: { value: digits } });
      expect(input.value).not.toBe('');
    }
  });
});

describe('isValidPhone', () => {
  it('aceita número válido', () => {
    expect(isValidPhone('+5511999998888')).toBe(true);
  });

  it('recusa número curto demais para o país', () => {
    expect(isValidPhone('+5511')).toBe(false);
  });

  it('recusa vazio', () => {
    expect(isValidPhone('')).toBe(false);
  });
});
