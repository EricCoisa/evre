---
title: Storage (multi-provider)
tags: [backend, storage]
---

# Storage (multi-provider)

`modules/storage/storage.service.ts` — facade que resolve, em runtime, qual provider de
armazenamento usar. Provider e credenciais vêm de `SystemConfiguration`, configurados em `/settings`
(aba **Armazenamento**), com as variáveis de ambiente `S3_*` / `STORAGE_*` como fallback.

## API pública

Toda leitura de configuração acontece por chamada, então **todo método é `async`** exceto `buildKey`.

```ts
class StorageService {
  upload(key, buffer, contentType): Promise<string>                  // retorna a key
  delete(key): Promise<void>                                         // best-effort (loga warn se falhar)
  getPublicUrl(key): Promise<string>                                 // URL pública do provider ativo
  getPresignedUrl(key, ttlSeconds?): Promise<string>                 // URL assinada do provider ativo
  validateConfiguration(): Promise<ProviderResult>                   // valida o que está gravado
  validateCandidate(candidate): Promise<ProviderResult>              // valida credencial ainda não gravada
  checkHealth(): Promise<{ operational: boolean, reason?: string }>  // serve do cache Redis (TTL 300 s)
  invalidateHealthCache(): Promise<void>                             // derruba a chave `storage:health`
  buildKey(prefix, ext): string                                      // `<prefix>/<uuid>.<ext>` — único síncrono
  resolveKeyFromUrl(url): Promise<string | null>                     // key a partir da URL do provider ATIVO
  resolveFileFromUrl(url): Promise<{ provider, key } | null>         // acha o dono entre S3 e LOCAL
  getLocalStorageDir(): Promise<string>                              // diretório resolvido do provider LOCAL
}
```

`resolveKeyFromUrl` só reconhece URL do provider ativo; `resolveFileFromUrl` testa S3 **e** LOCAL e
devolve o provider dono junto da key, então arquivo gravado antes de uma troca de provider continua
legível sem migração. `getLocalStorageDir` é o que o `main.ts` usa para montar o `useStaticAssets`.

Injete via `StorageModule` (`modules/storage/storage.module.ts`).

## Providers disponíveis

| Provider | Engine | Descrição |
|----------|--------|-----------|
| `S3StorageService` | `S3` | AWS S3, RustFS, Cloudflare R2, DO Spaces — qualquer endpoint S3-compatível |
| `LocalStorageService` | `LOCAL` | Filesystem local; serve os arquivos em `/uploads/<key>` via NestJS static assets |

### S3 (default)

Cada chave é lida do banco e, quando ausente, da variável de ambiente correspondente. Para trocar
credenciais em runtime, use `/settings → Armazenamento`.

| Chave DB | Fallback ENV | Default |
|----------|-------------|---------|
| `SYSTEM_STORAGE_S3_ENDPOINT` | `S3_ENDPOINT` | `http://localhost:8333` |
| `SYSTEM_STORAGE_S3_REGION` | `S3_REGION` | `us-east-1` |
| `SYSTEM_STORAGE_S3_BUCKET` | `S3_BUCKET` | `app-uploads` |
| `SYSTEM_STORAGE_S3_ACCESS_KEY` | `S3_ACCESS_KEY` | — |
| `SYSTEM_STORAGE_S3_SECRET_KEY` | `S3_SECRET_KEY` | — |
| `SYSTEM_STORAGE_S3_PUBLIC_URL` | `S3_PUBLIC_URL` | `http://localhost:8333/app-uploads` |

Default alinhado com a porta real do RustFS no `docker-compose.yml` (8333) — era `9000` (porta do
MinIO antigo), corrigido em `storage.service.ts`, `storage.service.spec.ts`,
`backend-nest/.env.example` e `save-storage-config.dto.ts` (exemplo do Swagger).

## `APP_NAME` — isolamento entre projetos no mesmo bucket

