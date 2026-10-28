import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { BaseConfiguration } from './base-configuration';

const mocks = vi.hoisted(() => ({
  userRole: null as string | null,
}));

vi.mock('@/lib/actions/auth/queries', () => ({
  useMe: () => ({
    data: mocks.userRole ? { role: mocks.userRole } : null,
    isLoading: false,
    error: null,
  }),
}));

const translations: Record<string, string> = {
  SYSTEMCONFIG_THEME: 'Tema do Sistema',
  light: 'Claro',
  dark: 'Escuro',
  CUSTOM_FIELD_SPECIAL: 'Opção Especial Customizada',
  SYSTEM_LOG_MIN_LEVEL: 'Nível mínimo de log',
  SYSTEM_LOG_MIN_LEVEL_DEBUG: 'Depuração (DEBUG)',
  DEBUG: 'Depuração (DEBUG)',
  INFO: 'Informativo (INFO)',
  WARN: 'Aviso (WARN)',
};

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (k: string) => translations[k] ?? k,
  }),
}));

describe('BaseConfiguration — separação de Loading vs Alerta/Dependência', () => {
  beforeEach(() => {
    mocks.userRole = null;
  });

  const baseBooleanData = {
    id: 'cfg-1',
    labelKey: 'SYSTEM_NOTIFICATION_EMAIL_ENABLED',
    valueType: 'BOOLEAN',
    value: 'true',
  };

  it('estado normal: renderiza o switch habilitado sem loader e sem ícone de alerta', () => {
    const { container } = render(
      <BaseConfiguration
        labelKey={baseBooleanData.labelKey}
        data={baseBooleanData}
        isPending={false}
        disabled={false}
        onUpdate={vi.fn()}
      />
    );

    const switchControl = screen.getByRole('switch');
    expect(switchControl).not.toBeDisabled();
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
    expect(container.querySelector('.text-amber-500')).not.toBeInTheDocument();
  });

  it('estado de carregamento/salvamento (isPending: true): renderiza spinner de loading e não renderiza triângulo de alerta', () => {
    const { container } = render(
      <BaseConfiguration
        labelKey={baseBooleanData.labelKey}
        data={baseBooleanData}
        isPending={true}
        disabled={false}
        onUpdate={vi.fn()}
      />
    );

    const switchControl = screen.getByRole('switch');
    expect(switchControl).toBeDisabled();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(container.querySelector('.text-amber-500')).not.toBeInTheDocument();
  });

  it('estado de dependência/saúde inoperante (disabled: true, warning: true): renderiza triângulo de alerta e NÃO renderiza spinner de loading', () => {
    const { container } = render(
      <BaseConfiguration
        labelKey={baseBooleanData.labelKey}
        data={baseBooleanData}
        isPending={false}
        disabled={true}
        warning={true}
        onUpdate={vi.fn()}
      />
    );

    const switchControl = screen.getByRole('switch');
    expect(switchControl).toBeDisabled();
    // NÃO deve mostrar spinner de loading eterno
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
    // DEVE mostrar o ícone de aviso/alerta triangular
    expect(container.querySelector('.text-amber-500')).toBeInTheDocument();
  });

  it('configuração bloqueada pelo sistema (blocked: true): renderiza triângulo de aviso e switch desabilitado sem loader', () => {
    const blockedData = {
      ...baseBooleanData,
      blocked: true,
    };

    const { container } = render(
      <BaseConfiguration
        labelKey={blockedData.labelKey}
        data={blockedData}
        isPending={false}
        onUpdate={vi.fn()}
      />
    );

    const switchControl = screen.getByRole('switch');
    expect(switchControl).toBeDisabled();
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
    expect(container.querySelector('.text-amber-500')).toBeInTheDocument();
  });

  it('usuário sem permissão de configuração (role: USER): NÃO deve mostrar o warn mesmo quando disabled ou warning: true', () => {
    mocks.userRole = 'USER';

    const { container } = render(
      <BaseConfiguration
        labelKey={baseBooleanData.labelKey}
        data={baseBooleanData}
        isPending={false}
        disabled={true}
        warning={true}
        onUpdate={vi.fn()}
      />
    );

    const switchControl = screen.getByRole('switch');
    expect(switchControl).toBeDisabled();
    // NÃO deve mostrar ícone de alerta para usuário que não tem acesso a configurar
    expect(container.querySelector('.text-amber-500')).not.toBeInTheDocument();
  });

  it('usuário administrador (role: ADMIN): DEVE mostrar o warn quando houver dependência ou warning', () => {
    mocks.userRole = 'ADMIN';

    const { container } = render(
      <BaseConfiguration
        labelKey={baseBooleanData.labelKey}
        data={baseBooleanData}
        isPending={false}
        disabled={true}
        warning={true}
        onUpdate={vi.fn()}
      />
    );

    const switchControl = screen.getByRole('switch');
    expect(switchControl).toBeDisabled();
    // DEVE mostrar o ícone de alerta para o admin
    expect(container.querySelector('.text-amber-500')).toBeInTheDocument();
  });
});

