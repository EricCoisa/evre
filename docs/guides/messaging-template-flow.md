---
title: Enviar mensagem com template e botões (exemplo agnóstico)
tags: [guide, messaging, templates, buttons]
---

# Enviar mensagem com template e botões — passo a passo

Exemplo **sem domínio de negócio** do ciclo completo: *tipo → template → envio → toque do cliente →
handler*. Troque os nomes (`NOTICE`, `ack`, `open`) pelos do seu módulo. Referência detalhada:
[[messaging]]; diferenças entre providers: [[messaging-providers]].

## Modelo mental

| Quem | Decide | Onde |
|---|---|---|
| **Dev** | o contrato: variáveis e botões que o tipo oferece, e o que fazer ao tocar | código + aba *Tipos* |
| **Operador** | só a redação (por idioma) usando o que o tipo oferece | aba *Templates* |
| **Módulo que envia** | os valores (`values`, `reserved`, `buttons`) e a `correlation` | chamada de `sendTemplate` |

O servidor valida tudo num lugar só (`conformTemplateToType`); o front não é fonte de verdade.

## 1. Criar o tipo (`/comunicacao/templates?tab=types`)

Tipo `NOTICE`:

- Variáveis custom: `title` (obrigatória), `ref` (opcional).
- Variável reservada (checkbox): `first_name` — vem de `ReservedVariableKey`.
- Botões:
  - `ack` — `QUICK_REPLY` (gera evento ao toque).
  - `open` — `URL` do sistema, `urlBase = https://app.example.com/notices/`.
  - `opt_out` — reservado (comportamento embutido).

Alterar o contrato depois **invalida** os templates do tipo ("Requer ajuste"); excluir tipo em uso é
recusado.

## 2. Criar o template (`?tab=templates`)

Escolha o tipo `NOTICE`, key `NOTICE_CREATED`, idioma `pt-BR` e escreva o texto:

```
Olá {{ first_name }}, você tem um novo aviso: {{ title }}. Referência: {{ ref }}.
```

Cada botão do tipo recebe só o **texto** (“Marcar como lido”, “Abrir”). O payload e a URL final nascem
no envio. Usar variável fora do tipo, ou esquecer uma obrigatória/botão obrigatório, é recusado.
Em provider com aprovação, submeta o template (as regras de redação aparecem no editor).

## 3. Enviar (código)

Importe `MessagingModule` no seu módulo e injete `MessagingService`:

```ts
await this.messaging.sendTemplate(
  {
    key: 'NOTICE_CREATED',
    phone,
    values: { title: notice.title, ref: notice.code },
    reserved: { [ReservedVariableKey.FIRST_NAME]: user.name },   // chave + dado BRUTO
    buttons: {
      open: notice.token,                    // sufixo do link do sistema → urlBase + token
      ack: notice.id,                        // dado extra do payload ("ack:<id>") — não é segredo
      [ReservedButtonKey.OPT_OUT]: true,
    },
  },
  { correlation: { type: 'notice', id: notice.id } },   // contexto de negócio, devolvido ao handler
);
// trySendTemplate(...) devolve null em vez de lançar (mensagem é um extra, não derruba o fluxo)
```

Regras: chave inexistente no template = 400; link do sistema sem sufixo = 400; valor ausente nunca
vira `{{ placeholder }}` no cliente. Segredos **não** vão em `buttons` (o payload viaja pelo aparelho
do cliente) — use `correlation`.

## 4. Tratar o toque (handler)

No `onModuleInit` do seu módulo:

```ts
@Injectable()
export class NoticeButtonHandlers implements OnModuleInit {
  constructor(private readonly registry: ButtonHandlerRegistry) {}

  onModuleInit() {
    this.registry.register({ type: 'NOTICE', button: 'ack' }, async (event) => {
      // event: { typeKey, buttonKey, data, phone, connectionId, templateId,
      //          originalMessageId, correlation, messageId, at }
      await this.notices.markAsRead(event.correlation?.id ?? event.data);
    });
  }
}
```

Fluxo interno: webhook → `messaging-inbound` → `MessagingButtonEventService.capture` (grava
`MessagingButtonEvent`, único por mensagem) → fila `messaging-buttons` → handlers. Estados:
`PENDING → PROCESSED | FAILED | IGNORED` (sem handler). **O handler deve ser idempotente**: pode ser
reexecutado (retry) ou o cliente pode tocar várias vezes. O botão `open` (URL) não gera evento — o
clique vai ao navegador; rastreie no destino.

## 5. Checklist

- [ ] Tipo criado com variáveis e botões; botão `QUICK_REPLY` com handler (a tela mostra “handler
      registrado: sim/não”).
- [ ] Template criado (e aprovado, se o provider exigir).
- [ ] `sendTemplate` com `values`/`reserved`/`buttons` e `correlation`.
- [ ] Handler idempotente registrado; consumidor tolera **ausência** de toque.
- [ ] Spec do use-case/handler (ver [[testing]]). Provider sem botões interativos cai em texto —
      não dependa do evento para o fluxo crítico.

## Armadilhas

- Texto do template vive no operador; **lógica** vive no tipo/código.
- Mudou o contrato do tipo? Reajuste os templates marcados “Requer ajuste”.
- Mudou o contrato HTTP? `openapi:export` → `generate:api` ([[http-client-orval]]).
