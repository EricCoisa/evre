---
title: Notificação
tags: [backend, notification, feature-flags]
---

# Notificação

O módulo `backend-nest/src/modules/notification/` é um inbox in-app **agnóstico de domínio**: qualquer
módulo chama `NotificationService.notify()` para avisar um usuário, uma lista de roles ou todos, sem
saber nada sobre canais, preferências ou como o frontend vai renderizar o aviso.

## Modelo de dados

Duas tabelas, de propósito:

- **`Notification`** — o evento: `type` (chave do catálogo TS, não enum do banco), `titleKey`/`title`,
  `messageKey`/`message`, `payload` (JSON livre para o componente customizado do frontend),
  `actionUrl`. Não duplica por destinatário. Para broadcast (ver abaixo), também guarda a audiência:
  `audienceAll`/`audienceRoleNames`.
- **`NotificationRecipient`** — estado por usuário (`readAt`, `dismissedAt`) do mesmo evento.

### Fan-out: direto é síncrono, broadcast é lazy por usuário

Envio para `{ userIds }` (lista explícita e pequena, o chamador já fornece a lista) cria o
`NotificationRecipient` de cada um no mesmo `createMany` do envio — sem gap de escala, não precisa de
nada especial.

Envio para `{ roleNames }`/`{ all: true }` **não** cria `NotificationRecipient` nenhum no envio — só
grava a audiência no próprio `Notification` (`audienceAll`/`audienceRoleNames`). A linha real só é
materializada por usuário, um de cada vez, na primeira vez que aquele usuário acessa uma rota de
leitura (`GET /me`, `GET /me/unread-count`, `POST /me/read-all`) —
`MaterializeBroadcastRecipientsUseCase` resolve "quais broadcasts endereçados a mim eu ainda não
tenho linha" (`Notification` com audiência compatível e `recipients: { none: { userId } }`) e faz um
`createMany` só para esse usuário, com `createdAt` copiado do evento (não do momento da
materialização, para a ordenação do inbox continuar refletindo quando a notificação foi enviada).

Consequência importante: como a materialização acontece **antes** de montar a resposta de `GET /me`,
todo `id` que o frontend recebe já é uma linha real — `PATCH /me/:id/read` e `PATCH /me/:id/dismiss`
não precisam saber nada sobre audiência implícita, nunca viram um id sintético.

Um usuário que nunca abre o inbox nunca materializa nada para si — resolve tanto a escrita síncrona
grande quanto o armazenamento pré-alocado do design anterior (ver histórico do módulo). O relay de
canal (email/WhatsApp) continua resolvendo a lista concreta de usuários no envio quando `channels` é
pedido — ele precisa saber para quem disparar na hora, diferente do in-app.

> [!warning] Ceiling conhecido — sem índice GIN nem checkpoint por usuário
> A query de materialização (`audienceRoleNames: { has }` + anti-join em `recipients`) não tem índice
> GIN no array nem um cursor de "já vi até aqui" por usuário — cada chamada reavalia todo o histórico
> de broadcasts ainda não materializados para aquele usuário. Na escala do template isso é
> irrelevante; se o volume de eventos de broadcast crescer muito, os dois são o próximo passo (GIN em
> `audienceRoleNames`, e/ou um checkpoint `lastMaterializedAt` por usuário para limitar a busca a
> `createdAt > checkpoint`).

`titleKey`/`messageKey`, quando presentes, são resolvidos via `I18nService.t()` **na leitura**
(`GET /notification/me`), no idioma do request de quem está lendo — não no idioma de quem disparou o
evento. Isso importa porque o remetente de um `notify()` para "todos" não sabe o idioma de cada
destinatário; cada um lê no seu.

## Tipos são constantes TS, não catálogo no banco

Ver `backend-nest/src/domain/notification/notification-type.const.ts`. Cada módulo de feature que
precisar de tipos próprios declara seu próprio arquivo ao lado do seu módulo (este módulo, por ser do
template, só define o mecanismo + um tipo neutro de exemplo, `SYSTEM_ANNOUNCEMENT`). O rótulo humano
do tipo, para listas de preferência no frontend, é convenção de chave i18n (`notification.types.<KEY>`
no namespace do frontend) — não validado por tooling.

## Chamar de outro módulo