describe('BaseConfiguration — EnumConfigField com tradução agnóstica em camadas', () => {
  it('renderiza o valor traduzido usando a chave genérica (ex: light -> Claro)', () => {
    const enumData = {
      id: 'cfg-enum-1',
      labelKey: 'SYSTEMCONFIG_THEME',
      valueType: 'ENUM',
      value: 'light',
      options: ['light', 'dark', 'system'],
    };

    render(
      <BaseConfiguration
        labelKey={enumData.labelKey}
        data={enumData}
        isPending={false}
        onUpdate={vi.fn()}
      />
    );

    // O trigger do Select exibe o valor da opção selecionada traduzida para "Claro"
    expect(screen.getByText('Claro')).toBeInTheDocument();
  });

  it('renderiza fallback caso não haja tradução nem específica nem genérica', () => {
    const enumData = {
      id: 'cfg-enum-2',
      labelKey: 'OTHER_CONFIG',
      valueType: 'ENUM',
      value: 'UNKNOWN_VAL',
      options: ['UNKNOWN_VAL'],
    };

    render(
      <BaseConfiguration
        labelKey={enumData.labelKey}
        data={enumData}
        isPending={false}
        onUpdate={vi.fn()}
      />
    );

    // Fallback: renderiza a string original crua
    expect(screen.getByText('UNKNOWN_VAL')).toBeInTheDocument();
  });

  it('prioriza chave específica sobre genérica quando ambas existem', () => {
    const enumData = {
      id: 'cfg-enum-3',
      labelKey: 'CUSTOM_FIELD',
      valueType: 'ENUM',
      value: 'SPECIAL',
      options: ['SPECIAL'],
    };

    render(
      <BaseConfiguration
        labelKey={enumData.labelKey}
        data={enumData}
        isPending={false}
        onUpdate={vi.fn()}
      />
    );

    // CUSTOM_FIELD_SPECIAL está no mock como 'Opção Especial Customizada'
    expect(screen.getByText('Opção Especial Customizada')).toBeInTheDocument();
  });

  it('renderiza nível mínimo de log traduzido (DEBUG -> Depuração (DEBUG))', () => {
    const enumData = {
      id: 'cfg-log-level',
      labelKey: 'SYSTEM_LOG_MIN_LEVEL',
      valueType: 'ENUM',
      value: 'DEBUG',
      options: ['DEBUG', 'INFO', 'WARN'],
    };

    render(
      <BaseConfiguration
        labelKey={enumData.labelKey}
        data={enumData}
        isPending={false}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Depuração (DEBUG)')).toBeInTheDocument();
  });

  it('resolveOptionLabel: cai no fallback de chave minúscula quando a tradução genérica exata não existe', () => {
    const enumData = {
      id: 'cfg-enum-lower',
      labelKey: 'THEME_PICKER',
      valueType: 'ENUM',
      value: 'Light',
      options: ['Light'],
    };

    render(
      <BaseConfiguration
        labelKey={enumData.labelKey}
        data={enumData}
        isPending={false}
        onUpdate={vi.fn()}
      />
    );

    // 'THEME_PICKER_Light' não traduz, 'Light' não traduz, mas 'light' (lowercase) -> 'Claro'
    expect(screen.getByText('Claro')).toBeInTheDocument();
  });
});

describe('BaseConfiguration — data ausente', () => {
  it('renderiza mensagem de not_found quando data é null', () => {
    render(
      <BaseConfiguration labelKey="SOME_KEY" data={null} isPending={false} onUpdate={vi.fn()} />
    );

    expect(screen.getByText('not_found the_key SOME_KEY')).toBeInTheDocument();
  });

  it('renderiza mensagem de not_found quando data é undefined', () => {
    render(
      <BaseConfiguration labelKey="OTHER_KEY" data={undefined} isPending={false} onUpdate={vi.fn()} />
    );

    expect(screen.getByText('not_found the_key OTHER_KEY')).toBeInTheDocument();
  });
});

describe('BaseConfiguration — DateConfigField (time / date / datetime-local)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('valor em formato HH:mm:ss: renderiza input type=time e aciona debounced update', async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const data = { id: 'cfg-time', labelKey: 'TIME_FIELD', valueType: 'DATE', value: '10:30:00' };

    const { container } = render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} onUpdate={onUpdate} />
    );

    const input = container.querySelector('input[type="time"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('10:30:00');

    fireEvent.change(input, { target: { value: '11:45:00' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(onUpdate).toHaveBeenCalledWith('11:45:00');
  });

  it('valor em formato yyyy-MM-dd: renderiza o DatePicker com a data formatada', () => {
    const data = { id: 'cfg-date', labelKey: 'DATE_FIELD', valueType: 'DATE', value: '2024-03-15' };

    render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} onUpdate={vi.fn()} />
    );

    const trigger = screen.getByRole('button');
    expect(trigger.textContent).toContain('2024');
  });

  it('valor que não casa nenhum padrão: renderiza input datetime-local e aciona debounced update', async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const data = { id: 'cfg-dt', labelKey: 'DT_FIELD', valueType: 'DATE', value: '2024-03-15T10:30' };

    const { container } = render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} onUpdate={onUpdate} />
    );

    const input = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '2024-03-16T12:00' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(onUpdate).toHaveBeenCalledWith('2024-03-16T12:00');
  });
});

