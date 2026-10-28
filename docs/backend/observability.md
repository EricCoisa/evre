---
title: Observabilidade & Rate limit
tags: [backend, observability, security]
---

# Observabilidade & Rate limit

## Logs — nestjs-pino

Logger estruturado (`LoggerModule.forRoot` em `app.module.ts`). Nível `debug` em dev, `info` em prod; `pino-pretty` (single line) em dev. Trocado por `app.useLogger(PinoLogger)` no `main.ts`.

`common/interceptors/logging.interceptor.ts` loga cada request; `common/filters/all-exceptions.filter.ts` normaliza o shape de erro — ver [[error-handling]].

O filtro separa por faixa de status: **4xx** vira `logger.warn` sem stack (é fluxo normal do cliente), **5xx** vira `logger.error` com stack.

## Erros — Sentry

`@sentry/nestjs` inicializa em `src/instrument.ts`, importado na **primeira linha** do `main.ts` — antes de qualquer import do app, senão a auto-instrumentação (HTTP, Express, Prisma) não consegue fazer patch nos módulos já carregados.

Sem DSN, `init` nem é chamado e o SDK inteiro é no-op: nada para configurar num projeto novo. `environment` sai do `NODE_ENV`.

### Duas fontes de DSN, e elas não são equivalentes

O DSN pode vir do **ambiente** (`SENTRY_DSN`) ou do **banco** (`SYSTEM_SENTRY_DSN`, editável em `/settings`). Elas não entregam a mesma coisa, e é isso que decide a precedência:

| Fonte | Quando é aplicada | O que habilita |
|---|---|---|
| `SENTRY_DSN` (ambiente) | no `instrument.ts`, **antes** dos imports do app | tudo: auto-instrumentação (contexto de request, breadcrumbs, spans) + captura de exceção |
| `SYSTEM_SENTRY_DSN` (banco) | no `main.ts`, depois que o Nest sobe e o banco responde | **só** a captura de exceção — que é o que o `AllExceptionsFilter` usa |

O banco é a fonte tardia por construção: ele não existe no momento em que a instrumentação precisaria fazer patch nos módulos. Por isso **o ambiente ganha** — `initSentry` é idempotente e a chamada do `main.ts` vira no-op quando a env já ligou o SDK. Quer tracing, use a env; quer configurar sem redeploy, use a tela.

Como o `instrument.ts` roda antes do `ConfigModule` existir, ele carrega o `.env` com `dotenv/config` — em Docker as variáveis já vêm do ambiente e o dotenv não sobrescreve. **Onde colocar o DSN depende de como você sobe o stack:**

| Rodando | Onde |
|---|---|
| local (`pnpm dev`) | `backend-nest/.env` |
| Docker | `.env` da **raiz** — o `docker-compose.yml` repassa a variável ao container |
| qualquer um, sem tocar em deploy | `/settings` → Configuração do Sistema → Observabilidade (Sentry) |

### O toggle, e por que ele alcança as duas fontes

`SYSTEM_SENTRY_ENABLED` liga/desliga o envio sem apagar o DSN. Desligado, o `main.ts` chama `disableSentry()`, que dá `close()` no cliente — **inclusive no que a env já tinha inicializado**. Sem isso o checkbox seria um botão mentiroso em qualquer deploy com `SENTRY_DSN` no ambiente: o admin desligaria pela tela e o backend continuaria mandando evento.

A chave **nasce `true`**, e chave ausente também conta como ligada — só o literal `'false'` desliga. É o oposto do `SYSTEM_CAPTCHA_ENABLED`, de propósito: com o default invertido, um seed rodado numa base sem a chave desligaria a telemetria de quem já roda com `SENTRY_DSN` no ambiente. Sem DSN o SDK é no-op de qualquer jeito, então `true` não liga nada sozinho.

**Nenhum dos dois vale a quente.** O SDK só lê DSN e toggle no boot — mudou em `/settings`, reinicie o backend. Mesma limitação do `SYSTEM_STORAGE_LOCAL_DIR`.

A leitura da configuração no boot é `try/catch`: banco sem migration ainda não tem a tabela, e telemetria não pode impedir a API de subir.

### Diagnóstico pelo boot

| Linha no boot | Significa |
|---|---|
| `[Sentry] ativo (environment=…)` | SDK ligado — por env ou por banco, a linha é a mesma |
| `[Sentry] desligado por SYSTEM_SENTRY_ENABLED=false` | havia DSN, o toggle derrubou |
| *nenhuma das duas* | nenhum DSN chegou ao processo |

É o primeiro lugar para olhar quando nada aparece no painel.

### As peças

