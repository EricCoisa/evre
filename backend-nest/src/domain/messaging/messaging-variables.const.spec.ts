import {
  RESERVED_LIST,
  SENSITIVE_MASK,
  ReservedVariableKey,
  dateNormalizer,
  effectiveVariables,
  reservedAsVariables,
  resolveReserved,
  sensitiveNames,
  type ReservedVariable,
  type VariableContext,
} from './messaging-variables.const';

const ctxWith = (contact: VariableContext['contact']): VariableContext => ({
  contact,
  connection: { phone: null },
  now: new Date(),
});

// Contrato: o que o resto do sistema (Meta, preview, API) lê de cada declaração. Reservada nova
// só vale a pena se passar aqui — é o que mantém "1 entrada na lista" suficiente.
describe('contrato de RESERVED_VARIABLES', () => {
  it.each(RESERVED_LIST.map((v) => [v.name, v] as const))(
    '%s tem tudo o que o sistema consome',
    (_name, v) => {
      expect(v.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(v.labelKey).toBe(`variable.${v.name}`);
      expect(v.example.trim()).not.toBe('');
      expect(v.dummy.trim()).not.toBe('');
      expect(v.fallback.trim()).not.toBe('');
      // O valor normalizado do exemplo não pode mudar: a Meta aprova com ele.
      if (v.normalize) expect(v.normalize(v.example)).toBe(v.example);
    },
  );

  it('toda chave do enum está declarada com o mesmo nome', () => {
    for (const key of Object.values(ReservedVariableKey)) {
      expect(RESERVED_LIST.find((v) => v.name === key)).toBeDefined();
    }
    expect(RESERVED_LIST).toHaveLength(Object.values(ReservedVariableKey).length);
  });
});

describe('resolveReserved', () => {
  it('contato com nome completo: first_name pega a primeira palavra, full_name o nome inteiro', () => {
    const ctx = ctxWith({ name: 'Ana Maria Souza', pushName: 'Aninha', phone: '5511999999999' });
    expect(resolveReserved(ctx)).toEqual({ first_name: 'Ana', full_name: 'Ana Maria Souza' });
  });

  it('contato só com pushName: usa pushName como nome', () => {
    const ctx = ctxWith({ name: null, pushName: 'Aninha', phone: '5511999999999' });
    expect(resolveReserved(ctx)).toEqual({ first_name: 'Aninha', full_name: 'Aninha' });
  });

  it('contato nulo: cai no fallback de cada variável', () => {
    expect(resolveReserved(ctxWith(null))).toEqual({ first_name: 'cliente', full_name: 'cliente' });
  });

  it('nome só com espaços também cai no fallback — vazio não é valor', () => {
    const ctx = ctxWith({ name: '   ', pushName: null, phone: '5511999999999' });
    expect(resolveReserved(ctx)).toEqual({ first_name: 'cliente', full_name: 'cliente' });
  });

  it('valor do chamador (chave + dado bruto) vence o contato e é normalizado pela declaração', () => {
    const ctx = ctxWith({ name: 'Outro Nome', pushName: null, phone: '5511999999999' });
    expect(
      resolveReserved(ctx, undefined, { [ReservedVariableKey.FIRST_NAME]: '  Maria Clara ' }),
    ).toMatchObject({ first_name: 'Maria', full_name: 'Outro Nome' });
  });

  it('só resolve as liberadas e ignora nomes desconhecidos', () => {
    const ctx = ctxWith({ name: 'Ana Souza', pushName: null, phone: '5511999999999' });
    expect(resolveReserved(ctx, ['full_name', 'nope'])).toEqual({ full_name: 'Ana Souza' });
    expect(resolveReserved(ctx, [])).toEqual({});
  });
});

describe('reservedAsVariables / effectiveVariables', () => {
  it('opcional com default = fallback, sempre STRING (valor já sai normalizado)', () => {
    expect(reservedAsVariables(['first_name'])).toEqual([
      { name: 'first_name', type: 'STRING', required: false, default: 'cliente' },
    ]);
    expect(reservedAsVariables([])).toEqual([]);
  });

  it('effectiveVariables junta as custom com só as reservadas marcadas (reserved: true)', () => {
    const result = effectiveVariables([
      { name: 'order_id' },
      { name: 'full_name', reserved: true },
    ]);
    expect(result.map((v) => v.name)).toEqual(['order_id', 'full_name']);
  });
});

// Prova do objetivo: reservada nova = só a declaração. Nenhuma função acima muda.
describe('reservada nova só com a declaração (ex.: data_nasc)', () => {
  const BIRTH: ReservedVariable = {
    name: 'data_nasc' as never,
    type: 'DATE',
    labelKey: 'variable.data_nasc',
    example: '12/05/1990',
    dummy: '12/05/1990',
    fallback: '—',
    onMissing: 'error',
    allowUse: true,
    normalize: dateNormalizer('DD/MM/YYYY'),
  };
  const registry = [...RESERVED_LIST, BIRTH];
  const ctx = ctxWith(null);

  it('o chamador passa a chave e o dado bruto; a declaração formata', () => {
    expect(
      resolveReserved(ctx, ['data_nasc'], { data_nasc: '1990-05-12' } as never, registry),
    ).toEqual({ data_nasc: '12/05/1990' });
  });

  it('onMissing "error": sem o dado o envio é recusado, não vai "—" no texto', () => {
    expect(() => resolveReserved(ctx, ['data_nasc'], {}, registry)).toThrow(/data_nasc/);
  });

  it('data inválida é recusada em vez de mandar "Invalid Date"', () => {
    expect(() =>
      resolveReserved(ctx, ['data_nasc'], { data_nasc: 'abc' } as never, registry),
    ).toThrow(/data inválida/);
  });

  it('exemplo já está no formato final (a Meta aprova com ele)', () => {
    expect(BIRTH.normalize!('1990-05-12')).toBe(BIRTH.example);
  });
});

describe('sensitiveNames', () => {
  it('junta custom sensitive e reservada sensitive liberada', () => {
    const registry: ReservedVariable[] = [
      { ...RESERVED_LIST[0], name: 'pin' as never, sensitive: true },
    ];
    expect(
      sensitiveNames(
        [
          { name: 'code_number', sensitive: true },
          { name: 'order_id' },
          { name: 'pin', reserved: true },
        ],
        registry,
      ),
    ).toEqual(['code_number', 'pin']);
    expect(SENSITIVE_MASK).not.toBe('');
  });
});
