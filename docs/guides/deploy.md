---
title: Guia — Deploy & produção
tags: [guide, ops, docker]
---

# Guia — Deploy & produção

## Imagens Docker

Cada app tem seu próprio `Dockerfile` multi-stage. **O build context é sempre a raiz do monorepo** (necessário para `pnpm-lock.yaml` e `backend-nest/openapi.json`).

```bash
# Backend
docker build -f backend-nest/Dockerfile -t myapp-backend .

# Frontend
docker build -f frontend-next/Dockerfile -t myapp-frontend .
```

Ambas as imagens usam **Node 22 Alpine** e **pnpm** (ativado por corepack, versão fixada pelo `packageManager` da raiz).

## Backend — comportamento do container

Não há script de entrypoint: o `CMD` do Dockerfile é um `sh -c` que roda, nesta ordem:

1. Se `RUN_MIGRATIONS=true` → `prisma migrate deploy` (schema `public` apenas).
2. Se `RUN_SEED=true` → `tsx prisma/seed.ts`.
3. `node dist/src/main.js`.

As etapas são encadeadas com `&&`: migration ou seed que falhem **abortam o boot**, em vez de subir a
API contra um banco em estado desconhecido.

> O seed é idempotente (usa `upsert`). Em primeiro deploy, defina `RUN_SEED=true`.

**Porta:** o container declara `EXPOSE 3001` e o compose passa `PORT: 3001`. O `main.ts` lê `PORT` e
cai em `3000` se ela não vier — defina `PORT` explicitamente em qualquer orquestrador.

## Frontend — comportamento do container

Build gera saída `standalone` (`next.config.ts → output: 'standalone'`). O Orval roda automaticamente no prebuild — precisa do `backend-nest/openapi.json` no contexto de build.

O `docker-entrypoint.sh` roda `payload migrate` (idempotente) e só então `node frontend-next/server.js`.
O container declara `EXPOSE 3000`.

**Payload CMS:** o adapter lê `DATABASE_URL` — o **mesmo** Postgres do backend — e isola as tabelas em `schemaName: 'payload'`, com `pool.max = 5`. O entrypoint já aplica as migrations no boot; para rodá-las fora do container:

```bash
cd frontend-next && pnpm run payload:migrate
```

## Variáveis de ambiente obrigatórias

Variáveis marcadas `REPLACE_WITH_*` no `.env.example` **não têm default seguro** — devem ser definidas antes de qualquer ambiente.

### Backend