| Peça | Arquivo | Papel |
|---|---|---|
| `initSentry` | `src/instrument.ts` | liga o SDK; idempotente, o primeiro DSN vence |
| `disableSentry` | `src/instrument.ts` | `close()` no cliente — dá alcance ao toggle |
| leitura da config | `src/main.ts` | aplica `SYSTEM_SENTRY_ENABLED` / `SYSTEM_SENTRY_DSN` depois do boot |
| `SentryModule.forRoot()` | `app.module.ts` | anexa contexto da request (rota, headers) ao evento |
| `Sentry.captureException` | `common/filters/all-exceptions.filter.ts` | envia o evento |

### Validação do DSN antes de gravar

A tela não salva DSN sem conferir. `SaveSentryConfigUseCase` sonda o valor e só então persiste — mesmo contrato de storage/email/captcha (`ProviderResult` + `assertProviderOk`, ver [[error-handling]]). DSN vazio é o caminho de **remover o destino** e pula a sonda: exigir um DSN válido para apagar o DSN prenderia o admin.

A sonda é um POST **vazio** no endpoint de ingestão do próprio DSN (`SentryConfigService.validateDsn`). O Sentry autentica a chave pública antes de olhar o corpo, então:

| Resposta | Leitura |
|---|---|
| `401` / `403` | chave pública recusada |
| `404` | projeto inexistente neste host |
| erro de rede/DNS | host errado ou inalcançável |
| qualquer outra, **`400` incluído** | a chave passou pela autenticação → válido |

O `400` ("empty envelope") é sucesso, não falha — é justamente o que se quer: o corpo vazio prova a credencial **sem criar evento nenhum** no projeto. `parseSentryDsn` (`src/domain/observability/sentry.const.ts`) reprova o formato antes de gastar rede e aceita self-hosted servido em subpasta (`https://chave@host/prefixo/42`).

**O DSN não é `secret: true`, de propósito** — o próprio Sentry publica o dele no bundle do front. Por isso o GET devolve o valor real e o formulário hidrata normalmente, sem a regra de "vazio mantém o gravado" que vale para credencial de verdade (ver [[system-configuration]]). Marcá-lo como secret mascararia o campo com `****` e quebraria essa hidratação.

**Só 5xx é enviado.** 4xx é validação/401/404 — fluxo normal, mandar isso vira ruído e queima cota.

Fluxo fora do ciclo HTTP (job BullMQ, cron, listener) não passa pelo filtro — capture na mão:

```ts
import * as Sentry from '@sentry/nestjs';

catch (err) { Sentry.captureException(err); throw err; }
```

Para enriquecer o evento, o SDK é global: `Sentry.setUser({ id })`, `Sentry.setTag('tenant', orgId)`, `Sentry.addBreadcrumb({ message })`.

## Audit trail — SystemLog

Trilha de negócio (separada dos logs de request): `LoggingModule` grava em `SystemLog` via `LoggingService.create({ module, action, message, metadata }, userId)`. Ex.: login registra a ação em `login.use-case.ts`. Modelo em [[data-model]].

### Dado sensível nunca entra no SystemLog

`SystemConfiguration.secret` e `UserConfigurationDefinition.secret` marcam a chave como privada. Quando
um log descreve a alteração de uma dessas chaves, o valor **não pode aparecer** — nem em `message`, nem
em `metadata`:

```ts
import { maskIfSecret } from 'src/common/utils/mask-secret-for-log.util';

message: `Configuração ${config.labelKey} atualizada para ${maskIfSecret(config.secret, config.value)}`,
metadata: {
  oldValue: maskIfSecret(antes.secret, antes.value),
  newValue: maskIfSecret(depois.secret, depois.value),
},
```

Dois motivos para isso ser regra e não zelo:

- O `SystemLog` é **lido na tela de logs** por quem tem acesso ao módulo, e `LoggingService.writeNow`
  replica cada entrada para o **ClientLog externo** — vazar aqui é vazar para fora do sistema.
- Mesmo com o valor gravado criptografado, é o **ciphertext** que iria para o log: inútil para
  auditoria e material a mais para quem já tiver a chave.

O que importa para a trilha é *que a chave mudou* e *quem mudou* — nunca o conteúdo. Ao escrever um log
novo que toca configuração, passe todo valor por `maskIfSecret`.

> **Não confunda com `common/utils/mask-secret-value.util.ts`.** Aquele mascara
> **resposta de API**: recebe o DTO inteiro e devolve `value: '****'` — quatro asteriscos, que são
> contrato com o formulário (campo secreto vem mascarado, e salvar sem retocar mantém a credencial, via
> `keepStoredWhenBlank`). `maskIfSecret` mascara **log**, onde não existe DTO: só a flag e um escalar,
> quase sempre dentro de uma template string.

### Novo LogActions enum value

Ao criar um novo valor em `LogActions` ou `LogModuleConst` (`backend-nest/src/domain/logging/`), adicione a chave correspondente:
- **Ações & Módulos:** `frontend-next/src/locales/en/labelKey.json` e `pt-BR/labelKey.json`
- Chave = nome do enum (ex: `"ACCOUNT_LOCKED": "Account locked"`)