```ts
// no module.ts do seu módulo: imports: [NotificationModule]
await this.notificationService.notify({
  type: 'ORDER_APPROVAL_REQUEST',
  recipients: { userIds: [managerId] },       // ou { roleNames: ['ADMIN'] } ou { all: true }
  title: 'Aprovação pendente',
  message: 'Pedido #42 aguarda aprovação',
  payload: { orderId: '42' },                  // o frontend usa isto para montar o componente custom
  actionUrl: '/orders/42',
  channels: {
    email: true,                               // usa title/message no template de email NOTIFICATION (ver abaixo)
    whatsapp: true,                             // usa title/message no template de WhatsApp NOTIFICATION (idem)
  },
});
```

**Quem já chama** (exemplos reais, não hipotéticos): `UserModule.UpdatePasswordUseCase` notifica o
próprio usuário quando a senha é alterada (`recipients: { userIds: [id] }`, com email); e
`MessagingModule` notifica os ADMIN quando um template de WhatsApp é aprovado ou reprovado pelo
provider — tanto no fluxo normal (`ReconcileTemplateSubmissionsUseCase`) quanto no caso em que a Meta
decide na hora da submissão (`SubmitTemplateUseCase.syncRemoteStatus`), via o helper compartilhado
`modules/messaging/providers/template-notification.util.ts`.

> [!warning] Dependência circular com `MessagingModule`
> `NotificationModule` importa `MessagingModule` (para o relay de WhatsApp) e `MessagingModule`
> importa `NotificationModule` de volta (para os dois use-cases acima chamarem `notify()`) — ciclo
> real, resolvido com `forwardRef()` dos dois lados (`notification.module.ts` e
> `messaging.module.ts`). Um módulo novo que só **consome** `NotificationService` (como o
> `UserModule`) não precisa disso — é só quando o módulo importado POR `NotificationModule`
> (hoje: `MessagingModule`, `EmailModule`) também quer chamar `notify()` de volta.

`notify()` **nunca lança** — mesma filosofia de `MessagingService.trySend()`. Fluxo interno:

1. `FeatureFlagService.isEnabled('NOTIFICATION', '')` — roleName vazio de propósito, para não travar
   chamadas sem usuário autenticado (cron, webhook). Flag desligada = no-op silencioso.
2. Resolve `userId[]` (direto, por role via `Role.name`, ou todos os `status: ACTIVE, deletedAt: null`).
3. Cria o `Notification` + `NotificationRecipient[]` — síncrono, porque o sininho precisa da linha já
   no retorno da chamada.
4. Se `channels` foi pedido, para cada destinatário com email/phone **confirmado** e sem mute de
   canal/tipo: chama `EmailService.send()` / `MessagingService.trySendTemplate()`. Falha é só logada
   (`Logger.warn`), nunca propagada.

Nenhuma fila própria: `EmailService`/`MessagingService` já enfileiram a chamada ao provider
internamente, então o passo 4 é rápido (poucas queries + um `queue.add()` que já existe) e pode ficar
síncrono dentro de `notify()`.

### Template de email

Um único template HTML para **todo** o sistema de notificação — não um por tipo de notificação.
Registrado como mais um `EmailTemplateType` (`NOTIFICATION`,
`backend-nest/src/domain/mail/email-template-type.const.ts`), com variáveis próprias em
`email-variables.const.ts` (`name`, `title`, `message`, `action_url` — diferente do `COMMON` usado por
convite/reset, que não tem `title`). HTML em `backend-nest/src/modules/email/template/notification.html`.
Por entrar no mesmo registro genérico que `INVITATION`/`PASSWORD_RESET`, aparece automaticamente no
modal "Templates de email" em `/settings?tab=emailConfig` — nenhum código novo no modal foi
necessário. `SendNotificationUseCase.dispatchEmail` chama `EmailService.renderTemplate('NOTIFICATION', {...})`
antes de enviar.

`action_url` é opcional em `notify()` — muitos chamadores (ex.: `UpdatePasswordUseCase`) nunca mandam
um. O botão "Ver detalhes" no HTML fica dentro de `{{#if action_url}}...{{/if}}`: sem link, o bloco
some inteiro em vez de renderizar um botão morto (`href=""`). `{{#if var}}` é sintaxe genérica do
`renderTemplate` compartilhado (`src/common/utils/email.util.ts`, usado por todo template de email e
pelo corpo de template de WhatsApp) — qualquer template novo com uma seção que depende de uma
variável opcional pode usar o mesmo mecanismo, não é específico deste template.

> [!warning] Asset novo em `modules/email/template/` pode não aparecer em dev
> `nest-cli.json` copia essa pasta como asset de build. Com `watchAssets: true` (ligado por este
> módulo), edições em arquivo **existente** sincronizam sozinhas, mas um arquivo **novo** nem sempre é
> detectado pelo watcher incremental — exigiu `rm -rf dist && npm run start:dev` para aparecer. Mesma
> causa fez chaves i18n novas (`src/i18n/**/*.json`, também um asset) servirem o valor antigo até um
> restart limpo.

