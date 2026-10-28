---
title: Verificação de alvo (código por propósito)
tags: [backend, auth, verification]
---

# Verificação de alvo (código por propósito)

Mecanismo agnóstico de "provar que o usuário controla um alvo" (telefone, email, futuro
autenticador) antes de liberar algo sensível — sem embutir nenhuma regra de negócio. Quem decide
*o que* exige confirmação é o módulo consumidor; o `VerificationModule` só sabe pedir/gerar/validar
um código por `(userId, purpose, target)`.

Código real em `backend-nest/src/modules/verification/` (controller, service, guard) e
`backend-nest/src/domain/verification/` (constantes agnósticas de domínio).

## O contrato

`purpose` é uma **string livre definida pelo módulo chamador**, não um enum do banco — ex.
`UserVerificationPurpose.PHONE_CONFIRMATION` (`domain/user/user-verification-purpose.const.ts`) vale
`'USER_PHONE_CONFIRMATION'`. O `VerificationModule` nunca conhece esses valores; ele só persiste o
que recebe em `VerificationCode` (ver [[data-model]]).

`channel` é o enum `VerificationChannel` do Prisma: `EMAIL`, `WHATSAPP`, `AUTHENTICATOR` — este
último reservado, `RequestVerificationUseCase` rejeita com `verification.channel_not_implemented`
até existir uma implementação.

## Endpoints (`VerificationController`)

| Rota | Papel |
|---|---|
| `POST /verification/request` | gera o código, despacha por `channel`, persiste `VerificationCode`. Rate-limit 3/min (mesmo padrão de `forgot-password`) |
| `POST /verification/confirm` | compara o código ao hash salvo, marca `consumedAt` |
| `GET /verification/health?channel=` | "canal pronto para enviar?" — consulta `EmailService.checkHealth()`/`MessagingService.isEnabled()`, cacheado. Serve para um botão se autodesabilitar, ver [[service-health-gate]] |

`request` escolhe o `target` do próprio `User` (`email`/`phone`) quando não vem no payload; serve
para confirmar um valor **ainda não salvo** (ex. trocar de telefone) passando `target` explícito.
Cooldown de reenvio: 60s. Expiração do código: 10 min.

## Consumo por outro módulo: `VerificationService` + `@RequireVerification`

Dois jeitos de consumir, conforme o caso:

**1. Injeção direta** — `VerificationService.request()/.confirm()/.isConfirmed()` para quem orquestra
o próprio fluxo (ex. `notification`: ver abaixo).

**2. Guard declarativo** — `@UseGuards(VerificationGuard) @RequireVerification({ purpose, channel,
targetField, method? })` num endpoint que recebe o alvo no body. Exemplo real, `user.controller.ts`
(trocar telefone):

```ts
@UseGuards(PhoneAvailabilityGuard, VerificationGuard)
@RequireVerification({
  purpose: UserVerificationPurpose.PHONE_CONFIRMATION,
  channel: 'WHATSAPP',
  targetField: 'phone',
  method: 'ONCE',
})
@PatchApi({ ... })
```

O guard lê `request.body[targetField]`; se o campo não vier na chamada (não está sendo alterado),
deixa passar sem checar nada. Se vier e não houver confirmação válida, responde **428** (`verification
.required`) com `{ purpose, channel, target }` em `errors` — é o sinal para o front abrir o modal de
pedir/confirmar código. Se o canal não está operacional (`health.operational === false`), responde
**503** em vez de 428: não adianta abrir um modal para um "enviar código" que vai falhar.

`method` (`VerificationMethod`, `PERMANENT` | `ONCE` | `TTL`) controla por quanto tempo uma
confirmação vale depois de `consumedAt` — `PERMANENT` (default) nunca expira para o mesmo
`(purpose, target)`, `ONCE` é consumido no instante em que o guard libera, `TTL` exige `ttlSeconds`.

A checagem do guard mora no próprio guard — diferente do teto de rota de [[auth-rbac]]
(`RouteCeilingRegistry`), que mora no use-case.

## Escape hatch: `markConfirmed`

Para quem já provou o alvo por **outro** canal confiável (ex. um convite assinado que já contém o
telefone), `VerificationService.markConfirmed({ userId, purpose, channel, target })` grava uma
`VerificationCode` já `consumedAt: now` — sem gerar nem enviar código nenhum. Dispara os mesmos
handlers de `confirm()` (abaixo).

## Reação a uma confirmação: `VerificationHandlerRegistry`

Módulo que precisa **fazer algo** quando um `purpose` é confirmado (ex. marcar o telefone como
confirmado no `User`) registra um handler em `onModuleInit`:

```ts
this.handlers.register(UserVerificationPurpose.PHONE_CONFIRMATION, async ({ userId, target }) => { ... });
```

Sem handler registrado não é erro — um `purpose` pode depender só do `VerificationGuard` bloqueando
a rota, sem nenhum efeito colateral extra na confirmação.

## Onde mais é usado

[[notifications]] consulta `VerificationService.isConfirmed({ purpose: PHONE_CONFIRMATION, target:
user.phone })` antes de disparar o relay por WhatsApp — número errado (ou de outra pessoa) não deve
receber notificações da conta. Ver `send-notification.use-case.ts`.

## Tools do agente

`verification/request` e `verification/confirm` ficam **fora** do catálogo de tools (segredo digitado
em texto chegaria ao LLM); `verification/health` também fica fora — "configurado e funcionando" aqui
não é uma pergunta de negócio para o modelo responder sozinho. Ver [[ai-tools]] para o critério
completo de inclusão/exclusão.