## Health checks — @nestjs/terminus

`modules/health/health.controller.ts` (`@SkipThrottle()`):

| Rota | Tipo | Checa |
|------|------|-------|
| `GET /api/v1/health` · `/health/live` | Liveness | processo de pé |
| `GET /api/v1/health/ready` | Readiness | Postgres (`SELECT 1`) |

O `docker-compose.yml` usa `/health/ready` como healthcheck do backend.

## Rate limit — @nestjs/throttler

`ThrottlerGuard` é **guard global** (`APP_GUARD` em `app.module.ts`). Default: **100 req/min**.

- Storage em Redis: `common/infrastructure/throttler/redis-throttler.storage.ts` (compartilha o Redis do BullMQ via ioredis). Isolado por `APP_NAME` quando vários projetos compartilham a mesma instância — ver [[queues-and-jobs]] § "`APP_NAME`".
- Sobrescreva por rota com `@Throttle({ default: { limit, ttl } })` ou desligue com `@SkipThrottle()`.

Ver [[auth-rbac]] para os limites das rotas sensíveis.

### As rotas anônimas e seus tetos

O default de 100/min é teto de infraestrutura, não de negócio: **toda rota anônima que custa alguma
coisa precisa do próprio `@Throttle`**. O que existe hoje:

| Rota | Limite | O que o abuso custa |
|---|---|---|
| `POST /auth/login` | 5/min | brute force de senha |
| `POST /user/signup` | 5/min | contas em massa + bcrypt queimando CPU |
| `POST /auth/reset-password` | 5/min | brute force de token |
| `POST /auth/accept-invite` | 5/min | — |
| `POST /auth/forgot-password` | 3/min | bombardeio de e-mail |
| `GET /auth/check-reset-token` | 10/min | varredura de token de reset |
| `POST /auth/validate-invite-token` | 10/min | varredura de token de convite |
| `oauth/authorize-url` · `oauth/callback` | 10/min | — |
| `GET /captcha/config` | 30/min | leitura pública, ver [[captcha]] |

**Throttle por IP não é suficiente sozinho** — trocar de IP é grátis. Duas camadas cobrem o que ele
não cobre, e nenhuma das três substitui as outras:

- **Lockout por conta** — `validate-user.use-case.ts`: 5 tentativas erradas → `lockUntil` de 15 min e
  um log `ACCOUNT_LOCKED`. É o que segura brute force distribuído numa conta específica.
- **Janela por destinatário** — `request-password-reset.use-case.ts`: 5 min entre dois e-mails de
  recuperação para o mesmo endereço, contados no Redis por hash do e-mail (nada de PII na chave).
  Silencioso de propósito: sinalizar ali viraria enumeração de e-mail.
- **Captcha** — exigência de humano em login, cadastro e recuperação. Ver [[captcha]].

### O IP contado precisa ser o do usuário

`app.set('trust proxy', 1)` no `main.ts` faz o Express ler o `X-Forwarded-For`, e o `ThrottlerGuard` rastreia **`req.ips[0]`** — a entrada mais à esquerda da lista, o cliente original.

O detalhe que quebra tudo: **nenhuma request do frontend chega aqui direto**. Server Actions, route handlers e o middleware do Next falam com o backend a partir do *servidor* Next. Sem `X-Forwarded-For` no salto Next → backend, o IP visto é o do container do Next e os 100 req/min viram um balde **único para a aplicação inteira** — um atacante sozinho o esgota e todo mundo leva 429. E como o middleware faz 1–2 chamadas por navegação privada, tráfego normal já derruba o app sem atacante nenhum.

Quem repassa o header é o front (`lib/api/client-ip.ts` + `forwardedFor()` no `middleware.ts`) — ver [[server-actions]]. **Abriu um caminho Next → backend novo? Repasse o header junto**, senão aquela rota volta para o balde compartilhado.

Duas consequências de o tracker ser `req.ips[0]`:

- **Hops não atrapalham o throttler.** Com `clientIp, proxy1` na lista, `ips[0]` continua sendo o cliente. Quem depende da contagem é o `req.ip` (logs, Sentry): `trust proxy 1` confia em **um** salto — entrou proxy entre Next e backend, suba o número.
- **`X-Forwarded-For` é header, ou seja, forjável.** Quem alcança o backend direto escolhe o próprio balde. No `docker-compose.yml` o serviço `backend` não publica porta — só a rede interna chega nele, e é assim que deve continuar. Expôs a porta? O throttler passa a ser decorativo.

O throttler limita abuso por cliente; ele não é escudo de DoS. Saturação de banda/conexão se resolve na borda (`limit_req` do nginx, Cloudflare), antes de a request custar um processo Node.
