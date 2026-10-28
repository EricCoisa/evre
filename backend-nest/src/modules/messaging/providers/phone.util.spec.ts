import {
  firstPhoneJid,
  normalizePhone,
  phoneFromJid,
  phoneVariants,
} from './phone.util';

describe('normalizePhone', () => {
  it('extrai dígitos do remoteJid do Evolution', () => {
    expect(normalizePhone('5511987654321@s.whatsapp.net')).toBe(
      '5511987654321',
    );
  });

  it('remove o + do wa_id da Meta', () => {
    expect(normalizePhone('+5511987654321')).toBe('5511987654321');
  });

  it('aceita máscara humana', () => {
    expect(normalizePhone('+55 (11) 98765-4321')).toBe('5511987654321');
  });

  // O caso que divide contato e faz opt-out não pegar — ver docs/backend/messaging.md.
  it('insere o 9 em celular BR legado, convergindo com a forma completa', () => {
    expect(normalizePhone('551187654321')).toBe('5511987654321');
    expect(normalizePhone('551187654321')).toBe(
      normalizePhone('5511987654321'),
    );
    expect(normalizePhone('551187654321@s.whatsapp.net')).toBe('5511987654321');
  });

  it('não mexe em fixo BR (DDD + 8 dígitos começando em 2-5)', () => {
    expect(normalizePhone('551133334444')).toBe('551133334444');
  });

  it('não mexe em celular BR que já tem o 9', () => {
    expect(normalizePhone('5511987654321')).toBe('5511987654321');
  });

  it('não mexe em número de outro país', () => {
    expect(normalizePhone('+1 415 555 2671')).toBe('14155552671');
    expect(normalizePhone('351912345678')).toBe('351912345678');
  });

  it('entrada vazia ou nula vira string vazia', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(undefined as unknown as string)).toBe('');
  });
});

describe('phoneVariants', () => {
  it('celular BR devolve a canônica e a legada sem o 9', () => {
    expect(phoneVariants('5534998956461')).toEqual([
      '5534998956461',
      '553498956461',
    ]);
  });

  it('aceita a forma legada na entrada e devolve as duas', () => {
    expect(phoneVariants('553498956461')).toEqual([
      '5534998956461',
      '553498956461',
    ]);
  });

  it('número fora do padrão BR tem uma só forma', () => {
    expect(phoneVariants('+1 415 555 0100')).toEqual(['14155550100']);
    expect(phoneVariants('551133334444')).toEqual(['551133334444']); // fixo: sem 9 por natureza
  });
});

describe('phoneFromJid', () => {
  it('JID de dispositivo perde o :aparelho', () => {
    expect(phoneFromJid('5534998956461:12@s.whatsapp.net')).toBe(
      '5534998956461',
    );
    expect(normalizePhone('5534998956461:12@s.whatsapp.net')).toBe(
      '5534998956461',
    );
  });

  // status@broadcast virava telefone vazio e @lid virava um "telefone" que não é de ninguém.
  it.each([
    'status@broadcast',
    '123456789012345@lid',
    '120363@g.us',
    '1@newsletter',
    '',
    null,
  ])('não é telefone: %s', (jid) => expect(phoneFromJid(jid)).toBeNull());

  it('@lid usa o JID de telefone que o provider manda ao lado', () => {
    expect(firstPhoneJid('999@lid', '5534998956461@s.whatsapp.net')).toBe(
      '5534998956461',
    );
    expect(firstPhoneJid('999@lid', undefined)).toBeNull();
  });
});
