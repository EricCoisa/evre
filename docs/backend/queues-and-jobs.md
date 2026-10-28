---
title: Filas & Jobs
tags: [backend, queues]
---

# Filas & Jobs

Dois mecanismos assíncronos, ambos configurados em `app.module.ts`.

## Filas — BullMQ + Redis

`BullModule.forRootAsync` conecta no Redis (`REDIS_URL`, default `redis://localhost:6379`).

Padrão: produtor enfileira → **Processor** (`WorkerHost`) consome.

**Email** (`modules/email/`) é o exemplo vivo:

```ts
@Processor('email')
export class EmailProcessor extends WorkerHost {
  async process(job: Job<...>) {
    await this.emailService.sendNow(job.data);
  }
}
```

- Templates HTML: `email/template/` — `invitation.html`, `password-reset.html`, `welcome.html`. São strings HTML interpoladas com `{{name}}`, `{{link}}`, etc. Para editar, altere o arquivo HTML diretamente.
- Usado por auth (convite, reset de senha). Ver [[auth-rbac]].

### Provider ativo e configuração

Dois providers: `resend.provider.ts` (API do Resend) e `nodemailer.provider.ts` (SMTP). Quem escolhe é
a chave `SYSTEM_EMAIL_PROVIDER` em `SystemConfiguration` (`RESEND` ou `SMTP`); **valor ausente cai em
`RESEND`**. Cada campo é lido do banco e, quando ausente, da variável de ambiente correspondente:

| Chave DB | Fallback ENV | Provider |
|---|---|---|
| `SYSTEM_EMAIL_PROVIDER` | — | escolhe entre `RESEND` e `SMTP` |
| `SYSTEM_EMAIL_DEFAULT_FROM` | — | ambos |
| `SYSTEM_EMAIL_PROVIDER_API_KEY` | `RESEND_API_KEY` | `RESEND` |
| `SYSTEM_EMAIL_SMTP_HOST` | `SMTP_HOST` | `SMTP` |
| `SYSTEM_EMAIL_SMTP_PORT` | `SMTP_PORT` (default `587`) | `SMTP` |
| `SYSTEM_EMAIL_SMTP_USER` | `SMTP_USER` | `SMTP` |
| `SYSTEM_EMAIL_SMTP_PASS` | `SMTP_PASS` | `SMTP` |
| `SYSTEM_EMAIL_SMTP_SECURE` | `SMTP_SECURE` (default `false`) | `SMTP` |

`PUT /api/v1/email/config` (ADMIN) grava tudo isso num passo: `SaveEmailConfigurationUseCase` valida o
formulário contra o provider real (`validateCandidate` + `assertProviderOk`) e só então persiste.
Credencial ruim devolve 400 e o banco não muda. Segredo em branco mantém o gravado.

### Política sync vs async

| Tipo de email | Método | Comportamento em falha |
|---|---|---|
| **Convite** | `sendNow()` — síncrono | Propaga exceção ao caller; falha aparece no log e no `toast.error` do front |
| **Confirmação de cadastro / welcome** | `send()` — enfileirado | A rota responde sem aguardar o provedor; o worker tenta novamente em falha |
| **Reset de senha** | `send()` — enfileirado | Falha em silêncio; registrada em `SystemLog` |

O convite é síncrono porque o usuário precisa do link — a falha deve ser visível imediatamente. Welcome/reset são não-críticos para a UX do fluxo principal.
Quando a fila `email` não está registrada, `EmailService.send()` usa o fallback síncrono `sendNow()`.

### Health-check do serviço de email

`GET /api/v1/email/health` (autenticado, role ADMIN) devolve `{ operational: boolean; reason?: string }`.

O resultado é **cacheado no Redis** (chave `email:health`, TTL 300s) para evitar que o endpoint acione o provider a cada chamada — o `_validate` do Resend **envia um email de teste real**.

**Invalidação:** salvar qualquer chave com prefixo `SYSTEM_EMAIL_*` nas configurações do sistema invalida o cache imediatamente.

**Gate de convite:** antes de gerar o token/persistir o convite, `generate-invite.use-case.ts` chama `checkHealth()`. Se `operational === false`, retorna 503 com mensagem i18n. Nenhum registro é criado.

**Redis down:** o `RedisService` engole erros e devolve `null`; o health-check ainda funciona, mas computa ao vivo (sem cache) — limitação documentada.

### Adicionar um novo email

1. Crie o template HTML em `email/template/<nome>.html`.
2. Adicione o tipo de job no enum de `email.processor.ts` e o método de envio em `email.service.ts`.
3. Enfileire no use-case que dispara o email:

```ts
constructor(@InjectQueue('email') private emailQueue: Queue) {}

await this.emailQueue.add('welcome', { to: user.email, name: user.name });
```

