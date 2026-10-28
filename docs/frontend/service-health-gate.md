---
title: Service Health Gate
tags: [frontend, backend, pattern, redis, react-query]
---

# Service Health Gate

Padrão de **nível 1** para **desabilitar automaticamente** qualquer elemento de UI que dependa de UM
serviço externo autocontido (storage, SMS, pagamento, etc.) quando esse serviço está inoperante — sem
que o componente pai precise saber disso.

> **Implementação de referência:** [[storage]].

> [!info] Isto é o nível 1. Para composição, use [[capabilities]]
> Este padrão serve um serviço isolado, sem dependência de feature flag nem de outro recurso — é o
> que `health()` + um hook fazem sozinhos. No momento em que o gate precisa (a) esconder por feature
> flag além de desabilitar por configuração, (b) compor com outro recurso (um canal que depende de
> email ou de WhatsApp), ou (c) aparecer automaticamente na linha de uma `SystemConfiguration`/
> `UserConfiguration` sem código de tela manual — isso é [[capabilities]], que generaliza exatamente
> este mecanismo (`validateConfiguration` → `checkHealth` → cache Redis) por trás de um registry.
> `EMAIL` e `MESSAGING` migraram para capability por isso; `STORAGE` fica neste padrão porque não
> compõe com nada.

---

## O problema

Componentes que disparam ações dependentes de um serviço externo (upload, envio de email, etc.) precisam refletir se aquele serviço está funcionando. Sem isso, o usuário tenta a ação, ela falha no backend, e recebe uma mensagem de erro genérica.

---

## Visão geral da solução

```
[Backend] validateConfiguration() → checkHealth() → Redis (TTL 300s) → GET /service/health
                                                           ↑
                                              invalidado ao salvar SYSTEM_SERVICE_*

[Frontend] useServiceHealth() → <ServicoComponent> (autodesabilitado)
```

O health-check é servido sempre do cache. A invalidação acontece de forma síncrona no `UpdateSystemConfigurationUseCase`, antes do retorno da request de salvar.

---

## Camadas do padrão

### 1. Backend — `validateConfiguration()` no provider

Cada provider deve implementar `validateConfiguration()` fazendo um **teste real de conectividade**, não apenas instanciar o cliente:

```ts
// Arquivo: src/common/infrastructure/service-x/providers/x.provider.ts
private async _validate(): Promise<ProviderResult> {
  try {
    // Menor operação possível que comprova acesso real
    await client.ping(); // ou HeadBucket, email.get(uuid), etc.
    return { status: true, data: 'OK' };
  } catch (err) {
    return { status: false, data: String((err as Error)?.message ?? err) };
  }
}
```

`ProviderResult` (`src/domain/interface/provider-result.ts`) = `{ status: boolean; data: string }`.

> ⚠️ **Em falha, `data` é a mensagem para humano — texto puro, nunca JSON.** Esse texto vira o `reason` do health e o toast de erro ao salvar a configuração. Serializar o objeto de erro faz a tela exibir `{"message":"…"}`. Ver [[error-handling]].

### 2. Backend — `checkHealth()` no service

O service principal do módulo expõe `checkHealth()` com cache Redis:

```ts
// Arquivo: src/modules/service-x/service-x.service.ts
const SERVICE_HEALTH_KEY = 'service-x:health';
const SERVICE_HEALTH_TTL = 300; // segundos

async checkHealth(): Promise<{ operational: boolean; reason?: string }> {
  const cached = await this.redis.get(SERVICE_HEALTH_KEY);
  if (cached !== null) return JSON.parse(cached);

  const res = await this.validateConfiguration();
  const result = {
    operational: res.status,
    ...(res.status ? {} : { reason: String(res.data) }),
  };
  await this.redis.set(SERVICE_HEALTH_KEY, JSON.stringify(result), SERVICE_HEALTH_TTL);
  return result;
}
```

`RedisService` é `@Global` — injete diretamente sem importar o módulo Redis.

### 3. Backend — endpoint `GET /service-x/health`

```ts
// Arquivo: src/modules/service-x/service-x.controller.ts
@GetApi({
  path: 'health',
  summary: 'Saúde do serviço (via cache)',
  status: 'OK',
  authenticated: true,
})
async health(): Promise<{ operational: boolean; reason?: string }> {
  return this.checkServiceHealth.execute();
}
```

**Quem pode ler depende de quem consome o gate.** `GET /storage/health` é `authenticated: true` sem
roles, porque o componente de upload que se autodesabilita roda para qualquer usuário. Se o único
consumidor fosse uma tela de admin, a rota ganharia `roles: ['ADMIN']` — exigir ADMIN num health que a
UI comum precisa ler transforma o gate em 403.

> `GET /email/health` existe (é template: projeto derivado pode chamá-la) mas não tem mais consumidor
> no frontend deste repo — `EMAIL` virou capability (ver [[capabilities]]), e `EmailCapabilities`
> reusa o mesmo `EmailService.checkHealth()` por baixo do registry.

### 4. Backend — invalidação síncrona ao salvar configuração

Em `UpdateSystemConfigurationUseCase`, adicione o par `[prefix, cacheKey]` na constante `CACHE_INVALIDATIONS` existente:

```ts
// Arquivo: src/modules/system-configuration/use-cases/update.use-case.ts
const CACHE_INVALIDATIONS: Array<[prefix: string, key: string]> = [
  ['SYSTEM_EMAIL_',   'email:health'],
  ['SYSTEM_STORAGE_', 'storage:health'],
  ['SYSTEM_X_',       'service-x:health'],  // ← adicionar
];
```