### Template de WhatsApp

Diferente de email (texto livre via `EmailService.send()`), WhatsApp **não aceita texto livre** —
`MessagingService.trySendTemplate()` exige uma chave de template já aprovada (ver [[messaging]]).
Mesma solução do email: um único `MessagingTemplateType`/`MessagingTemplate` genérico,
`NOTIFICATION` (`backend-nest/src/domain/notification/notification-config.const.ts`, export
`NOTIFICATION_WHATSAPP_TEMPLATE_KEY`), com duas variáveis custom (não reservadas) — `title` e
`message` — preenchidas por qualquer `notify()` com `channels.whatsapp: true`, mais a reservada
`first_name` (mesma liberação de `PASSWORD_CHANGED` — sem contato cadastrado, cai no fallback
`'cliente'`). Header `{ kind: 'TEXT', text: 'Notificação' }` deixa claro que é um aviso automático;
corpo (seedado em `prisma/seeds/messaging-templates.seed.ts`, `isSystem: true`, categoria `UTILITY`, só pt-BR por ora):
`'Olá {{ first_name }}! Nova notificação do sistema.\n\n{{ title }}\n{{ message }}\n\nSe não
reconhece este aviso, contate o suporte.'`.

> [!warning] A Meta recusa corpo que termine em variável ou seja dominado por variáveis
> Uma versão anterior deste template (`{{ title }}\n\n{{ message }}`, sem texto fixo nenhum) foi
> recusada: terminava em variável e tinha 1 palavra fixa para 3 variáveis. Regra geral pra qualquer
> template novo — nunca termine o corpo numa `{{ variável }}` (sempre feche com texto fixo, mesmo que
> só um ponto final) e mantenha bastante texto fixo ao redor de cada variável. `notification-whatsapp-
> template.spec.ts` trava essas duas regras pra este template específico.

Por isso `channels.whatsapp` é `boolean`, simétrico a `channels.email` — não `{ templateKey, values
}`. Quem quiser notificar por WhatsApp com um template de negócio diferente (botões, variáveis
próprias) não usa este canal: monta o envio direto via `MessagingService.trySendTemplate()`, fora do
`NotificationService`. `SendNotificationUseCase.dispatchWhatsapp` chama sempre
`trySendTemplate({ key: NOTIFICATION_WHATSAPP_TEMPLATE_KEY, phone, values: { title, message } })` —
não há seleção de template por chamador, só por canal (igual ao email).

### Gap conhecido — vínculo `User.phone`

Não existe relação entre `User` e `MessagingContact` (mensageria é por telefone, não por usuário
autenticado). Por isso `User` ganhou um campo próprio, `phone String? @unique`, só para o relay de
WhatsApp deste módulo — nulo = o relay é pulado silenciosamente para aquele usuário, mesma filosofia
do `trySend`.

O relay de WhatsApp também exige o telefone **confirmado**: `dispatchChannels` consulta
`VerificationService.isConfirmed({ userId, purpose: PHONE_CONFIRMATION, target: user.phone })` antes
de chamar `trySendTemplate` — um número digitado errado (ou de outra pessoa) não deve receber
notificações da conta antes de confirmar que realmente o controla. Sem confirmação, o canal é pulado
silenciosamente para aquele usuário, mesma filosofia do resto do módulo.

## Preferências do usuário

Reaproveita o mecanismo genérico `UserConfigurationDefinition`/`UserConfiguration` (o mesmo de
`theme`/`language`, ver [[system-configuration]]) em vez de uma tabela nova:

| `labelKey` | Tipo | Efeito |
|---|---|---|
| `NOTIFICATION_CHANNEL_EMAIL` | BOOLEAN | `false` silencia email para o usuário, mas não o in-app |
| `NOTIFICATION_CHANNEL_WHATSAPP` | BOOLEAN | idem, para WhatsApp |
| `NOTIFICATION_MUTED_TYPES` | JSON (array de type-keys) | tipo na lista não é enviado por email nem WhatsApp; continua disponível no sino in-app |

Os dois booleans usam o widget genérico `<UserConfiguration labelKey={...}>` sem nenhum código novo.
`NOTIFICATION_MUTED_TYPES` precisou de um componente próprio no frontend
(`notification-muted-types.tsx`) porque o widget genérico renderizaria um textarea JSON para um array
— mas a persistência (hooks `useUserConfiguration`/`useSetUserConfiguration`) é a mesma.

