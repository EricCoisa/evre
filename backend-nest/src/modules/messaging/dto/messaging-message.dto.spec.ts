import { toMessagingMessageDto } from './messaging-message.dto';

describe('toMessagingMessageDto — template', () => {
  const row = (template: Record<string, unknown>) =>
    ({
      id: 'm1',
      connectionId: 'c1',
      direction: 'OUTBOUND',
      status: 'SENT',
      contact: { phone: '5511999999999' },
      text: 'Olá Ana',
      mediaUrl: null,
      mimeType: null,
      fileName: null,
      error: null,
      createdAt: new Date(),
      type: 'TEMPLATE',
      raw: { type: 'TEMPLATE', template },
    }) as never;

  // A linha guarda header/footer/URL com `{{ }}` (a Meta substitui); a bolha do chat mostra o final.
  it('header, footer e URL do botão chegam à tela já com os valores', () => {
    const dto = toMessagingMessageDto(
      row({
        name: 'x',
        language: 'pt-BR',
        category: 'UTILITY',
        body: 'Olá Ana',
        values: { first_name: 'Ana', order: '42' },
        header: { kind: 'TEXT', text: 'Oi {{ first_name }}' },
        footer: 'Pedido {{ order }}',
        buttons: [{ kind: 'URL', label: 'Ver', url: 'https://x.com/{{ order }}' }],
      }),
    );

    expect(dto.templateData).toMatchObject({
      body: 'Olá Ana',
      header: { kind: 'TEXT', text: 'Oi Ana' },
      footer: 'Pedido 42',
      buttons: [{ kind: 'URL', label: 'Ver', url: 'https://x.com/42' }],
    });
  });

  it('template sem header/footer/botões não quebra', () => {
    const dto = toMessagingMessageDto(
      row({ name: 'x', language: 'pt-BR', category: 'UTILITY', body: 'oi', values: {} }),
    );
    expect(dto.templateData).toMatchObject({ body: 'oi' });
  });
});
