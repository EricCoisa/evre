import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MessagingTemplateService } from './messaging-template.service';
import { SENSITIVE_MASK } from 'src/domain/messaging/messaging-variables.const';

const PHONE = '5511999999999';

describe('MessagingTemplateService', () => {
  const prisma = {
    messagingTemplate: { findUnique: vi.fn() },
    messagingContact: { findUnique: vi.fn() },
  };
  const service = new MessagingTemplateService(prisma as never);

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'tpl-1',
    key: 'LOGIN_CODE',
    language: 'pt-BR',
    category: 'AUTHENTICATION',
    body: 'Olá {{ first_name }}, seu código é {{ code_number }}',
    header: null,
    footer: null,
    buttons: null,
    bypassOptOut: true,
    type: {
      variables: [
        { name: 'code_number', type: 'STRING', required: true, sensitive: true },
        { name: 'first_name', type: 'STRING', required: false, reserved: true },
      ],
    },
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.messagingContact.findUnique.mockResolvedValue({ name: 'Ana Souza', pushName: null });
  });

  describe('isUsable', () => {
    it('true quando o template existe e não foi invalidado', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(row({ invalidatedAt: null }));

      await expect(service.isUsable('LOGIN_CODE')).resolves.toBe(true);
      expect(prisma.messagingTemplate.findUnique).toHaveBeenCalledWith({
        where: { key_language: { key: 'LOGIN_CODE', language: 'pt-BR' } },
      });
    });

    it('false quando o template não existe', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(null);

      await expect(service.isUsable('LOGIN_CODE')).resolves.toBe(false);
    });

    it('false quando o template foi invalidado (tipo mudou)', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(
        row({ invalidatedAt: new Date() }),
      );

      await expect(service.isUsable('LOGIN_CODE')).resolves.toBe(false);
    });

    it('aceita idioma explícito', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(row());

      await service.isUsable('LOGIN_CODE', 'en');

      expect(prisma.messagingTemplate.findUnique).toHaveBeenCalledWith({
        where: { key_language: { key: 'LOGIN_CODE', language: 'en' } },
      });
    });
  });

  it('sem templateId e sem key, não consulta o banco e recusa direto', async () => {
    await expect(
      service.resolve({ phone: PHONE } as never),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.messagingTemplate.findUnique).not.toHaveBeenCalled();
  });

  it('acha por key + idioma (padrão pt-BR) — o que outro módulo conhece', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(row());

    const result = await service.resolve({
      key: 'LOGIN_CODE',
      phone: PHONE,
      values: { code_number: '123456' },
    });

    expect(prisma.messagingTemplate.findUnique).toHaveBeenCalledWith({
      where: { key_language: { key: 'LOGIN_CODE', language: 'pt-BR' } },
      include: { type: true },
    });
    expect(result.templateId).toBe('tpl-1');
    expect(result.bypassOptOut).toBe(true);
  });

  it('template inexistente é 404', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(null);
    await expect(service.resolve({ key: 'X', phone: PHONE })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reservada informada pelo chamador (chave + dado bruto) vence o contato', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(row());

    const { resolved } = await service.resolve({
      key: 'LOGIN_CODE',
      phone: PHONE,
      values: { code_number: '123456' },
      reserved: { first_name: 'Maria Clara' },
    });

    expect(resolved.values.first_name).toBe('Maria');
  });

  it('mantém o corpo-fonte com os {{ placeholders }} além do renderizado (provider precisa dos nomes)', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(row());

    const { resolved } = await service.resolve({
      key: 'LOGIN_CODE',
      phone: PHONE,
      values: { code_number: '123456' },
    });

    expect(resolved.bodySource).toMatch(/\{\{\s*code_number\s*\}\}/);
    expect(resolved.body).not.toMatch(/\{\{/);
    expect(resolved.body).toContain('123456');
  });

  it('sem `reserved` (caminho HTTP) o contexto vence o que veio em `values`', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(row());

    const { resolved } = await service.resolve({
      key: 'LOGIN_CODE',
      phone: PHONE,
      values: { code_number: '123456', first_name: 'Forjado' },
    });

    expect(resolved.values.first_name).toBe('Ana');
  });

  it('variável sensitive: texto real no envio, versão mascarada em `redacted`', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(row());

    const { resolved } = await service.resolve({
      key: 'LOGIN_CODE',
      phone: PHONE,
      values: { code_number: '123456' },
    });

    expect(resolved.body).toBe('Olá Ana, seu código é 123456');
    expect(resolved.redacted).toEqual({
      body: `Olá Ana, seu código é ${SENSITIVE_MASK}`,
      values: { code_number: SENSITIVE_MASK, first_name: 'Ana' },
      names: ['code_number'],
    });
  });

  it('allowSensitive: false recusa template com variável sensitive', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(row());
    await expect(
      service.resolve({
        key: 'LOGIN_CODE',
        phone: PHONE,
        values: { code_number: '123456' },
        allowSensitive: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sem sensitive não há `redacted`', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(
      row({
        body: 'Olá {{ first_name }}',
        type: { variables: [{ name: 'first_name', reserved: true }] },
      }),
    );
    const { resolved } = await service.resolve({ key: 'LOGIN_CODE', phone: PHONE });
    expect(resolved.redacted).toBeUndefined();
  });

  // Mesma classe do bug em que `{{ first_name }}` chegava cru ao destinatário.
  it('placeholder sem valor (reservada não liberada no tipo) é 400, nunca texto cru', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(
      row({ type: { variables: [{ name: 'code_number', type: 'STRING', required: true }] } }),
    );
    await expect(
      service.resolve({ key: 'LOGIN_CODE', phone: PHONE, values: { code_number: '1' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('botões tipados do tipo', () => {
    const typed = (over: Record<string, unknown> = {}) =>
      row({
        category: 'UTILITY',
        body: 'Pedido {{ order }}',
        buttons: [
          { kind: 'QUICK_REPLY', label: 'Aceitar', slot: 'accept' },
          { kind: 'URL', label: 'Ver', url: 'https://app.test/o/{{ track }}', slot: 'track' },
          { kind: 'QUICK_REPLY', label: 'Livre' },
        ],
        type: {
          variables: [{ name: 'order', type: 'STRING', required: true }],
          buttons: [
            { key: 'accept', kind: 'QUICK_REPLY' },
            { key: 'track', kind: 'URL', urlBase: 'https://app.test/o/', sensitive: true },
          ],
        },
        ...over,
      });

    it('resposta rápida de espaço sai com payload (chave:dado); botão livre fica sem payload', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(typed());

      const { resolved } = await service.resolve({
        key: 'ORDER',
        phone: PHONE,
        values: { order: '42' },
        buttons: { accept: 'ref1', track: 'tok_9' },
      });

      expect(resolved.buttons).toEqual([
        { kind: 'QUICK_REPLY', label: 'Aceitar', slot: 'accept', payload: 'accept:ref1' },
        { kind: 'URL', label: 'Ver', url: 'https://app.test/o/{{ track }}', slot: 'track' },
        { kind: 'QUICK_REPLY', label: 'Livre' },
      ]);
      expect(resolved.values).toMatchObject({ order: '42', track: 'tok_9' });
    });

    it('sufixo do link `sensitive` é mascarado no histórico (redacted), como variável sensível', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(typed());
      const { resolved } = await service.resolve({
        key: 'ORDER',
        phone: PHONE,
        values: { order: '42' },
        buttons: { track: 'tok_9' },
      });
      expect(resolved.redacted?.names).toEqual(['track']);
      expect(resolved.redacted?.values.track).toBe(SENSITIVE_MASK);
    });

    it('link do sistema sem sufixo é 400; botão desconhecido (typo) é 400', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(typed());
      await expect(
        service.resolve({ key: 'ORDER', phone: PHONE, values: { order: '42' } }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.resolve({ key: 'ORDER', phone: PHONE, values: { order: '42' }, buttons: { track: 'x', acept: '1' } }),
      ).rejects.toThrow(/desconhecido.*acept/);
    });

    it('espaço do tipo que o template não usa não é exigido', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(
        typed({ buttons: [{ kind: 'QUICK_REPLY', label: 'Aceitar', slot: 'accept' }] }),
      );
      const { resolved } = await service.resolve({ key: 'ORDER', phone: PHONE, values: { order: '42' } });
      expect(resolved.buttons?.[0]).toMatchObject({ payload: 'accept' });
    });
  });

  it('header IMAGE: usa headerImageUrl quando fornecido, cai no url do banco quando omitido', async () => {
    const imageRow = row({ header: { kind: 'IMAGE', url: 'https://example.com/example.jpg' } });
    prisma.messagingTemplate.findUnique.mockResolvedValue(imageRow);

    const { resolved: withUrl } = await service.resolve({
      key: 'LOGIN_CODE',
      phone: PHONE,
      values: { code_number: '1' },
      headerImageUrl: 'https://example.com/real.jpg',
    });
    expect(withUrl.header).toEqual({ kind: 'IMAGE', url: 'https://example.com/real.jpg' });

    prisma.messagingTemplate.findUnique.mockResolvedValue(imageRow);
    const { resolved: withoutUrl } = await service.resolve({
      key: 'LOGIN_CODE',
      phone: PHONE,
      values: { code_number: '1' },
    });
    expect(withoutUrl.header).toEqual({ kind: 'IMAGE', url: 'https://example.com/example.jpg' });
  });

  it('template que requer ajuste (tipo mudou) não envia: 400 com o motivo', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(
      row({ invalidatedAt: new Date(), invalidReason: 'variáveis obrigatórias do tipo não usadas no texto: x' }),
    );
    const error = await service
      .resolve({ key: 'LOGIN_CODE', phone: PHONE, values: { code_number: '1' } })
      .catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toContain('requer ajuste');
    expect(error.message).toContain('não usadas no texto: x');
  });
});
