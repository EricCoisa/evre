---
title: Capabilities
tags: [architecture, backend, frontend]
---

# Capabilities

Padrão genérico para responder uma pergunta que se repete em módulos agnósticos de domínio: **"este
recurso está pronto pra uso agora?"** — e, quando não está, **de quem é o problema e onde ele conserta.**

Não confundir com [[feature-flags-backend]]: flag é rollout de dev (existe/não existe ainda,
independente de configuração); capability é runtime operacional (configurado e respondendo, ou não).
Os dois podem compor: uma capability pode exigir uma flag ligada antes de rodar o check.

## Os 3 estados

Todo recurso registrado resolve para um `CapabilityStatus`:

```ts
interface CapabilityStatus {
  available: boolean;    // flags exigidas ON para a role. false ⇒ ESCONDER
  operational: boolean;  // configurado e respondendo. false ⇒ DESABILITAR
  reason?: string;       // só ADMIN — pode conter erro de provider
}
```

| `available` | `operational` | UI |
|---|---|---|
| `false` | — | **some** — nem o controle aparece |
| `true` | `false` | **desabilitado** + hint, com botão "Configurar" para ADMIN |
| `true` | `true` | normal |

A regra que separa os dois eixos: **feature flag esconde; falta de configuração desabilita.**
"Não configurado" nunca esconde — o operador precisa chegar na chave para consertá-la. Vale também
para o recurso **interno** de um composto: se o interno está escondido por flag, o composto some
também (`available` propaga); se o interno só está mal configurado, o composto fica visível e
desabilitado — o front decide pra onde mandar o operador (ver "Rota de conserto" abaixo).

## As 2 maneiras de um `check` responder

Um check **folha** faz um teste real (ping, credencial, `allFilled()` de chaves) e devolve só
`operational`/`reason`:

```ts
check: () => this.sysConfig.allFilled([captchaConfigKeys.siteKey, captchaConfigKeys.secretKey]),
```

Um check **composto** delega a outro recurso via `resolve()`, propagando os dois eixos dele:

```ts
check: ({ resolve }) => resolve('EMAIL'),
```

`resolve` vem do `ctx` que o registry passa pro check — nunca chame `this.capabilities.resolve()`
direto dentro de um check: a chamada direta perde a guarda de profundidade (ver Degradação abaixo).

## O registry

`CapabilityRegistry` (`backend-nest/src/modules/capability/capability.registry.ts`), módulo
`@Global()`. Quatro operações:

```ts
register(name: string, def: CapabilityDefinition): () => void
requires(labelKey: string, capabilities: string[]): () => void
requirementsFor(labelKey: string): string[]
resolve(name: string, roleName: string): Promise<CapabilityStatus>
resolveAll(roleName: string): Promise<Record<string, CapabilityStatus>>
```

`register()` nome duplicado lança no boot (`Capability duplicada: X`) — diferente do
`ButtonHandlerRegistry`, onde acumular é o comportamento desejado; aqui dois registros do mesmo nome
é bug. `requires()` casa **chave exata** (sem prefixo) entre um `labelKey` de configuração e a lista
de capabilities que ele depende.

## Onde se declara — no módulo dono, nunca num arquivo central

**Nenhum nome de capability mora no `CapabilityModule`.** Cada módulo que possui o recurso declara,
no próprio `onModuleInit`, o nome (const `export const X_CAPABILITY = 'X'` no `domain/<módulo>/`),
o `register()` e os `requires()` que ligam chaves de configuração a ele:

```ts
// src/modules/captcha/captcha.capabilities.ts
@Injectable()
export class CaptchaCapabilities implements OnModuleInit {
  constructor(
    private readonly capabilities: CapabilityRegistry,
    private readonly sysConfig: SystemConfigurationService,
  ) {}

  onModuleInit(): void {
    this.capabilities.register(CAPTCHA_CAPABILITY, {
      flags: [],
      check: () => this.sysConfig.allFilled([captchaConfigKeys.siteKey, captchaConfigKeys.secretKey]),
    });
    this.capabilities.requires(captchaConfigKeys.enabled, [CAPTCHA_CAPABILITY]);
  }
}
```

Classe `@Injectable()` dedicada com `OnModuleInit`, nunca lógica de registro dentro do `.module.ts` —
mesmo padrão de `ReservedButtonHandlers`. Adicione a classe em `providers` do módulo dono.

Quando a chave pertence a um módulo diferente do recurso (ex.: `auth` controla a disponibilidade do
cadastro autônomo, mas quem sabe se `EMAIL` está operacional é o módulo email), só a ligação mora lá:

```ts
// src/modules/auth/auth.capabilities.ts — cadastro autônomo depende do email operacional
this.capabilities.requires('SYSTEM_USER_CREATE', [EMAIL_CAPABILITY]);
```