Na tela de preferências, a caixa marcada significa que o tipo está habilitado para envio por email
e WhatsApp; desmarcada significa que esses envios são suprimidos. Por padrão, todos os tipos estão
habilitados. Internamente, o JSON continua armazenando a lista de tipos desabilitados, preservando
as preferências existentes. Essa configuração não remove a notificação do sino in-app.

## Feature flag

Uma raiz, `NOTIFICATION`, sem filhas — kill-switch do módulo inteiro (sininho some no header, API
responde 404, igual ao padrão de `@RequireFeature` documentado em [[feature-flags-backend]]).

Liga/desliga por canal (email/WhatsApp) **não** é feature flag filha — feature flag aqui é rollout
de dev (existe/não existe ainda, independente de quem está logado), e "o operador desliga o relay de
WhatsApp porque o provider caiu" é configuração operacional, não rollout. Isso é
[[system-configuration]]: `SYSTEM_NOTIFICATION_EMAIL_ENABLED`/`SYSTEM_NOTIFICATION_WHATSAPP_ENABLED`
(`BOOLEAN`, nascem `true` — mesmo padrão de `SYSTEM_CAPTCHA_ENABLED`/`SYSTEM_SENTRY_ENABLED`, ver
`domain/notification/notification-config.const.ts`). `SendNotificationUseCase.dispatchChannels` lê as
duas via `SystemConfigurationService.getValueOrNull()` uma vez por envio (não por destinatário);
chave ausente (seed não rodou) é tratada como desligada.