Para uma fila nova: crie a fila (`BullModule.registerQueue({ name })`), injete-a para enfileirar, e um `@Processor(name)` para consumir.

### Mensageria WhatsApp

O módulo `modules/messaging/` registra três grupos de fila, todos no BullMQ/Redis (nomes em
`messaging-queue.const.ts`):

| Fila | Produtor | Processor | Payload e retry |
|---|---|---|---|
| `messaging` + `messaging-send-1`…`messaging-send-7` (8 partições) | `MessagingService.send()` | uma instância de `MessagingSendProcessor` por partição, `concurrency: 1` | `{ messageId }`; job com `attempts: 1` — o retry é um loop manual dentro do processor (`MESSAGING_SEND_RETRY_DELAYS_MS = [1s, 5s, 15s]`), que para em erro não-transitório (`UnrecoverableError`) |
| `messaging-inbound` | `ReceiveWebhookUseCase` | `MessagingInboundProcessor` | Evento autenticado; 5 tentativas, backoff exponencial a partir de 5 s; reenvio é deduplicado por `providerMessageId`. |
| `messaging-buttons` | webhook de toque em botão | `MessagingButtonProcessor` | `{ eventId }`; 5 tentativas, backoff exponencial a partir de 10 s; fila própria para um handler de botão lento/quebrado não travar a ingestão. |

A partição de envio é escolhida por hash de `(connectionId, contactId)` (`sendPartition`), o que
mantém a ordem de uma mesma conversa numa única fila/worker sem serializar conversas diferentes.

O registro outbound persiste a linha `QUEUED` antes de enfileirar; o worker grava `SENT` ou
`FAILED`. O webhook valida chave/assinatura, enfileira e responde sem processar o evento na
requisição. Status que ainda não encontram uma mensagem correspondente lançam erro para permitir
retry. Ver [[messaging]] para a superfície dos providers e o contrato do webhook.

## Jobs agendados — @nestjs/schedule

`ScheduleModule.forRoot()` habilita cron. Tasks em `modules/tasks/`:

| Task | Papel |
|------|-------|
| `logClear.task.ts` | Limpeza de logs antigos |
| `refreshTokenClear.task.ts` | Remoção de refresh tokens expirados |
| `signup-intent-clear.task.ts` | Remoção diária de intenções de cadastro expiradas |

Use `@Cron(...)`/`@Interval(...)` num provider registrado no módulo. Redis não é necessário para cron (só para BullMQ).

`logClear.task.ts` foge do decorator estático: o intervalo vem de `SystemConfiguration`
(`SYSTEMCONFIG_LOG_DELETE_DAY`), então o job é registrado em runtime via `SchedulerRegistry` +
`CronJob` (pacote `cron`), não `@Cron(...)`. Use o decorator estático por padrão; só troque por
`SchedulerRegistry` quando o próprio intervalo precisar ser editável sem redeploy.

Infra Redis compartilhada: `common/infrastructure/redis/`. Rate limit também usa Redis — ver [[observability]].

## `APP_NAME` — isolamento entre projetos no mesmo Redis

Mesmo cenário do storage (ver [[storage]] § "`APP_NAME` — isolamento entre projetos no mesmo bucket"):
vários projetos derivados deste template numa VPS podem compartilhar a mesma instância Redis (mesma
`REDIS_URL`) sem banco/instância por projeto, desde que cada um tenha um `APP_NAME` diferente. Sem
isso, dois apps na mesma instância colidiriam de verdade — não é só a mesma key por acaso, é a
**mesma fila**: `messaging-inbound` de um projeto seria consumida pelo worker do outro.

Três pontos de entrada, isolados do mesmo jeito:

| Onde | Mecanismo | Efeito |
|---|---|---|
| `BullModule.forRootAsync` (`app.module.ts`) | `prefix: process.env.APP_NAME` | Isola as keys de **todas** as filas registradas (produtor e `@Processor`) sem mudar nome de fila |
| `RedisService` (`common/infrastructure/redis/redis.service.ts`) | `keyPrefix` do cliente `ioredis` | Isola `get`/`set`/`del`/`incrby`/`sadd`/`scard`/`setnx` — usado por cache, lock, sessão de mensageria etc. |
| `RedisService.publish`/`subscribe` | prefixo manual no nome do canal | `keyPrefix` do `ioredis` não alcança `PUBLISH`/`SUBSCRIBE` (canal não é "key" pro Redis) |
| `RedisThrottlerStorage` (`common/infrastructure/throttler/`) | `keyPrefix` do cliente `ioredis` | Isola os contadores de rate limit — ver [[observability]] |

Mesmo `APP_NAME` que isola o storage; nenhuma env var nova. `prefix`/`keyPrefix` mudam a key
**dentro** do Redis (ex.: `{APP_NAME}:messaging-inbound:...`), não o nome lógico da fila/canal — o
contrato de nomes acima continua valendo.