## Recurso composto

`NOTIFICATION_EMAIL`/`NOTIFICATION_WHATSAPP` (`modules/notification/notification.capabilities.ts`)
são o exemplo real: cada um checa o switch de canal do operador e, se ligado, delega ao recurso
folha (`EMAIL`/`MESSAGING`):

```ts
check: async ({ resolve }) => {
  const on = await this.sysConfig.getValueOrNull(notificationConfigKeys.emailEnabled);
  if (on !== 'true') return { operational: false, reason: this.i18n.t('capability.channel_off') };
  return resolve(EMAIL_CAPABILITY);
},
```

`resolve()` propaga `operational`/`reason`/`available` do interno pro composto (`CapabilityStatus`
é atribuível a `CapabilityCheckResult` — ver `capability.types.ts`), mas **não** existe mais um
"interno vence" pra rota de conserto: isso saiu do backend por completo (ver seção abaixo). O
`capability` que `resolveRequirements()` reporta é sempre o nome do composto (`'NOTIFICATION_EMAIL'`),
nunca o interno (`'EMAIL'`) — então o front manda o operador pra aba de notificação, não direto pra
aba de email, quando quem quebrou de verdade é o recurso interno. É uma perda de precisão conhecida
e aceita (um clique a mais num caso estreito: ADMIN vendo a própria preferência de canal), não uma
regra a reimplementar.

## Degradação

`resolve()` nunca lança para quem pediu:

- Nome não registrado → `{available:true, operational:true}` (libera, não derruba o chamador).
- `check` que lança ou estoura **2000 ms** (`Promise.race` inline, sem util de timeout) →
  `{available:true, operational:false, reason}`.
- Ciclo entre composto A→B→A → corta em **profundidade 5**, nunca trava (mesmo `MAX_DEPTH` de
  `feature-flag.service.ts`).

## Regra de alcance — só gateie o que o operador pode agir

Capability é para recurso que **depende de configuração** (credencial, conexão) e tem uma tela onde
alguém com acesso resolve. Não vira capability o que depende de um estado que o operador não controla
(ex.: SUPORTE depende de `blocked`, invariante de instalação) nem o que já está corretamente gateado
por outro mecanismo (SENTRY, OAUTH, aba do agente — ver notas desses módulos).

## `requirements` nos DTOs de configuração

`SystemConfigurationDto`/`UserConfigurationDto` ganham um campo opcional `requirements`
(`resolve-requirements.util.ts`), preenchido quando o `labelKey` tem `requires()` registrado:

```ts
{ hidden: boolean; disabled: boolean; reason?: string; capability?: string }
```

`capability` é o nome da primeira capability que falhou — o frontend usa pra montar
`capability.<NOME>.unavailable` quando `reason` não vem, e pra resolver a rota de conserto via
`CAPABILITY_FIX_PATH` (ver "Rota de conserto" abaixo). Três regras de quem vê o quê:

| Viewer | `requirements` |
|---|---|
| Sem sessão (rota pública) | **campo ausente** — nem resolve capability |
| Autenticado, não-ADMIN | presente, **sem `reason`** (não exibe warn/alerta) |
| ADMIN | presente, `reason` completo (exibe warn com ação) |

O corte acontece num lugar só, dentro de `resolveRequirements()` — nunca espalhado pelos use-cases
que o chamam. No frontend, componentes agnósticos de configuração (`ConfigurationRow`, `BaseConfiguration`,
`WarningPopover`) suprimem o ícone de aviso/warn caso o usuário não tenha permissão de configurar o que é necessário.

> **Sem `GET /capabilities/requirements`.** O inventário das ligações (`requires`/`resolve`) é a
> saída da spec `capability-registrations.spec.ts` (ver abaixo), não um endpoint — nenhuma tela
> precisa consumir isso em runtime.

## `GET /capabilities`

Única rota do `CapabilityController`. `authenticated: true`, **sem `roles`** — qualquer usuário
resolve as próprias capabilities, mas `reason` é apagado de cada entrada quando `user.roleName !==
'ADMIN'` antes de responder. **Não exposta anonimamente** — login segue lendo `/captcha/config` e
`/auth/oauth/providers`, que já respondem o que a tela de login precisa sem autenticação.

## Tool de IA

`list_capabilities` (ver [[ai-tools]]) espelha `GET /capabilities` 1:1 — mesmo `resolveAll()` do
registry, mesmo corte de `reason` fora do ADMIN. Sem `roles`: qualquer autenticado resolve as próprias
capabilities pelo chat também, já que a rota não tem RBAC nenhum (só sessão).

## Frontend

