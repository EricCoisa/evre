---
title: System Configuration
tags: [backend, configuration]
---

# System Configuration

Configurações globais da aplicação em runtime, armazenadas no banco. Evita redeploy para ajustar parâmetros operacionais.

Módulo: `SystemConfigurationModule` · Prefixo: `/system-configuration` · Modelo Prisma: `SystemConfiguration` (`system_configurations`).

## Modelo

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `labelKey` | `string` (único) | Identificador da config. Ex.: `SYSTEM_STORAGE_S3_ENDPOINT` |
| `value` | `string` | Valor serializado como string |
| `valueType` | `ConfigValueType` | `STRING`, `NUMBER`, `BOOLEAN`, `JSON`, `DATE`, `ENUM` (`prisma/schema/base.prisma`) |
| `options` | `string[]` | Valores aceitos quando `valueType: ENUM` |
| `secret` | `boolean` | `true` → gravado criptografado (`CryptoService`), mascarado como `****` na resposta HTTP |
| `blocked` | `boolean` | `true` → `update` e `remove` respondem 403, inclusive para ADMIN |
| `updatedAt` | `DateTime` | Atualizado pelo Prisma |

O model **não tem** campo de descrição: o que a chave significa mora no seed e nas
constantes de `domain/system-configuration/`.

## Leitura no código (outros serviços)

Injete `SystemConfigurationService`. Dois métodos, e a diferença é o que acontece
quando a chave não existe:

```ts
// Lança NotFoundException se não existir. Descriptografa secret e converte pelo valueType.
const config = await this.sysConfig.findByLabelKey('MINHA_CHAVE');

// Devolve null se não existir. Para config opcional.
const raw = await this.sysConfig.getValueOrNull('MINHA_CHAVE');
```

Os dois leem por `findRaw`, que cacheia no Redis com TTL de
`CONFIG_CACHE_TTL` (300 s) — ver *Cache* abaixo.

Exemplo real: `modules/storage/storage.service.ts` — lê `SYSTEM_STORAGE_*` para resolver o provider de storage em runtime.

## Adicionar uma nova config

### 1. Definir a chave no seed

`backend-nest/prisma/seeds/system-config.seed.ts` — adicione no array `sysConfigs`:

```ts
{ labelKey: 'MINHA_FEATURE_TIMEOUT', valueType: 'NUMBER', value: '30' },
```

Os campos aceitos pelo array são `labelKey`, `valueType`, `value`, `options?`, `secret?` e `blocked?`
— **não existe `description`**. O que a chave significa fica no label i18n da tela e nas constantes de
`domain/system-configuration/`.

O upsert do seed nunca sobrescreve `value` (é estado do admin); ele reescreve só `blocked` e `secret`,
que não são editáveis por API.

### 2. Ler no serviço

```ts
constructor(private readonly sysConfig: SystemConfigurationService) {}

async myMethod() {
  const config = await this.sysConfig.findByLabelKey('MINHA_FEATURE_TIMEOUT');
  // config.value é number (convertido pelo valueType NUMBER)
}
```

### 3. Expor na UI (opcional)

`frontend-next/src/app/(private)/(admin)/settings/page.tsx` — adicione uma `<ConfigRow>` para a nova chave se ela for editável pelo admin.

Adicione o label em `src/locales/{en,pt-BR}/settings.json`.

Mecânica completa do widget (camadas, `forceType`, a armadilha do `disableLabel`/`description`
duplicado, e por que `SystemConfiguration`/`UserConfiguration` precisam ficar simétricos): ver
[[config-rows]].

## Endpoints

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `GET` | `/system-configuration` | ADMIN | Lista todas (paginável, `?search=`); valores `secret` mascarados |
| `GET` | `/system-configuration/:id` | ADMIN | Busca por ID |
| `GET` | `/system-configuration/key/:labelKey` | ADMIN | Busca por chave |
| `POST` | `/system-configuration` | ADMIN | Cria |
| `PATCH` | `/system-configuration/:id` | ADMIN | Atualiza `value`, `valueType`, `options`, `secret` |
| `DELETE` | `/system-configuration/:id` | ADMIN | Remove |
| `GET` | `/system-configuration/signup` | **anônima** | Só a chave `SYSTEM_USER_CREATE` — o `/signup` precisa saber se o cadastro está aberto |
| `GET` | `/system-configuration/default-theme` | **anônima** | Só a chave `SYSTEMCONFIG_THEME` |
| `GET` | `/system-configuration/app-name` | **anônima** | Só a chave `SYSTEM_APP_NAME` |
| `GET` | `/system-configuration/app-tagline` | **anônima** | Só a chave `SYSTEM_APP_TAGLINE` |