describe('BaseConfiguration — BooleanConfigField variações de forceType', () => {
  it('forceType=button: clicar chama onUpdate com o valor negado', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const data = { id: 'cfg-bool-btn', labelKey: 'BOOL_BTN', valueType: 'BOOLEAN', value: 'true' };

    render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} forceType="button" onUpdate={onUpdate} />
    );

    await user.click(screen.getByRole('button'));
    expect(onUpdate).toHaveBeenCalledWith('false');
  });

  it('BUG conhecido (base-configuration.tsx:344): com value="false" (string), o clique NÃO alterna para "true" — String(!"false") é "false" pois string não-vazia é truthy em JS', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const data = { id: 'cfg-bool-btn-2', labelKey: 'BOOL_BTN_2', valueType: 'BOOLEAN', value: 'false' };

    render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} forceType="button" onUpdate={onUpdate} />
    );

    await user.click(screen.getByRole('button'));
    // Comportamento atual (não corrigido): deveria alternar para 'true', mas permanece 'false'.
    expect(onUpdate).toHaveBeenCalledWith('false');
  });

  it('forceType=checkbox: renderiza Checkbox e alterna ao clicar', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const data = { id: 'cfg-bool-chk', labelKey: 'BOOL_CHK', valueType: 'BOOLEAN', value: 'false' };

    render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} forceType="checkbox" onUpdate={onUpdate} />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith('true');
  });

  it('BooleanToggleField com disableLabel=true: omite o <label> e usa o layout inline alternativo', () => {
    const data = { id: 'cfg-bool-dl', labelKey: 'BOOL_DL', valueType: 'BOOLEAN', value: 'true' };

    const { container } = render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} disableLabel onUpdate={vi.fn()} />
    );

    expect(container.querySelector('label')).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });
});

describe('BaseConfiguration — NumberConfigField', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renderiza input numérico e aciona debounced update', async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const data = { id: 'cfg-num', labelKey: 'NUM_FIELD', valueType: 'NUMBER', value: 10 };

    const { container } = render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} onUpdate={onUpdate} />
    );

    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input.value).toBe('10');

    fireEvent.change(input, { target: { value: '42' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(onUpdate).toHaveBeenCalledWith('42');
  });
});

describe('BaseConfiguration — StringConfigField (default / textarea / status de salvamento)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fluxo de debounce bem-sucedido: aciona onUpdate uma vez após 1s e volta a idle após o flash de sucesso', async () => {
    // Nota: a cor da borda usa var(--warning)/var(--success)/var(--destructive) via inline style;
    // jsdom (cssstyle) rejeita silenciosamente valores var() em propriedades de cor
    // (style.border/backgroundColor/borderColor com var() resulta em getAttribute('style') === null),
    // então o estado visual não é observável aqui — cobrimos o comportamento (chamadas/timers) em vez disso.
    vi.useFakeTimers();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const data = { id: 'cfg-str-1', labelKey: 'FIELD_NAME', valueType: 'STRING', value: 'old' };

    const { container } = render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} onUpdate={onUpdate} />
    );

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'new value' } });
    expect(onUpdate).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('new value');

    // Flash de sucesso (1s) expira e volta a idle sem novas chamadas a onUpdate.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('fluxo de debounce com erro: onUpdate rejeita e o componente trata o erro sem lançar', async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn().mockRejectedValue(new Error('fail'));
    const data = { id: 'cfg-str-2', labelKey: 'FIELD_NAME_2', valueType: 'STRING', value: 'old' };

    const { container } = render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} onUpdate={onUpdate} />
    );

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'broken' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onUpdate).toHaveBeenCalledWith('broken');

    // Flash de erro (1s) expira e volta a idle sem novas chamadas a onUpdate.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('forceType=textarea (sem manualSave): renderiza Textarea sem botões confirmar/cancelar', async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const data = { id: 'cfg-ta', labelKey: 'TA_FIELD', valueType: 'STRING', value: 'texto inicial' };

    const { container } = render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} forceType="textarea" onUpdate={onUpdate} />
    );

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('texto inicial');
    expect(screen.queryByTitle('confirm')).not.toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'texto novo' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(onUpdate).toHaveBeenCalledWith('texto novo');
  });
});