| Variável | Obrigatória | Observação |
|----------|------------|------------|
| `APP_NAME` | ✅ | Nome deste projeto — isola a pasta dele no storage (ver [[storage]]). O boot falha (`process.exit(1)` em `main.ts`) se ficar vazio |
| `DATABASE_URL` | ✅ | Postgres com `connection_limit` |
| `JWT_SECRET` | ✅ | Assina access tokens |
| `JWT_REFRESH_SECRET` | ✅ | Assina refresh tokens |
| `JWT_INVITE_SECRET` | ✅ | Assina o token de convite de usuário |
| `JWT_EXPIRES_IN` | Opcional | Validade do access token (default `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Opcional | Validade do refresh token (default `7d`) |
| `CRYPTO_SECRET` | ✅ | Criptografia de configs secretas (≥ 32 chars) |
| `PAYLOAD_CMS_PASSWORD` | ✅ | Senha mestre de todos os `PayloadUser` (CMS); sem ela o login no CMS lança erro em runtime, não só no seed |
| `AGENT_CMS_SECRET` | ✅ | Segredo compartilhado back↔front para a ponte do agente de IA com o CMS/Page Builder — ver [[ai-tools]] |
| `REDIS_URL` | ✅ | BullMQ + throttler |
| `S3_*` | Se usar S3 | Endpoint, region, bucket, access/secret key, public URL |
| `SENTRY_DSN` | Opcional | Com DSN, 5xx são reportados. É a fonte **completa** (habilita a auto-instrumentação); a alternativa sem deploy é `SYSTEM_SENTRY_DSN` em `/settings`, que só captura exceção. Em Docker precisa estar no `.env` da raiz — ver [[observability]] |
| `SEED_USER_PASSWORD` | Opcional | Senha do admin seed (default `admin123`) |
| `RUN_SEED` | Opcional | `true` para rodar seed no boot |

### Frontend

| Variável | Obrigatória | Observação |
|----------|------------|------------|
| `APP_NAME` | Recomendado | Mesmo valor do backend — isola a pasta do storage do CMS (ver [[storage]]). Sem ele o Payload só usa prefixo vazio, sem travar o boot |
| `DATABASE_URL` | ✅ | Usado pelo Payload CMS (schema `payload`) |
| `PAYLOAD_SECRET` | ✅ | Assina sessões do Payload |
| `AGENT_CMS_SECRET` | ✅ | Mesmo segredo do backend, para a ponte do agente de IA com o CMS/Page Builder |
| `NEXT_PUBLIC_API_URL` | ✅ | URL pública da API backend (ex.: `https://api.meuapp.com/api/v1`) |
| `S3_*` (Payload storage) | Se usar S3 | Payload tem seu próprio storage — ver [[storage]] |

## Banco de dados — escala de conexões

PostgreSQL default: `max_connections=100`.

```
total = backend_replicas × connection_limit + frontend_replicas × pool_payload + margem
```

Recomendações:
- Backend: `connection_limit=10` na `DATABASE_URL`
- Frontend/Payload: `pool.max=5` (configurado no adapter Postgres do Payload)
- Margem: ~10 (migrations, Prisma Studio)

Com 3 réplicas de cada: `3×10 + 3×5 + 10 = 55` — dentro do limite de 100.

Acima de 3 réplicas de backend: ative **PgBouncer** em transaction mode e adicione `pgbouncer=true` à `DATABASE_URL`.

## Health checks

| Rota | Tipo | Uso |
|------|------|-----|
| `GET /api/v1/health/live` | Liveness | Processo de pé |
| `GET /api/v1/health/ready` | Readiness | Postgres responde (`SELECT 1`) |

> [!warning] O healthcheck do `docker-compose.yml` hoje é `/health` (liveness), não `/ready`
> O serviço `backend` do compose testa `wget -qO- http://localhost:3001/api/v1/health` — só confirma
> que o processo está de pé, sem checar o Postgres. Se quiser que o orquestrador espere o banco
> responder antes de considerar o container saudável, aponte o healthcheck para `/health/ready`.

## docker-compose (produção)

O `docker-compose.yml` da raiz pode ser usado em single-node. Para multi-réplica, prefira um orquestrador e use `docker-compose.yml` como referência de variáveis e healthchecks.

### Coolify

Deploy via **Build Pack: Docker Compose** — um único resource cobre todos os serviços do compose (postgres, redis, s3, s3-perms, s3-init, backend, frontend).

- **Base Directory:** `/` · **Docker Compose Location:** `/docker-compose.yml`
- **Domínio por serviço:** a Coolify só oferece campo de domínio pra serviços com porta HTTP exposta (via `EXPOSE` no Dockerfile ou `ports:`/`expose:` no compose). Serviços internos (postgres, redis, s3-perms, s3-init) não recebem domínio.
  - Serviço com múltiplas portas (ex.: s3 (RustFS): 8333 API / 9001 console) → sufixo `:PORTA` no valor do domínio (`s3.exemplo.com:8333`) diz qual porta rotear.
- **Variáveis mágicas:** `SERVICE_FQDN_<SERVICE>` / `SERVICE_URL_<SERVICE>` (nome do serviço do compose em maiúsculas), definidas nas Environment Variables do resource, geram domínio + labels do proxy automaticamente. Referência local: `.env.coolify` (gitignored — cole o conteúdo direto na aba de env vars da Coolify).
- **Deploy Webhook:** um único webhook por resource (aba Webhooks) dispara `docker compose build && up -d` do stack inteiro; front e back sobem juntos. O job `deploy` em `.github/workflows/ci.yml` chama esse webhook (via `secrets.COOLIFY_API_TOKEN`/`COOLIFY_DEPLOY_WEBHOOK`) só em **push na branch `development`**, depois que os jobs `backend`/`frontend` passam, e só quando `backend-nest/**`, `frontend-next/**` ou `docker-compose.yml` mudaram.
- **Atenção:** não publique a porta do Postgres (`ports: - "5432:5432"`) pra internet em produção — publish do Docker costuma ignorar regras de firewall/ufw. Acesso externo ao banco: túnel SSH.

### Múltiplos projetos, uma infra compartilhada

Cenário comum: várias aplicações derivadas deste template numa VPS só. Subir Postgres/Redis/S3 próprios
pra cada uma desperdiça a VPS à toa — os três engines já suportam isolamento lógico (banco, índice de
Redis, bucket) sem precisar de um processo por projeto.

`docker-compose.external-infra.yml` (raiz) é a mesma aplicação (`backend`+`frontend`) sem os serviços de
infra nem `depends_on` neles — só lê `DATABASE_URL`/`REDIS_URL`/`S3_*` apontando pra onde a infra já está.
Um projeto (o primeiro, ou um dedicado) sobe o `docker-compose.yml` de sempre (stack completo); os demais
usam o `external-infra.yml` e apontam pra essa mesma infra:

| Serviço | Isolamento por projeto |
|---|---|
| Postgres | `DATABASE_URL` com um **banco** diferente no mesmo servidor — `.../projeto1`, `.../projeto2` |
| Redis | `REDIS_URL` com um **índice de DB** diferente — `redis://host:6379/0`, `/1`, `/2`. Sem isso as filas do BullMQ (nome igual entre projetos, mesmo código) colidem no mesmo Redis |
| S3 (RustFS) | Mesmo bucket serve todos os projetos — `APP_NAME` diferente por projeto já isola a pasta (`${APP_NAME}/...`, ver [[storage]]), sem precisar de `S3_BUCKET` separado. A credencial (`RUSTFS_ACCESS_KEY`/`SECRET_KEY`) continua única pro container inteiro — não há policy por bucket, então qualquer projeto com a credencial alcança a pasta dos outros. Aceitável entre projetos do mesmo operador; não para clientes que exigem isolamento de credencial |

Por que dois arquivos autocontidos (com `backend`/`frontend` duplicados) em vez de um
`docker-compose.override.yml` que o Compose funde automaticamente: localmente funciona (`docker compose
up` já pega `docker-compose.yml` + `docker-compose.override.yml` juntos sem flag nenhuma), mas o Coolify lê
um único "Docker Compose Location" por resource e há relato de não fundir o override de forma confiável
([coollabsio/coolify#3841](https://github.com/coollabsio/coolify/issues/3841)). Dois arquivos completos
custam duplicação (replique se `backend`/`frontend` mudar), mas funcionam sem depender disso.

No Coolify, cada projeto é um resource **Docker Compose** separado:
- O que hospeda a infra: `Docker Compose Location: /docker-compose.yml` (igual à seção acima).
- Os demais: `Docker Compose Location: /docker-compose.external-infra.yml`, com `DATABASE_URL`/`REDIS_URL`/`S3_*`
  apontando pro primeiro. Se os resources estiverem no mesmo Project/rede do Coolify, o nome do serviço
  (`postgres`, `redis`, `s3`) resolve direto; em redes separadas, use o IP interno da VPS + a porta publicada.

#### Memória no build — VPS compartilhada entre vários projetos

Rodar várias aplicações derivadas deste template na mesma VPS multiplica a RAM que o **build** (não o
runtime) precisa, não só a dos containers em produção. Um único `docker compose build` builda
`backend`+`frontend` e dispara **3 `pnpm install` concorrentes** (deps do backend, prod do backend, deps
do frontend — cada stage do Dockerfile popula uma árvore `node_modules` diferente de propósito, pra manter
a imagem final pequena). Com o cache do pnpm/BuildKit frio — o que acontece sempre que outro projeto também
builda na mesma VPS e disputa o mesmo orçamento de cache, ou que uma limpeza de disco o esvazia —, os 3
processos baixam/extraem os pacotes do zero ao mesmo tempo, multiplicando o pico de RAM e CPU do build.

Numa VPS com RAM apertada e **sem swap**, esse pico pode disparar o OOM killer do kernel, que mata o
processo de build sem deixar mensagem de erro de `pnpm`/`node` — sintoma: o log do deploy só para no meio
de um `pnpm install` (ex.: trava em "Progress: resolved X, reused 0, downloaded Y, added Z") e a ferramenta
de deploy reporta um exit code genérico (ex.: `255`), sem indicar a causa.

Mitigação:
- **Swap no host é pré-requisito de infra, não configuração de uma app específica.** Recomendado pelo
  menos do tamanho da RAM total da VPS (ou do teto de `--max-old-space-size` do build do frontend, o que
  for maior) — sem isso não há fallback antes do OOM killer agir.
- `.npmrc` da raiz já limita `network-concurrency`/`child-concurrency` do pnpm, reduzindo o pico de RAM de
  cada install individual — vale pra qualquer servidor, sem precisar de config por ambiente.
- `NODE_OPTIONS=--max-old-space-size` no `frontend-next/Dockerfile` limita o teto de heap do build do
  Next — ajuste pra baixo se a VPS de destino tiver pouca RAM.
- Não existe equivalente no `docker-compose.yml`/`docker-compose.external-infra.yml` pra isso: o Compose
  spec não tem campo de memória/paralelismo pro processo de **build** (`deploy.resources.limits` só vale
  pro container em runtime, e só sob Swarm). Limitar quantos serviços buildam em paralelo é parâmetro de
  invocação do CLI (`COMPOSE_PARALLEL_LIMIT`), controlado por quem dispara o build (Coolify, CI, etc.), não
  pelo arquivo compose.

Ver [[run-locally]] para desenvolvimento.