A invalidação já é síncrona e acontece **antes** do `void actionFire()` — sem race condition.

### 5. Frontend — action e tipo

```ts
// Arquivo: src/lib/actions/service-x/api.ts
"use server";
export async function getServiceXHealth(): Promise<ApiResponse<ServiceXHealthStatus>> {
  return await GET<ServiceXHealthStatus>('/service-x/health');
}
```

```ts
// Arquivo: src/lib/actions/service-x/types.ts
export interface ServiceXHealthStatus {
  operational: boolean;
  reason?: string;
}
```

### 6. Frontend — hook React Query

```ts
// Arquivo: src/lib/actions/service-x/queries.ts  (ou user/queries.ts se compartilhado)
export function useServiceXHealth() {
  return useQuery({
    queryKey: ['service-x', 'health'],
    queryFn: Collector(getServiceXHealth),
    staleTime: 1000 * 60 * 4,     // 4 min — abaixo do TTL 300s do cache backend
    refetchOnWindowFocus: false,
  });
}
```

`Collector` desempacota o envelope `ApiResponse<T>` automaticamente. Ver [[server-actions]].

### 7. Frontend — componente autogerenciado

O componente que dispara a ação chama o hook internamente e se desabilita sozinho:

```tsx
// Exemplo: src/components/meu-upload.tsx
'use client';
import { useServiceXHealth } from '@/lib/actions/service-x/queries';

export function MeuUpload({ disabled, ...props }: UploadProps) {
  const { data: health } = useServiceXHealth();
  const isDisabled = disabled || health?.operational === false;
  // health?.operational === false  ≠  !health?.operational
  // false explícito desabilita; undefined (carregando) não desabilita

  return <input disabled={isDisabled} {...props} />;
}
```

> **Por que `=== false` e não `!health?.operational`?**
> Enquanto o resultado ainda está carregando, `health` é `undefined`.
> `undefined === false` → `false` → componente habilitado durante o loading.
> `!undefined` → `true` → componente erroneamente desabilitado durante o loading.

### 8. Frontend — invalidar cache do frontend ao salvar configuração

Nos `<SystemConfiguration>` da tela de configuração do serviço, passe `invalidateKeys`:

```tsx
// Arquivo: src/app/(private)/(admin)/settings/components/service-x-config-tab.tsx
const serviceXInvalidate = [['service-x', 'health']];

<SystemConfiguration
  labelKey="SYSTEM_X_SOME_KEY"
  invalidateKeys={serviceXInvalidate}
/>
```

`SystemConfiguration` chama `queryClient.removeQueries({ queryKey: key })` após salvar com sucesso. `removeQueries` (não `invalidateQueries`) porque o `QueryClient` global tem `refetchOnMount: false` — `invalidate` marca como stale mas não força refetch ao montar. Ver [[server-actions]].

---

## Gate em listas / actions (ex: botão de envio)

Quando a ação fica em um botão (não num componente de upload) e o serviço é de nível 1 (sem flag, sem
composição), o padrão é diferente — o gate vai no nível do caller, não do botão:

```tsx
const { data: health } = useServiceXHealth();
const serviceOperational = health?.operational ?? true;

<Button disabled={!serviceOperational} onClick={handleAction}>
  Executar ação
</Button>
{!serviceOperational && (
  <p className="text-sm text-muted-foreground">{t('service_x_disabled_hint')}</p>
)}
```

> `invite-tab.tsx` usava este padrão com `emailOperational`/`useEmailHealth` antes de `EMAIL` virar
> capability. Hoje usa `<CapabilityGate name={CAPABILITIES.email}>` em volta do botão — ver
> [[capabilities]]. Use o padrão acima só para um serviço que **não** tenha migrado para capability.

---

## Checklist — adicionar o padrão a um novo serviço

- [ ] Provider implementa `validateConfiguration()` com teste real (não apenas instanciar o cliente)
- [ ] Em falha, `data` é texto para humano (`err.message`), não `JSON.stringify(err)`
- [ ] Service expõe `checkHealth()` com Redis (TTL 300s) usando `SERVICE_X_HEALTH_KEY`
- [ ] Controller expõe `GET /service-x/health` (`authenticated: true`; `roles: ['ADMIN']` só se nenhum consumidor comum precisar ler)
- [ ] `CACHE_INVALIDATIONS` em `update.use-case.ts` tem o par `['SYSTEM_X_', 'service-x:health']`
- [ ] Action `getServiceXHealth()` e tipo `ServiceXHealthStatus` no frontend
- [ ] Hook `useServiceXHealth()` com `staleTime: 1000 * 60 * 4` e `refetchOnWindowFocus: false`
- [ ] Componente de ação usa `health?.operational === false` (não `!health?.operational`)
- [ ] `<SystemConfiguration>` da tela de configuração tem `invalidateKeys={[['service-x', 'health']]}`

---

## Arquivos de referência

| Camada | Storage (nível 1) |
|--------|---------|
| Provider | `storage/providers/s3-storage.service.ts` |
| Service | `storage/storage.service.ts` |
| Controller | `storage/storage.controller.ts` |
| Invalidação | `system-configuration/use-cases/update.use-case.ts` |
| Action | `lib/actions/storage/api.ts` |
| Hook | `lib/actions/user/queries.ts → useStorageHealth` |
| Componente auto | `components/upload.tsx` |
| Config tab | `settings/components/storage-config-tab.tsx` |

Email e Messaging seguem a mesma base (`checkHealth()` com cache Redis), mas compõem como
capability — ver a tabela de referência em [[capabilities]].