Essas duas chaves são o kill-switch de **plataforma inteira** por canal, independente da preferência
de cada usuário (`NOTIFICATION_CHANNEL_EMAIL`/`NOTIFICATION_CHANNEL_WHATSAPP` em "Preferências do
usuário", acima — essa sim é `UserConfiguration`, por usuário) — as duas camadas precisam deixar
passar para o relay realmente disparar. Saúde do provider (`EmailService`/`MessagingService`
operacional ou não) continua sendo só consultada, nunca reimplementada como config própria —
`NotificationCapabilities` é quem liga as duas pontas (switch + saúde) como capability, tanto para o
operador (`SYSTEM_NOTIFICATION_*_ENABLED`) quanto para a preferência do usuário
(`NOTIFICATION_CHANNEL_*`, que exige o composto, não o recurso folha direto). Ver [[capabilities]].

## API

Escopo "me" em quase tudo (nunca um id de outro usuário na rota) — por isso essas rotas não têm
`roles`, só `authenticated: true`. A única exceção é o composer admin (`POST .../broadcast`).

| Método | Rota | Uso |
|---|---|---|
| `GET` | `/notification/me` | Lista paginada (`?unreadOnly=true` filtra) |
| `GET` | `/notification/me/unread-count` | Contador para o sininho |
| `PATCH` | `/notification/me/:id/read` | Marca uma como lida (`:id` é o `NotificationRecipient`, não o evento) |
| `POST` | `/notification/me/read-all` | Marca todas como lidas |
| `PATCH` | `/notification/me/:id/dismiss` | Sai do inbox (não aparece mais na listagem) |
| `POST` | `/notification/broadcast` | Composer admin (`roles: ['ADMIN']`) — título/mensagem livres, `{ all: true }` ou `{ roleNames: [...] }` |

`notify()` continua só sendo chamado por injeção para o resto dos módulos — a única forma de disparar
uma notificação via HTTP é o composer admin, que por baixo chama o mesmo `notify()`
(`SendBroadcastNotificationUseCase`, sempre com `type: SYSTEM_ANNOUNCEMENT`, sem suporte a
`titleKey`/`messageKey` — é texto livre). Sempre pede os dois canais (`channels: { email: true,
whatsapp: true }`, mesma lógica do `UpdatePasswordUseCase`) — quem decide o que realmente dispara são
as camadas de baixo (flag de plataforma por canal, preferência de mute por usuário), não o composer.
Sem rota pra `{ userIds }` explícito: esse caso continua sendo só de código, não de UI.

## Tools de IA

Mesmo recorte da tabela acima, como tools do agente (ver [[ai-tools]]): `list_my_notifications`,
`get_unread_notifications_count`, `mark_notification_read`, `mark_all_notifications_read` e
`dismiss_notification` — escopo "me", qualquer autenticado, sem `roles` — e `send_broadcast_notification`,
que espelha o `roles: ['ADMIN']` do composer. Nenhuma delas tem guard de role pro resto do módulo porque
o controle real é a feature flag `NOTIFICATION_ROOT_FLAG`: todas checam `FeatureFlagService.isEnabled()`
dentro do próprio `execute()`, já que o filtro estático de `roles` do `ToolRegistry` não sabe nada sobre
feature flag — sem essa checagem, a tool continuaria respondendo com a flag desligada. As quatro escritas
de escopo "me" compartilham o mesmo `approvalScope` (`notification:write`) com o broadcast — aprovação é
por área de recurso, não por quão arriscada é a operação individual.

## Frontend

- **Sininho** (`components/notification-bell.tsx`, no header): contador via polling de 30s
  (`refetchInterval`), não SSE — upgrade possível espelhando o padrão de
  `MessagingEventsService` ("o que mudou, sem conteúdo") se precisar de tempo real, não construído
  agora.
- **Gating é decisão do servidor, não do componente**: `(private)/layout.tsx` lê
  `serverFeatureFlag('NOTIFICATION')` e só passa `<Header notificationsEnabled>` quando ligada —
  `<NotificationBell>` nem monta com a flag desligada, então nenhum hook roda e nenhuma chamada ao
  backend acontece. Checar a flag **dentro** do componente (`useFeatureFlag` client-side) não seria
  suficiente: os hooks de dados (`useUnreadCount`, `useMyNotifications`) são chamados
  incondicionalmente antes de qualquer `if`, então disparariam a requisição (e o toast de erro do
  404) mesmo que o componente devolvesse `null` depois. Mesmo padrão de [[page-structure]].
- **Tipo → componente**: `components/notification/renderer-registry.tsx` mapeia `type` para um
  componente customizado (ex. hipotético: card de aprovação com botões aprovar/rejeitar). O backend
  não sabe disso — o botão de ação chama o endpoint do módulo **dono** da ação, nunca um endpoint
  deste módulo. Sem mapeamento, cai no renderer padrão (título + mensagem). O template só registra o
  mecanismo, sem exemplo de negócio.
- **`/profile`**: aba própria "Notificações" (gateada pela flag, igual às outras abas condicionais da
  página) com os dois switches de canal + a lista de tipos silenciados — não fica dentro da aba
  Preferências, para não misturar configuração de notificação com tema/idioma.
- **`/settings?tab=notificationConfig`** (`notification-config-tab.tsx`): um
  `<SystemConfigurationRow forceType="toggle">` por canal (`SYSTEM_NOTIFICATION_EMAIL_ENABLED`/
  `SYSTEM_NOTIFICATION_WHATSAPP_ENABLED`). O gate não é mais código manual da tela — é
  `requirements`, resolvido pelo backend via `NotificationCapabilities`
  (`modules/notification/notification.capabilities.ts`), que registra `NOTIFICATION_EMAIL`/
  `NOTIFICATION_WHATSAPP` como compostos: cada um checa o próprio switch de canal e, se ligado,
  delega ao recurso folha (`EMAIL`/`MESSAGING`). Antes desta migração, a tela checava
  `useEmailHealth()` e `useMessagingConnections().length > 0` na mão — o segundo tinha um bug real
  (contava conexão **arquivada**, nunca testava credencial de verdade). O mecanismo genérico
  (`checkAnyOperational()` em `messaging-connection-state.service.ts`) testa saúde de cada conexão
  não arquivada de verdade. Mecanismo completo: [[capabilities]]. Sem composer de broadcast aqui, de
  propósito (ver abaixo) — esse mora no sininho.
- **Composer admin** (`components/notification/send-notification-modal.tsx`): ação "Enviar
  notificação" no popover do sininho, visível só para `user.role === 'ADMIN'` (`useMe()`, checado no
  client — o endpoint também é `roles: ['ADMIN']` no backend, então esconder o botão é só UX, não a
  autorização real). Formulário: título, mensagem, link opcional e público (todos os usuários ou um
  conjunto de roles via `useRoles()` — mesma fonte usada em outras telas admin; hoje só lista roles de
  sistema (`Role.isSystem`), então uma role customizada não aparece no seletor mesmo que o backend
  aceite o nome dela em `roleNames`). Chama `POST /notification/broadcast`. Vive no popover do sininho
  em vez de `/settings` para ficar perto de onde o admin já pensa em notificações, sem precisar abrir
  uma página só para isso.

## Gaps explícitos (v1)

- O seletor de roles do composer admin só lista roles de sistema (ver nota em "Frontend" acima) — uma
  role customizada só pode ser alvo de broadcast chamando `notify()` direto por código, não pelo
  formulário.