Vários projetos derivados deste template numa VPS só podem compartilhar o mesmo bucket S3 (ver
[[deploy]] § "Múltiplos projetos, uma infra compartilhada") sem bucket por projeto — desde que cada
um tenha um `APP_NAME` diferente. `StorageService.buildKey(prefix, ext)` monta
`${APP_NAME}/${prefix}/<uuid>.<ext>` — a pasta de cada app nunca se mistura com a de outro, mesmo
no mesmo bucket, mesma credencial.

`main.ts` recusa subir (`process.exit(1)`) se `APP_NAME` estiver vazio — a checagem é só
presença, não valida o conteúdo (mesmo critério do resto dos segredos `REPLACE_WITH_*`, que também
não são validados em código). Dois projetos que copiarem o `.env.example` da raiz sem editar
`APP_NAME` ainda convergem no mesmo valor literal `REPLACE_WITH_APP_NAME` — a guarda impede o
caso comum (esquecer por completo), não esse. `backend-nest/.env.example` já vem com um valor real
(`template`) pra não travar o `pnpm dev` local.

Isso cobre uploads da app Nest (avatar); o storage do CMS (abaixo) tem seu próprio prefixo. O mesmo
`APP_NAME` isola filas BullMQ, cache/lock/pub-sub (`RedisService`) e rate limit quando vários
projetos compartilham a mesma instância Redis — ver [[queues-and-jobs]] § "`APP_NAME`".

Não confundir com `SYSTEM_APP_NAME` — chave em `SystemConfiguration`, editável em runtime, usada só
como nome de exibição do remetente nos emails de convite/reset (`generate-invite.use-case.ts`,
`request-password-reset.use-case.ts`). `APP_NAME` é env var fixa, lida uma vez no boot, e não tem
nada a ver com branding — só isola a pasta no storage.

`forcePathStyle: true` (necessário para RustFS/MinIO). O container RustFS (`s3` no compose,
image `rustfs/rustfs`) está no `docker-compose.yml` — portas 8333 API / 9001 console. Um
init container (`s3-perms`) ajusta a permissão do volume antes dele subir, porque a imagem
roda como uid/gid `10001` e o volume nasce `root`. `s3-init` (via `amazon/aws-cli`, já que
`minio/mc` saiu do Docker Hub) cria o bucket no primeiro boot. Ver [[run-locally]].

> **Nota histórica:** este container já foi `minio/minio`; a MinIO removeu suas imagens do
> Docker Hub (e depois bloqueou o mirror do quay.io também) em 2026-09, forçando a troca.

### LOCAL

Grava arquivos em disco. Adequado para desenvolvimento (sem servidor S3) e deploys single-node self-hosted.

> **Nota:** `LocalStorageService` usa disco local — não compartilhado entre réplicas. Para escala
> horizontal, use S3.

| Chave DB | Fallback ENV | Default |
|----------|-------------|---------|
| `SYSTEM_STORAGE_LOCAL_DIR` | `STORAGE_LOCAL_DIR` | `./uploads` |
| `SYSTEM_STORAGE_PUBLIC_BASE_URL` | `STORAGE_PUBLIC_BASE_URL` | `http://localhost:3001` |

O NestJS serve os arquivos em `/uploads/<key>` (via `useStaticAssets` em `main.ts`), **fora** do
prefixo global `api/v1` — por isso o default aponta para a porta do **backend** (3001), não do
front. O `next.config.ts` já tem `remotePatterns` para `localhost:3001/uploads/**` (LOCAL) e
`localhost:8333/**` (S3/RustFS), mais um padrão `https://**/uploads/**` para host customizado via
`SYSTEM_STORAGE_PUBLIC_BASE_URL`.

## Endpoints

| Método | Rota | Auth | O que faz |
|---|---|---|---|
| `PUT` | `/api/v1/storage/config` | ADMIN | Valida o formulário contra o provider e persiste só se passar |
| `GET` | `/api/v1/storage/health` | autenticado | Saúde do provider ativo, servida do cache |
| `GET` | `/api/v1/storage/file?key=` | anônima | URL pré-assinada para uma key ou para a URL pública salva |

### `PUT /storage/config` — validar e salvar num passo

`SaveStorageConfigurationUseCase` monta um **candidato** com os valores do formulário, chama
`validateCandidate` e só grava depois do `assertProviderOk`. Credencial ruim devolve 400 com a
mensagem do provider e o banco não muda.

