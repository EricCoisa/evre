import { describe, it, expect, vi } from 'vitest';
import { MessagingWebhookService } from './messaging-webhook.service';
import { MessagingService } from './messaging.service';
import { normalizePhone } from 'src/domain/messaging/messaging.const';

function serviceWith(stored: string | null) {
  const systemConfig = {
    findByLabelKey: vi.fn().mockResolvedValue(stored == null ? null : { value: stored }),
    getValueOrNull: vi.fn().mockResolvedValue(stored),
  };
  return new MessagingWebhookService(
    systemConfig as never,
    {} as never,
    { t: (k: string) => k } as never,
  );
}

describe('normalizePhone', () => {
  it('tira +, espaços e pontuação', () => {
    expect(normalizePhone('+55 (11) 99999-8888')).toBe('5511999998888');
  });

  it('tira sufixo de JID do provider', () => {
    expect(normalizePhone('5511999998888@s.whatsapp.net')).toBe('5511999998888');
  });
});

describe('MessagingWebhookService.ignoredPhones', () => {
  it('chave ausente devolve conjunto vazio', async () => {
    expect((await serviceWith(null).ignoredPhones()).size).toBe(0);
  });

  it('normaliza os números gravados', async () => {
    const set = await serviceWith('["+55 11 99999-8888"]').ignoredPhones();
    expect(set.has('5511999998888')).toBe(true);
  });

  it('JSON quebrado não derruba o webhook', async () => {
    expect((await serviceWith('{nao json').ignoredPhones()).size).toBe(0);
  });

  it('valor que não é array é ignorado', async () => {
    expect((await serviceWith('{"a":1}').ignoredPhones()).size).toBe(0);
  });
});

describe('MessagingService.dropIgnored', () => {
  function svc(ignored: string[]) {
    const webhooks = { ignoredPhones: vi.fn().mockResolvedValue(new Set(ignored)) };
    // Só o filtro é exercitado; as outras dependências não são tocadas por ele.
    return Object.create(MessagingService.prototype, {
      webhooks: { value: webhooks },
    }) as { dropIgnored: (e: unknown[]) => Promise<unknown[]> };
  }

  it('descarta MESSAGE de número ignorado', async () => {
    const events = [
      { kind: 'MESSAGE', phone: '+55 11 99999-8888' },
      { kind: 'MESSAGE', phone: '5511777776666' },
    ];
    const kept = await svc(['5511999998888']).dropIgnored(events);
    expect(kept).toHaveLength(1);
  });

  it('evento sem telefone (STATUS) sempre passa', async () => {
    const kept = await svc(['5511999998888']).dropIgnored([{ kind: 'STATUS' }]);
    expect(kept).toHaveLength(1);
  });

  it('lista vazia não filtra nada', async () => {
    const events = [{ kind: 'MESSAGE', phone: '5511999998888' }];
    expect(await svc([]).dropIgnored(events)).toHaveLength(1);
  });
});
