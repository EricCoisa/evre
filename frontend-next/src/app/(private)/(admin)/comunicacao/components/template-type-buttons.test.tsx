import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ButtonSlotsEditor,
  ReservedButtonsPicker,
  hasHandler,
} from './template-type-buttons';
import type { TemplateButtonSlot } from '@/lib/actions/messaging/types';

const t = ((key: string) => key) as never;

function Harness({
  initial = [],
  handlers = [],
  lockedKeys = new Set<string>(),
  onChange,
}: {
  initial?: TemplateButtonSlot[];
  handlers?: { type?: string | null; button: string }[];
  lockedKeys?: Set<string>;
  onChange?: (value: TemplateButtonSlot[]) => void;
}) {
  const form = useForm({ defaultValues: { key: 'ORDER' } });
  const [value, setValue] = useState(initial);
  return (
    <FormProvider {...form}>
      <ButtonSlotsEditor
        t={t}
        value={value}
        handlers={handlers}
        lockedKeys={lockedKeys}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
    </FormProvider>
  );
}

describe('hasHandler', () => {
  it('handler sem tipo vale para qualquer tipo; com tipo, só para o dele', () => {
    const handlers = [{ type: null, button: 'opt_out' }, { type: 'ORDER', button: 'details' }];
    expect(hasHandler(handlers, 'QUALQUER', 'opt_out')).toBe(true);
    expect(hasHandler(handlers, 'ORDER', 'details')).toBe(true);
    expect(hasHandler(handlers, 'OUTRO', 'details')).toBe(false);
  });
});

describe('ButtonSlotsEditor (tela do dev)', () => {
  it('adiciona resposta rápida e link do sistema, com URL base só no link', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /buttonSlotAddQuick/ }));
    fireEvent.click(screen.getByRole('button', { name: /buttonSlotAddUrl/ }));

    expect(onChange.mock.calls.at(-1)?.[0]).toEqual([
      { key: '', kind: 'QUICK_REPLY', required: true },
      { key: '', kind: 'URL', required: true, urlBase: '' },
    ]);
    expect(screen.getAllByPlaceholderText(/exemplo.com/)).toHaveLength(1);
  });

  it('mostra se há handler em código para a chave (tipo do formulário + chave)', () => {
    render(
      <Harness
        initial={[
          { key: 'details', kind: 'QUICK_REPLY', required: true },
          { key: 'later', kind: 'QUICK_REPLY', required: true },
        ]}
        handlers={[{ type: 'ORDER', button: 'details' }]}
      />,
    );
    expect(screen.getByText('buttonHandlerYes')).toBeInTheDocument();
    expect(screen.getByText('buttonHandlerNo')).toBeInTheDocument();
    expect(screen.getByText('buttonHandlerHint')).toBeInTheDocument();
  });

  it('chave que já existia fica travada (renomear = remover, e o servidor recusa se em uso)', () => {
    render(
      <Harness
        initial={[{ key: 'details', kind: 'QUICK_REPLY', required: true }]}
        lockedKeys={new Set(['details'])}
      />,
    );
    expect(screen.getByDisplayValue('details')).toBeDisabled();
  });
});

describe('ReservedButtonsPicker', () => {
  const reserved = [
    { key: 'opt_out', kind: 'QUICK_REPLY', labelKey: 'button.opt_out', defaultLabel: 'Parar', allowUse: true },
  ] as never;

  it('marca e desmarca reservados', () => {
    const onChange = vi.fn();
    render(<ReservedButtonsPicker t={t} reserved={reserved} value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(['opt_out']);
  });

  it('em "criar" o FormBuilder entrega string vazia: não quebra', () => {
    render(<ReservedButtonsPicker t={t} reserved={reserved} value={'' as never} onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});