1. Abra `/settings` → aba **Armazenamento**.
2. Selecione o provider em **Provedor de armazenamento** (`S3` ou `LOCAL`).
3. Preencha as credenciais/configurações do provider escolhido.
4. Salve. A mudança entra em vigor na próxima operação de upload/delete, sem reiniciar o servidor.

Dois comportamentos do use-case:

- **Segredo em branco mantém o gravado** (`keepStoredWhenBlank`), porque o GET devolve `****` e não o
  valor. Ver [[system-configuration]].
- **Salvar um provider não apaga as chaves do outro.** Só as chaves do provider escolhido são
  escritas — é isso que deixa `resolveFileFromUrl` continuar lendo arquivo antigo do provider inativo.

### `GET /storage/file` — leitura de arquivo

Anônima e por query param (a URL salva contém `/`, que não cabe em segmento — ver [[api-conventions]]).
Recebe a key **ou** a URL pública gravada em `user.imageUrl`; `resolveFileFromUrl` identifica o dono
entre S3 e LOCAL e devolve `{ url }` pré-assinada por aquele provider.

## Health-check com cache

`GET /api/v1/storage/health` — qualquer usuário autenticado. Retorna
`{ operational: boolean, reason?: string }`.

O health-check é **sempre servido a partir do cache Redis** (chave `storage:health`, TTL 300 s).
`SaveStorageConfigurationUseCase` chama `invalidateHealthCache()` depois de gravar, e
`UpdateSystemConfigurationUseCase` derruba a mesma chave ao escrever qualquer `SYSTEM_STORAGE_*` —
então a chamada seguinte revalida ao vivo.

Ele atende a três usos: conferir conectividade sem bloquear a UI (o hook do front cacheia 4 min, abaixo
do TTL do backend), desabilitar botões de upload quando o provider está fora, e alimentar dashboard de
observabilidade. O padrão de consumo no front está em [[service-health-gate]].

**Comportamento de cache:**
1. Hit: devolve o resultado cacheado.
2. Miss: chama `validateConfiguration()` do provider, cacheia por 300 s e devolve.
3. Invalidação: gravar configuração de storage deleta `storage:health`.

## Storage do CMS (Payload)

O **Payload CMS** tem o próprio storage S3 (`@payloadcms/storage-s3`) para mídia do CMS, via plugin,
em `frontend-next/payload.config.ts`. **Este facade não cobre o CMS** — apenas uploads da app Nest
(hoje: avatar de usuário).

O plugin também recebe `APP_NAME` como `collections: { media: { prefix: process.env.APP_NAME } }` —
mesmo isolamento por app do `buildKey` acima, mecanismo nativo do `@payloadcms/storage-s3`
(`collectionPrefix`), sem código extra. Diferente do backend, o Payload **não** valida `APP_NAME` no
boot — se vier vazio, o plugin só usa `''` como prefixo (sem a guarda do `main.ts`, que só existe no
processo Nest).