As quatro rotas anônimas são chaves específicas com rota própria, e ficam **antes** de `:id` no
controller (senão `signup` casaria como id). A rota genérica continua ADMIN — é o mesmo padrão que o
PageBuilder usa em `GET /page-builder/system-layout`, descrito abaixo.

`app-name`/`app-tagline` (Ajuste 1) existem para a página pública de proposta mostrar quem está
propondo sem exigir sessão — mesma anatomia de `signup`/`default-theme`: `findByLabelKey$` já
injetado, zero DTO novo, zero use-case novo, só a chave muda.

## Configs existentes no seed

- Identidade do app: `SYSTEM_APP_NAME` (valor default `'EVRE'` — troque por instalação) e
  `SYSTEM_APP_TAGLINE` (nasce **vazio**, `''`: é texto de negócio por instalação, o template não
  assume um descritor). Lidas pelas duas rotas anônimas acima; nenhuma tela de `/settings` edita
  ainda — só via seed/DB direto.
- Storage: `SYSTEM_STORAGE_S3_*` e `SYSTEM_STORAGE_LOCAL_*` — ver [[storage]].
- Provider ativo: `SYSTEM_STORAGE_PROVIDER` (`S3` ou `LOCAL`).
- Log retention: `SYSTEM_LOG_RETENTION_DAYS`.
- Layout padrão de página: `PAGE_LAYOUTS` (`JSON`) — ver [[page-builder]].
- OAuth: `SYSTEM_OAUTH_<PROVIDER>_{ISSUER,CLIENT_ID,CLIENT_SECRET}` — ver [[oauth]].
- Notificação por canal: `SYSTEM_NOTIFICATION_EMAIL_ENABLED`/`SYSTEM_NOTIFICATION_WHATSAPP_ENABLED`
  (`BOOLEAN`, nasce `true`) — liga/desliga o relay por canal pra plataforma inteira, mesmo padrão de
  `SYSTEM_CAPTCHA_ENABLED`/`SYSTEM_SENTRY_ENABLED`. Ver [[notifications]].

### `SYSTEM_OAUTH_*`: três chaves por provider

Login social é o caso mais literal do padrão desta nota: o fluxo é agnóstico e o provider entra só como
configuração. Cada um tem exatamente `SYSTEM_OAUTH_<ID>_ISSUER`, `_CLIENT_ID` e `_CLIENT_SECRET`
(esta última com `secret: true`).

Vale notar a semântica de "vazio": ao contrário de storage e email, **não existe uma chave de provider
ativo**. Um provider é considerado utilizável quando as três chaves estão preenchidas — o que deixa o
admin preparar credenciais sem que o botão apareça pela metade no `/login`.

### `PAGE_LAYOUTS`: a exceção ao "ADMIN only"

Quase toda config do sistema só interessa a quem administra, e a tabela de endpoints acima reflete isso. `PAGE_LAYOUTS` é diferente: ela descreve a **tela** de quem não customizou nada, então precisa ser lida por qualquer usuário autenticado.

Em vez de afrouxar `GET /system-configuration/key/:labelKey` (o que abriria *todas* as chaves, inclusive as `secret`), o PageBuilder expõe uma leitura dedicada: `GET /page-builder/system-layout`. Mesmo padrão dos endpoints `signup` e `default-theme` deste módulo — **uma chave específica ganha rota própria com a auth que ela precisa**, e a rota genérica continua fechada. Escrever segue restrito a ADMIN, e passa por `SystemConfigurationService.update`, então entra no log de auditoria como qualquer outra alteração.

## Chaves de provider validado (storage, email, captcha)

As chaves `SYSTEM_STORAGE_*`, `SYSTEM_EMAIL_*` e as três de credencial do captcha
(`SYSTEM_CAPTCHA_PROVIDER/SITE_KEY/SECRET_KEY`) moram aqui, mas **não devem ser escritas chave a
chave**: cada provider só funciona com o conjunto coerente, e os use-cases `save-configuration`
de cada um validam contra o provider real antes de gravar.