describe('BaseConfiguration — StringConfigField com manualSave (confirmar/cancelar explícito)', () => {
  it('manualSave input: digitar habilita confirmar, confirmar dispara onUpdate e sai do modo edição', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const data = { id: 'cfg-ms', labelKey: 'MS_FIELD', valueType: 'STRING', value: 'valor' };

    const { container } = render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} manualSave onUpdate={onUpdate} />
    );

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(screen.queryByTitle('confirm')).not.toBeInTheDocument();

    await user.type(input, 'X');
    expect(screen.getByTitle('confirm')).toBeEnabled();

    await user.click(screen.getByTitle('confirm'));
    expect(onUpdate).toHaveBeenCalledWith('valorX');
    expect(screen.queryByTitle('confirm')).not.toBeInTheDocument();
  });

  it('manualSave input: rascunho vazio desabilita confirmar; cancelar descarta sem chamar onUpdate', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const data = { id: 'cfg-ms-2', labelKey: 'MS_FIELD_2', valueType: 'STRING', value: 'abc' };

    const { container } = render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} manualSave onUpdate={onUpdate} />
    );

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    await user.clear(input);
    expect(screen.getByTitle('confirm')).toBeDisabled();

    await user.click(screen.getByTitle('cancel'));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByTitle('cancel')).not.toBeInTheDocument();
  });

  it('manualSave + forceType=textarea: usa Textarea com botões confirmar/cancelar ao lado', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const data = { id: 'cfg-ms-ta', labelKey: 'MS_TA_FIELD', valueType: 'STRING', value: 'abc' };

    const { container } = render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} manualSave forceType="textarea" onUpdate={onUpdate} />
    );

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await user.type(textarea, 'd');
    expect(screen.getByTitle('confirm')).toBeInTheDocument();

    await user.click(screen.getByTitle('confirm'));
    expect(onUpdate).toHaveBeenCalledWith('abcd');
  });
});

describe('BaseConfiguration — StringConfigField secret (mostrar/ocultar, confirmar/cancelar)', () => {
  it('inicia mascarado; foco entra em edição; alternar olho mostra texto plano; confirmar salva e volta a mascarar', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const data = { id: 'cfg-secret', labelKey: 'SECRET_FIELD', valueType: 'STRING', value: 'shh', secret: true };

    const { container } = render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} onUpdate={onUpdate} />
    );

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.value).toBe('****');
    expect(screen.queryByTitle('confirm')).not.toBeInTheDocument();

    await user.click(input);
    expect(input.value).toBe('');
    expect(screen.getByTitle('confirm')).toBeDisabled();

    await user.type(input, 'newsecret');
    expect(input.type).toBe('password');
    expect(screen.getByTitle('confirm')).toBeEnabled();

    await user.click(screen.getByTitle('show'));
    expect(input.type).toBe('text');
    expect(input.value).toBe('newsecret');

    await user.click(screen.getByTitle('confirm'));
    expect(onUpdate).toHaveBeenCalledWith('newsecret');
    expect(input.type).toBe('password');
    expect(input.value).toBe('****');
  });

  it('cancelar descarta o rascunho sem chamar onUpdate e volta a mascarar', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const data = { id: 'cfg-secret-2', labelKey: 'SECRET_FIELD_2', valueType: 'STRING', value: 'shh', secret: true };

    const { container } = render(
      <BaseConfiguration labelKey={data.labelKey} data={data} isPending={false} onUpdate={onUpdate} />
    );

    const input = container.querySelector('input') as HTMLInputElement;
    await user.click(input);
    await user.type(input, 'draft-value');
    await user.click(screen.getByTitle('cancel'));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(input.value).toBe('****');
  });
});


