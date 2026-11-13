import { MetaProvider, fromMetaLanguage, sanitizeParameter, toMetaLanguage } from './meta.provider';
import type { MetaConfig } from './meta.provider';

const cfg: MetaConfig = {
  phoneNumberId: '123456789',
  accessToken: 'EAAJB-token',
  graphVersion: 'v21.0',
  wabaId: 'waba-1',
};

function mockFetch(
  ...responses: Array<{ ok?: boolean; status?: number; body?: unknown }>
) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok ?? true,
      status: r.status ?? 200,
      statusText: 'STATUS',
      json: () => Promise.resolve(r.body ?? null),
    });
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('MetaProvider', () => {
  let provider: MetaProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    provider = new MetaProvider();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('configSchema', () => {
    it('phoneNumberId não numérico reprova sem tocar na rede', () => {
      const fetchSpy = mockFetch();
      const parsed = provider.configSchema.safeParse({
        ...cfg,
        phoneNumberId: 'abc',
      });
      expect(parsed.success).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    // O erro de digitação que viraria 404 do Graph sem essa checagem.
    it("graphVersion sem o 'v' reprova, apontando o campo", () => {
      const parsed = provider.configSchema.safeParse({
        ...cfg,
        graphVersion: '21.0',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].path).toEqual(['graphVersion']);
      }
    });

    it('graphVersion ausente cai no default v21.0', () => {
      const parsed = provider.configSchema.safeParse({
        phoneNumberId: '123',
        accessToken: 'tok',
        wabaId: 'waba-1',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.graphVersion).toBe('v21.0');
    });
  });

  describe('send', () => {
    it('monta a rota do Graph e o envelope messaging_product', async () => {
      const fetchSpy = mockFetch({ body: { messages: [{ id: 'wamid.ABC' }] } });

      const result = await provider
        .use(cfg)
        .send({ type: 'TEXT', phone: '+55 (11) 98765-4321', text: 'oi' });

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://graph.facebook.com/v21.0/123456789/messages');
      expect((init.headers as Record<string, string>).Authorization).toBe(
        'Bearer EAAJB-token',
      );
      expect(JSON.parse(init.body as string)).toEqual({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '5511987654321',
        type: 'text',
        text: { body: 'oi' },
      });
      expect(result.providerMessageId).toBe('wamid.ABC');
    });

    it('respeita graphVersion configurada', async () => {
      const fetchSpy = mockFetch({ body: { messages: [{ id: 'wamid.X' }] } });
      await provider
        .use({ ...cfg, graphVersion: 'v19.0' })
        .send({ type: 'TEXT', phone: '5511999999999', text: 'x' });
      expect(fetchSpy.mock.calls[0][0]).toContain('/v19.0/');
    });

    it('erro do Graph vira exceção com message e code', async () => {
      mockFetch({
        ok: false,
        status: 401,
        body: { error: { message: 'Invalid OAuth access token', code: 190 } },
      });
      await expect(
        provider
          .use(cfg)
          .send({ type: 'TEXT', phone: '5511999999999', text: 'x' }),
      ).rejects.toThrow(/Invalid OAuth access token \(code 190\)/);
    });

    it('erro do Graph inclui subcode e o motivo legível (error_user_*)', async () => {
      mockFetch({
        ok: false,
        status: 400,
        body: {
          error: {
            message: 'Invalid parameter',
            code: 100,
            error_subcode: 2388043,
            error_user_title: 'Exemplo inválido',
            error_user_msg: 'O exemplo do parâmetro está vazio.',
          },
        },
      });
      await expect(
        provider
          .use(cfg)
          .send({ type: 'TEXT', phone: '5511999999999', text: 'x' }),
      ).rejects.toThrow(
        /Invalid parameter \(code 100\/2388043\): Exemplo inválido — O exemplo do parâmetro está vazio\./,
      );
    });

    it('erro do Graph inclui error_data.details (onde a Meta aponta o parâmetro inválido)', async () => {
      mockFetch({
        ok: false,
        status: 400,
        body: {
          error: {
            message: '(#100) Invalid parameter',
            code: 100,
            error_data: { messaging_product: 'whatsapp', details: 'Button at index 0 of type Url requires a parameter' },
          },
        },
      });
      await expect(
        provider.use(cfg).send({ type: 'TEXT', phone: '5511999999999', text: 'x' }),
      ).rejects.toThrow(/\(#100\) Invalid parameter \(code 100\): Button at index 0 of type Url requires a parameter/);
    });

    it('falha em template anexa o formato enviado, sem os valores', async () => {
      mockFetch({
        ok: false,
        status: 400,
        body: { error: { message: '(#100) Invalid parameter', code: 100 } },
      });
      const error = (await provider
        .use(cfg)
        .send({
          type: 'TEMPLATE',
          phone: '5511999999999',
          template: {
            name: 'auth',
            language: 'pt-BR',
            category: 'AUTHENTICATION',
            values: { code: '987654' },
            body: 'Seu código: {{ code }}',
          },
        })
        .catch((e: Error) => e)) as Error;

      expect(error.message).toContain('Invalid parameter');
      expect(error.message).toContain('[enviado: auth pt_BR body[text] button(url#0)[text]]');
      expect(error.message).not.toContain('987654');
    });

    it('200 sem messages[0].id é falha', async () => {
      mockFetch({ body: { messages: [] } });
      await expect(
        provider
          .use(cfg)
          .send({ type: 'TEXT', phone: '5511999999999', text: 'x' }),
      ).rejects.toThrow(/sem devolver messages\[0\]\.id/);
    });

    // TEMPLATE e mídia são suportados (send-media.spec.ts); o guard cobre o resto.
    it('tipo desconhecido lança UnsupportedMessageTypeError sem tocar na rede', async () => {
      const fetchSpy = mockFetch();
      await expect(
        provider
          .use(cfg)
          .send({ type: 'STICKER', phone: '5511999999999' } as never),
      ).rejects.toThrow(/META não suporta mensagem do tipo STICKER/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('validateConfiguration', () => {
    it('sonda o par token × número e devolve a identificação', async () => {
      const fetchSpy = mockFetch({
        body: {
          verified_name: 'Minha Empresa',
          display_phone_number: '+55 11 98765-4321',
        },
      });
      const res = await provider.use(cfg).validateConfiguration();

      expect(fetchSpy.mock.calls[0][0]).toBe(
        'https://graph.facebook.com/v21.0/123456789?fields=verified_name,display_phone_number',
      );
      expect(res.status).toBe(true);
      expect(res.data).toBe('Minha Empresa · +55 11 98765-4321');
    });

    it('token de outra conta reprova com a mensagem da Meta', async () => {
      mockFetch({
        ok: false,
        status: 400,
        body: { error: { message: 'Unsupported get request', code: 100 } },
      });
      const res = await provider.use(cfg).validateConfiguration();
      expect(res).toEqual({
        status: false,
        data: 'Unsupported get request (code 100)',
      });
    });

    it('rede fora do ar vira ProviderResult falso, não exceção', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ETIMEDOUT')));
      const res = await provider.use(cfg).validateConfiguration();
      expect(res).toEqual({ status: false, data: 'ETIMEDOUT' });
    });
  });

  describe('toMetaLanguage / fromMetaLanguage', () => {
    it('BCP 47 (hífen) → POSIX (underscore) e volta, nos dois sentidos', () => {
      expect(toMetaLanguage('pt-BR')).toBe('pt_BR');
      expect(toMetaLanguage('en')).toBe('en');
      expect(fromMetaLanguage('pt_BR')).toBe('pt-BR');
      expect(fromMetaLanguage('en')).toBe('en');
    });
  });

  describe('submitTemplate (criação/edição na WABA)', () => {
    const definition = {
      name: 'password_changed',
      language: 'pt-BR',
      category: 'UTILITY' as const,
      body: 'Olá {{ first_name }}',
      examples: { first_name: 'Ana' },
    };

    it('cria (sem providerTemplateId) em POST /{waba-id}/message_templates, parameter_format NAMED', async () => {
      const f = mockFetch({ body: { id: 'wa-new' } });
      const res = await provider.use(cfg).submitTemplate!(definition);

      expect(f.mock.calls[0][0]).toBe(
        'https://graph.facebook.com/v21.0/waba-1/message_templates',
      );
      const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
      expect(body).toMatchObject({
        name: 'password_changed',
        language: 'pt_BR',
        category: 'UTILITY',
        parameter_format: 'NAMED',
      });
      expect(body.components[0]).toMatchObject({
        type: 'BODY',
        text: 'Olá {{first_name}}',
        example: {
          body_text_named_params: [{ param_name: 'first_name', example: 'Ana' }],
        },
      });
      expect(res).toEqual({ providerTemplateId: 'wa-new' });
    });

    it('edita (com providerTemplateId) em POST /{template-id}, e devolve o mesmo id', async () => {
      const f = mockFetch({ body: {} });
      const res = await provider.use(cfg).submitTemplate!(definition, 'wa-old');

      expect(f.mock.calls[0][0]).toBe(
        'https://graph.facebook.com/v21.0/wa-old',
      );
      expect(res).toEqual({ providerTemplateId: 'wa-old' });
    });

    it('AUTHENTICATION ignora body/header/footer nossos — corpo fixo da Meta', async () => {
      const f = mockFetch({ body: { id: 'wa-auth' } });
      await provider.use(cfg).submitTemplate!({
        ...definition,
        category: 'AUTHENTICATION',
        body: 'texto que a Meta vai ignorar',
      });

      const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
      expect(body.components).toEqual([
        { type: 'BODY', add_security_recommendation: true },
        { type: 'FOOTER', code_expiration_minutes: 10 },
        { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE' }] },
      ]);
    });

    it('URL button: placeholder named → {{1}} no payload enviado à Meta', async () => {
      const f = mockFetch({ body: { id: 'wa-url' } });
      await provider.use(cfg).submitTemplate!({
        name: 'proposal_link',
        language: 'pt-BR',
        category: 'UTILITY',
        body: 'Acesse',
        buttons: [{ kind: 'URL', label: 'Abrir', url: 'https://app.example.com/p/{{open}}' }],
        examples: { open: 'abc123' },
      });

      const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
      const btns = body.components.find((c: { type: string }) => c.type === 'BUTTONS');
      expect(btns?.buttons[0]?.url).toBe('https://app.example.com/p/{{1}}');
      expect(btns?.buttons[0]?.example).toEqual(['abc123']);
    });

    it('URL button estático (sem placeholder) não inclui example', async () => {
      const f = mockFetch({ body: { id: 'wa-static' } });
      await provider.use(cfg).submitTemplate!({
        name: 'static_link',
        language: 'pt-BR',
        category: 'UTILITY',
        body: 'Acesse',
        buttons: [{ kind: 'URL', label: 'Abrir', url: 'https://app.example.com' }],
        examples: {},
      });

      const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
      const btns = body.components.find((c: { type: string }) => c.type === 'BUTTONS');
      expect(btns?.buttons[0]?.url).toBe('https://app.example.com');
      expect(btns?.buttons[0]?.example).toBeUndefined();
    });
  });

  describe('send — template com botão URL dinâmico', () => {
    it('envia parâmetro do botão URL como { type: text, text } sem parameter_name', async () => {
      const f = mockFetch({ body: { messages: [{ id: 'wamid.URL' }] } });
      await provider.use(cfg).send({
        type: 'TEMPLATE',
        phone: '5511999999999',
        template: {
          name: 'proposal_link',
          language: 'pt-BR',
          category: 'UTILITY',
          values: { open: 'abc123' },
          body: 'Acesse',
          buttons: [{ kind: 'URL', label: 'Abrir', url: 'https://app.example.com/p/{{open}}' }],
        },
      });

      const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
      const urlComp = body.template?.components?.find(
        (c: { type: string; sub_type?: string }) => c.type === 'button' && c.sub_type === 'url',
      );
      expect(urlComp?.parameters).toEqual([{ type: 'text', text: 'abc123' }]);
      expect(urlComp?.parameters?.[0]).not.toHaveProperty('parameter_name');
    });

    it('URL button estático não inclui componente de botão no envio', async () => {
      const f = mockFetch({ body: { messages: [{ id: 'wamid.STATIC' }] } });
      await provider.use(cfg).send({
        type: 'TEMPLATE',
        phone: '5511999999999',
        template: {
          name: 'static_link',
          language: 'pt-BR',
          category: 'UTILITY',
          values: {},
          body: 'Acesse',
          buttons: [{ kind: 'URL', label: 'Abrir', url: 'https://app.example.com' }],
        },
      });

      const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
      const urlComp = body.template?.components?.find(
        (c: { type: string; sub_type?: string }) => c.type === 'button' && c.sub_type === 'url',
      );
      expect(urlComp).toBeUndefined();
    });
  });

  describe('deleteRemoteTemplate / fetchTemplateStatuses', () => {
    it('deleteRemoteTemplate chama DELETE com o name na query', async () => {
      const f = mockFetch({ body: { success: true } });
      const res = await provider.use(cfg).deleteRemoteTemplate!('password_changed');

      expect(f.mock.calls[0][0]).toBe(
        'https://graph.facebook.com/v21.0/waba-1/message_templates?name=password_changed',
      );
      expect((f.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
      expect(res.status).toBe(true);
    });

    it('deleteRemoteTemplate com id remove só aquele idioma (hsm_id + name)', async () => {
      const f = mockFetch({ body: { success: true } });
      await provider.use(cfg).deleteRemoteTemplate!('password_changed', '999');

      expect(f.mock.calls[0][0]).toBe(
        'https://graph.facebook.com/v21.0/waba-1/message_templates?hsm_id=999&name=password_changed',
      );
    });

    it('fetchTemplateStatuses traduz o vocabulário e descarta linhas sem status conhecido', async () => {
      mockFetch({
        body: {
          data: [
            { id: 'wa-1', name: 'a', language: 'pt_BR', status: 'APPROVED' },
            { id: 'wa-2', name: 'b', language: 'pt_BR', status: 'ALGO_NOVO' },
          ],
        },
      });
      const res = await provider.use(cfg).fetchTemplateStatuses!();
      expect(res).toEqual([
        { providerTemplateId: 'wa-1', name: 'a', language: 'pt-BR', status: 'APPROVED', reason: undefined },
      ]);
    });
  });

  describe('registerWebhook', () => {
    it('assina também message_template_status_update — senão a Meta nunca avisa a decisão do template', async () => {
      const f = mockFetch({ body: { success: true } });
      const res = await provider
        .use({ ...cfg, appId: 'app-1', appSecret: 'sec', verifyToken: 'vt' })
        .registerWebhook!('https://x.test/hook');

      expect(res.status).toBe(true);
      const sent = new URLSearchParams((f.mock.calls[0][1] as RequestInit).body as string);
      expect(sent.get('fields')).toBe('messages,message_template_status_update,template_category_update');
    });
  });

  describe('parseWebhook — toque em botão', () => {
    const hook = (message: Record<string, unknown>) => ({
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                contacts: [{ wa_id: '5511999999999', profile: { name: 'Pablo' } }],
                messages: [{ id: 'wamid.1', from: '5511999999999', timestamp: '1714510003', ...message }],
              },
            },
          ],
        },
      ],
    });

    it('resposta rápida de template (type button) vira texto com o rótulo tocado', () => {
      const [event] = provider.use(cfg).parseWebhook(hook({ type: 'button', button: { text: 'Sim', payload: 'yes' } }));
      expect(event).toMatchObject({ kind: 'MESSAGE', type: 'TEXT', text: 'Sim', fromMe: false });
    });

    it('traz o payload do botão e a mensagem respondida (context.id)', () => {
      const [tpl] = provider.use(cfg).parseWebhook(
        hook({ type: 'button', context: { id: 'wamid.OUT' }, button: { text: 'Sim', payload: 'accept:42' } }),
      );
      const [interactive] = provider.use(cfg).parseWebhook(
        hook({
          type: 'interactive',
          context: { id: 'wamid.OUT2' },
          interactive: { type: 'button_reply', button_reply: { id: 'details', title: 'Detalhes' } },
        }),
      );
      expect(tpl).toMatchObject({ replyTo: 'wamid.OUT', buttonPayload: 'accept:42' });
      expect(interactive).toMatchObject({ replyTo: 'wamid.OUT2', buttonPayload: 'details' });
    });

    it('botão e lista de mensagem interativa viram texto com o título escolhido', () => {
      const [reply] = provider.use(cfg).parseWebhook(
        hook({ type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'change-button', title: 'Change' } } }),
      );
      const [list] = provider.use(cfg).parseWebhook(
        hook({ type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'a', title: 'Opção A' } } }),
      );
      expect(reply).toMatchObject({ type: 'TEXT', text: 'Change' });
      expect(list).toMatchObject({ type: 'TEXT', text: 'Opção A' });
    });
  });

  describe('parseWebhook — template_category_update', () => {
    it('extrai TEMPLATE_CATEGORY e ignora categoria desconhecida', () => {
      const hook = (value: Record<string, unknown>) => ({
        entry: [{ changes: [{ field: 'template_category_update', value }] }],
      });
      const base = {
        message_template_id: 999,
        message_template_name: 'promo',
        message_template_language: 'pt_BR',
      };

      expect(
        provider.use(cfg).parseWebhook(hook({ ...base, previous_category: 'UTILITY', new_category: 'MARKETING' })),
      ).toEqual([
        {
          kind: 'TEMPLATE_CATEGORY',
          providerTemplateId: '999',
          name: 'promo',
          language: 'pt-BR',
          previousCategory: 'UTILITY',
          newCategory: 'MARKETING',
        },
      ]);
      expect(provider.use(cfg).parseWebhook(hook({ ...base, new_category: 'OUTRA' }))).toEqual([]);
    });
  });

  describe('parseWebhook — message_template_status_update', () => {
    it('extrai TEMPLATE_STATUS com idioma convertido de volta para BCP 47', () => {
      const events = provider.use(cfg).parseWebhook({
        entry: [
          {
            changes: [
              {
                field: 'message_template_status_update',
                value: {
                  event: 'REJECTED',
                  message_template_id: 999,
                  message_template_name: 'password_changed',
                  message_template_language: 'pt_BR',
                  reason: 'INCORRECT_CATEGORY',
                },
              },
            ],
          },
        ],
      });

      expect(events).toEqual([
        {
          kind: 'TEMPLATE_STATUS',
          providerTemplateId: '999',
          name: 'password_changed',
          language: 'pt-BR',
          status: 'REJECTED',
          reason: 'INCORRECT_CATEGORY',
        },
      ]);
    });

    it('evento de status desconhecido não gera MessagingEvent', () => {
      const events = provider.use(cfg).parseWebhook({
        entry: [
          {
            changes: [
              {
                field: 'message_template_status_update',
                value: { event: 'ALGO_NOVO', message_template_id: 1, message_template_name: 'x' },
              },
            ],
          },
        ],
      });
      expect(events).toEqual([]);
    });
  });
});

describe('sanitizeParameter (a Meta recusa quebra de linha, tab e mais de 4 espaços no valor)', () => {
  it('troca quebra de linha e tab por espaço e limita espaços seguidos', () => {
    expect(sanitizeParameter('Rua A\nBairro B\t\tCidade')).toBe('Rua A Bairro B Cidade');
    expect(sanitizeParameter('a        b')).toBe('a    b');
    expect(sanitizeParameter('  Ana  ')).toBe('Ana');
  });

  it('valor normal passa intacto', () => {
    expect(sanitizeParameter('Ana Souza')).toBe('Ana Souza');
    expect(sanitizeParameter('')).toBe('');
  });
});