Pela API isso é convenção. Pelo agente é imposto: as tools
`create/update/delete_system_configuration` recusam essas chaves e apontam
`save_storage_config` / `save_email_config` / `save_captcha_config`. Ver
`src/domain/system-configuration/typed-config-keys.const.ts` e [[ai-tools]].

`SYSTEM_CAPTCHA_ENABLED` é exceção — é só o liga/desliga, não valida credencial.

`SYSTEM_SENTRY_DSN` segue a mesma convenção (o `SaveSentryConfigUseCase` sonda o DSN no servidor do
Sentry antes de gravar — ver [[observability]]), mas **não** está registrado no
`typed-config-keys.const.ts`: não existe tool típada para a qual apontar, então bloqueá-lo tiraria a
capacidade do agente sem substituto. Mesmo tratamento de `SYSTEM_AI_*` e `SYSTEM_OAUTH_*`.
`SYSTEM_SENTRY_ENABLED` é liga/desliga, como o do captcha.

## Declarar requisitos de uma chave

Uma chave pode depender de um recurso estar configurado/vivo para funcionar de verdade (ex.:
`SYSTEM_NOTIFICATION_EMAIL_ENABLED` só faz sentido com `EMAIL` operacional). Em vez de cada tela
escrever manualmente "desabilita se X não estiver pronto", ligue a chave a uma capability no módulo
dono do recurso:

```ts
// no onModuleInit de um *.capabilities.ts — nunca neste módulo
this.capabilities.requires('SYSTEM_NOTIFICATION_EMAIL_ENABLED', [EMAIL_CAPABILITY]);
```

A partir daí, `GET /system-configuration/key/:labelKey` e `GET /system-configuration` passam a
preencher `requirements` nessa linha (`{hidden, disabled, reason?, fixPath?, capability?}`), resolvido
uma vez por request e feito o join em memória — nunca por linha. No frontend, troque
`<SystemConfiguration>` por `<SystemConfigurationRow>` para o gate aparecer sem nenhum código manual
de disabled/hint. Mecanismo completo, inclusive os 3 estados e quem vê `reason`: [[capabilities]].

## Segurança

Campos com `secret: true` são gravados criptografados com `CryptoService` (PBKDF2 + AES). A chave de criptografia vem de `CRYPTO_SECRET` no `.env`. Nunca grave segredos sem `secret: true`.

## Cache

`findRaw` cacheia cada `labelKey` no Redis (`sysconfig:<labelKey>`) por
`CONFIG_CACHE_TTL` = 300 s, incluindo o miss (sentinela `CONFIG_CACHE_MISS`). Os
use-cases de `update` e `remove` invalidam a chave que mudaram.

`create` e `update` **não** consultam o cache para checar unicidade de `labelKey`:
um miss velho deixaria passar duplicata e o 409 viraria erro de constraint.

> [!warning] Escrita fora dos use-cases não invalida
> Quem escreve direto no Prisma — `prisma:seed`, migration, SQL manual — não passa
> pela invalidação. Sem limpar `sysconfig:*`, a mudança fica invisível por até 5 min
> e parece que não funcionou. O seed já faz isso em
> `invalidateSystemConfigCache` (best-effort: segue sem Redis no ar).

## Chaves bloqueadas (`blocked`)

`blocked: true` faz `update` e `remove` responderem 403 mesmo para ADMIN, e o front
renderiza o campo desabilitado (`system-configuration.tsx` passa
`isPending={... || !!data?.blocked}`).

`blocked` **não está em nenhum DTO** de create/update: não é estado que o admin
gerencia, é invariante de instalação. Só o seed define. Por isso o `update` do upsert
do seed reescreve `blocked` e `secret` a cada execução: é o único caminho que alcança
uma base já existente, já que nenhum DTO expõe esses campos.

Hoje bloqueadas: `SYSTEMID` e `SYSTEMTOKEN` — identidade da instalação junto ao
suporte (ver `clientLog`), mudam por provisionamento e não por tela.
`src/domain/system-configuration/blocked-keys.spec.ts` falha se a trava sair do seed.