A diferença importa porque os dois lêem as **mesmas variáveis** (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`,
`S3_SECRET_KEY`, `S3_REGION`) mas de jeitos diferentes:

- **Backend** (`StorageService.readS3Config`): banco (`SystemConfiguration`, editável em `/settings`)
  → env var → literal embutido. É um fallback de três camadas, não uma configuração fixa — a env var só
  importa até o admin salvar algo na tela.
- **Payload** (`payload.config.ts`): só `process.env.S3_*` com `??` para um literal, resolvido uma vez
  no build/boot do Next.js. **Não há tela admin para isso** — trocar credencial do storage do CMS é
  trocar variável de ambiente e reiniciar o container, não um formulário em `/settings`.

Por isso o compose/`.env` continuam declarando essas chaves mesmo o backend sendo "configurável pela
plataforma": pra ele são só o default de primeiro boot (antes de qualquer admin configurar nada em
`/settings`) e o caminho de desastre (se a `SystemConfiguration` for apagada); pro Payload, são a
**única** fonte — não tem outra.

### Limitação conhecida: Payload não acompanha troca de provider em runtime

`s3Storage({...})` roda **uma vez**, de forma síncrona, dentro do `buildConfig()` do Payload — não
dá pra `await` nada ali. Duas consequências:

- **Trocar bucket/credenciais continuando S3** seria possível de resolver (o `getStorageClient` do
  plugin já é uma função chamada a cada upload, só não re-lê a config — daria pra trocar por
  `createS3Adapter` direto + um cache curto nosso, refrescado via HTTP no backend reaproveitando o
  mecanismo de `AGENT_CMS_SECRET`). Não implementado: ganho baixo pra um único projeto, e a forma
  certa do cache provavelmente muda quando "tenant" virar conceito real (a chave deixa de ser
  global).
- **Trocar de provider (S3 ↔ LOCAL) nunca é dinâmico** — `disableLocalStorage: true` é gravado na
  collection dentro do `buildConfig()`, antes de qualquer chamada assíncrona ser possível. Isso é
  limite da arquitetura do `@payloadcms/plugin-cloud-storage`, não escolha deste template: trocar o
  provider do storage do CMS sempre exige reiniciar o container do frontend.

---

## Tools do agente

| Tool | O quê |
|---|---|
| `get_storage_config` | provider, endpoint/região/bucket (ou dir/baseUrl) **+ health**. Credenciais só como `'configurado'`/`'não configurado'` — o valor nunca sai |
| `save_storage_config` | reusa o mesmo use-case do `PUT /storage/config`, então valida no provider antes de gravar e mantém credencial omitida |

Ambas `roles: ['ADMIN']`; a escrita exige o scope `system-configuration:write`. As chaves
`SYSTEM_STORAGE_*` são **recusadas** por `update_system_configuration` justamente para o
agente não gravar credencial sem validar — ver [[ai-tools]].

## Como adicionar um provider

1. **Criar o DTO de config** — `src/modules/storage/dto/x-config.dto.ts`:
   ```ts
   export class XConfigDto {
     apiKey: string;
     bucket: string;
     // ...
   }
   ```

2. **Criar o provider** — `src/modules/storage/providers/x-storage.service.ts`:
   ```ts
   @Injectable()
   export class XStorageService implements IStorageService<XConfigDto> {
     use(cfg: XConfigDto): IStorageProvider {
       return {
         upload: (key, buf, ct)        => ...,   // Promise<string>
         delete: (key)                 => ...,   // Promise<void>
         getPublicUrl: (key)           => `${cfg.baseUrl}/${key}`,   // síncrono
         getPresignedUrl: (key, ttl?)  => ...,   // Promise<string>
         validateConfiguration: ()     => ...,   // Promise<ProviderResult>
       };
     }
   }
   ```
   `getPublicUrl` é o único síncrono da interface — `resolveFileFromUrl` a chama em loop para
   descobrir o dono de uma URL, sem `await` por candidato.

3. **Registrar no `StorageEngineConst`** — `src/domain/storage/storage.const.ts`:
   ```ts
   export const StorageEngineConst = { S3: 'S3', LOCAL: 'LOCAL', X: 'X' } as const;
   ```

4. **Adicionar o `case` no facade** — `storage.service.ts`:
   ```ts
   case StorageEngineConst.X:
     return this.x.use(await this.readXConfig());
   ```
   Implementar `readXConfig()` com `readConfigValue('SYSTEM_STORAGE_X_*')`.

5. **Adicionar ao módulo** — `storage.module.ts`:
   ```ts
   providers: [StorageService, S3StorageService, LocalStorageService, XStorageService],
   ```

6. **Seed** — `prisma/seeds/system-config.seed.ts`: adicionar chaves `SYSTEM_STORAGE_X_*` no bloco `sysConfigs`.

7. **i18n** — `frontend-next/src/locales/{pt-BR,en}/settings.json`: adicionar labels das chaves.

8. **UI** — `settings/page.tsx`: adicionar `{data?.value == StorageProvider.X && (...)}` com as
   `<ConfigRow>` das chaves do provider.

9. **`next.config.ts`** — se o provider tiver URL pública com host diferente, adicionar em
   `images.remotePatterns`.