`useCapability(name)` (`lib/actions/capability/queries.ts`) lê `GET /capabilities` via React Query
(`staleTime` de 4 min, mesmo padrão de `useStorageHealth`) e devolve `{hidden, disabled, reason}` +
`fixPath` resolvido localmente (ver "Rota de conserto" abaixo). `<CapabilityGate name={CAPABILITIES.x}>`
esconde (`hidden`) ou troca os `children` por um hint + botão "Configurar" (`disabled`, botão só para
ADMIN).

`types/capabilities.ts` centraliza o vocabulário do front — `CAPABILITIES.email`, nunca o literal
`'EMAIL'` cru numa tela. Isto não fere "nada central" do backend: aquela regra é sobre acoplamento
*entre módulos do backend*; esta é a mesma função que `USER_CONFIG_KEYS` já cumpre para labelKeys.

### Rota de conserto — decisão do front, não do backend

O backend **não manda mais `fixPath`** em lugar nenhum (nem `GET /capabilities`, nem
`requirements`, nem o health check de verificação). Pra onde mandar o ADMIN consertar cada
capability é layout de tela — decisão do front — então mora só lá:

```ts
// types/capabilities.ts
export const CAPABILITY_FIX_PATH: Record<string, string> = {
  [CAPABILITIES.captcha]: '/settings?tab=captchaConfig',
  [CAPABILITIES.email]: '/settings?tab=emailConfig',
  [CAPABILITIES.messaging]: '/settings?tab=messagingConfig',
  [CAPABILITIES.notificationEmail]: '/settings?tab=notificationConfig',
  [CAPABILITIES.notificationWhatsapp]: '/settings?tab=notificationConfig',
};
```

`useCapability()` e `ConfigurationRow` resolvem `fixPath` por aí — o segundo via
`requirements.capability` (o nome que `resolveRequirements()` manda). A busca de recursos no header
(`components/resource-search.tsx`) também usa essa mesma tabela — nenhuma rota de frontend deveria
vir do backend como string pronta.

Para linhas de `SystemConfiguration`/`UserConfiguration` que já carregam `requirements` no próprio
GET (sem request extra), use `<SystemConfigurationRow>`/`<UserConfigurationRow>` em vez de
`<CapabilityGate>` — compõem com `<ConfigRow>` sem alterar `ConfigRow`, `SystemConfiguration` nem
`UserConfiguration`. Mecânica completa dessa camada (quando usar cada wrapper, `forceType`,
armadilhas de `disableLabel`/`description`): ver [[config-rows]].

## Checklist — adicionar uma capability

1. Nome: `export const X_CAPABILITY = 'X'` no `domain/<módulo-dono>/`.
2. Classe `X.capabilities.ts` (`@Injectable() implements OnModuleInit`) no módulo dono, registrada em
   `providers` do `.module.ts`. `register()` com `check` real (ou `resolve()` se for composto) —
   sem `fixPath`, isso é do front (passo 5).
3. `requires(labelKey, [X_CAPABILITY])` para cada chave de configuração que depende do recurso —
   pode morar num módulo diferente (ver seção "ligação").
4. Frontend: adicione em `CAPABILITIES` (`types/capabilities.ts`) e use
   `<CapabilityGate>`/`<SystemConfigurationRow>`/`<UserConfigurationRow>` — nunca o literal cru.
5. Se existe tela pra consertar o recurso, adicione a entrada em `CAPABILITY_FIX_PATH`
   (`types/capabilities.ts`, mesmo arquivo) — ver "Rota de conserto" acima.
6. i18n: `capability.<NOME>.unavailable` nos dois locales do frontend (fallback genérico
   `capability.unavailable` já existe).
7. `npm run openapi:export` (backend) → `npm run generate:api` (frontend) se mudou algum DTO.
8. `capability-registrations.spec.ts` (anti-typo) falha se `register`/`requires`/`resolve`/
   `CAPABILITIES` do front não baterem entre si — é o checklist automatizado dos passos 1–4.

## Arquivos de referência

| Peça | Arquivo |
|---|---|
| Tipos | `domain/capability/capability.types.ts` |
| Registry | `modules/capability/capability.registry.ts` |
| Controller | `modules/capability/capability.controller.ts` |
| Util de `requirements` | `modules/capability/resolve-requirements.util.ts` |
| Anti-typo | `modules/capability/capability-registrations.spec.ts` |
| Piloto (folha, sem rede) | `modules/captcha/captcha.capabilities.ts` |
| Composto + 2 ligações | `modules/notification/notification.capabilities.ts` |
| Só ligação (chave em módulo, recurso em outro) | `modules/auth/auth.capabilities.ts` |
| Hook frontend | `lib/actions/capability/queries.ts` |
| Gate genérico | `components/capability-gate.tsx` |
| Gate composto com `ConfigRow` | `components/configuration-row.tsx`, `system-configuration-row.tsx`, `user-configuration-row.tsx` |
| Vocabulário do front | `types/capabilities.ts` |
