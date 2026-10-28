---
title: Mensageria — Providers
tags: [backend, messaging, whatsapp, providers, meta, evolution]
---

# Mensageria — providers

Tudo o que é **específico de um provider** de WhatsApp. O comportamento agnóstico (conexões, filas,
templates, botões, SSE) está em [[messaging]]; o passo a passo de uso, em [[messaging-template-flow]].
Regra de ouro: o restante da aplicação **nunca** importa um adapter — fala com `MessagingService`
e consulta `capabilities()`.

Adapters em `backend-nest/src/modules/messaging/providers/`: `EVOLUTION_API` (Node/Baileys),
`EVOLUTION_GO` (Go/whatsmeow) e `META` (WhatsApp Cloud API).

## Comparativo

| | Pareamento (`session`) | Número da conta | Perfil do contato |
|---|---|---|---|
| `EVOLUTION_API` (Node/Baileys) | ✅ QR | pelo pareamento | ✅ |
| `EVOLUTION_GO` (Go/whatsmeow) | ✅ QR | pelo pareamento | ❌ |
| `META` (WhatsApp Cloud API) | — não precisa | `display_phone_number` | ❌ |


Os adapters implementam `IMessagingProvider`. `session` ausente = o provider não tem o que parear e
a UI esconde o QR; é o caso da Meta, onde o número já é verificado na conta Business.

| Capability | Meta | Evolution API / Go |
|---|---|---|
| Template | enviado nativamente, **precisa de aprovação** (`template.approval`) | interpolado como texto livre |
| Botões (`components.buttons`) | ✅ interativos (resposta rápida, URL, …) | ❌ viram texto; cliente responde digitando |
| Janela de 24h | ✅ fora dela só template aprovado | — |
| Digitando (presença) | ❌ | ✅ |
| Perfil do contato | ❌ | API ✅ / Go ❌ |

## Saúde

Credencial boa com a sessão caída aceitaria o envio e falharia no provider — por isso o ramo "só
credencial" vale exclusivamente para provider sem `session` (Meta).

## Meta (WhatsApp Cloud API)

- **Webhook**: handshake `GET` (verify token) + eventos `POST` com assinatura **HMAC-SHA256 sobre o
  corpo cru**.
- **Janela de 24h**: `serviceWindowHours: 24` na capability; fora dela só template aprovado (imposto pelo servidor e pelo chat — ver [[messaging]]). Evolution: sem janela (`null`).
- **Mídia**: resolve a URL pelo id e baixa o binário com o token.
- **Parâmetros**: no envio, o adapter normaliza o valor de cada parâmetro (quebra de linha e tab viram
  espaço; no máximo 4 espaços seguidos), que a Meta recusa.
- **Presença**: não existe webhook nem endpoint de digitação.

### Regras da Meta para template

Além do contrato do tipo, a Meta recusa templates por regras de redação. As que dá para saber de
antemão vivem em **um só módulo**, `providers/meta-template-rules.ts` (`checkMetaTemplateRules`), e
valem só para quem passa pela aprovação (a Evolution envia texto livre) — por isso rodam na
**submissão** e na checagem do editor, não ao salvar no catálogo. Autenticação é isenta (corpo fixo
da Meta).

| Severidade | Regra (`code`) |
|---|---|
| `error` — barra a submissão | `BODY_STARTS_WITH_VARIABLE`, `BODY_ENDS_WITH_VARIABLE` (corpo não começa nem termina com variável), `BODY_ADJACENT_VARIABLES` (`{{ a }}{{ b }}`), `FOOTER_HAS_VARIABLE`, `URL_SHORTENER` (bit.ly, tinyurl… no corpo, header, rodapé ou URL de botão) |
| `warning` — só avisa | `BODY_TOO_MANY_VARIABLES` (poucas palavras fixas por variável), `UTILITY_WITHOUT_VARIABLES` (risco de virar Marketing), `BODY_TOO_MANY_LINE_BREAKS`, `PHONE_WITHOUT_COUNTRY_CODE` |

`POST /messaging/templates/check-meta` aplica as mesmas regras a um rascunho, sem gravar: o editor o
consulta (com debounce) e mostra os problemas, e o modal de submissão desabilita o envio quando há
`error`. Assim a regra mora no servidor e o front não a duplica. Cada problema traz `code` estável +
`params`, que a tela traduz (`metaRule.<CODE>`); sem tradução, mostra a `message` do servidor.
**Adicionar uma regra** = uma entrada em `checkMetaTemplateRules` + o texto em `metaRule.<CODE>`
nos locales.

As regras de **erro** são as que a Meta aplica sempre; as de **aviso** são heurísticas (a revisão
decide caso a caso) e não bloqueiam. O que depende de julgamento (conteúdo promocional em
Utilidade, por exemplo) não tem como ser checado aqui.

### Botões na Meta

Só a Meta devolve o payload do botão e o `context.id` da mensagem respondida — é o que alimenta o
pipeline de eventos descrito em [[messaging]] (“Botões tipados”). Limites assumidos (confirme na
documentação vigente da Meta): 10 botões no total, 2 de URL, 1 de telefone, 1 de copiar código;
categoria `AUTHENTICATION` usa só o botão fixo de copiar código. O payload de `QUICK_REPLY` é
`chave` ou `chave:dado`; botão URL do sistema vira `urlBase{{ chave }}` com o sufixo informado no envio.

## Evolution API

- Webhook com **Bearer customizado**.
- Mídia: `POST /chat/getBase64FromMediaMessage` → `{ base64, mimetype }`; monta `{ key: { id, fromMe } }`
  sozinha quando só há o id.
- Presença: ver tabela de contratos abaixo.
- Valores gerados pelo sistema (`systemFields`) como na Evolution Go.

## Limpeza manual de conexões arquivadas antes da mudança

O arquivamento atual marca a conexão como inativa antes de chamar o provider. Conexões que já
estavam arquivadas antes dessa mudança não repetem a limpeza remota em uma nova tentativa de
arquivamento; isso evita usar credenciais antigas sobre uma instância que pode ter sido recriada.
O backend recusa eventos dessas conexões, mas o provider ainda pode tentar enviá-los e gerar
respostas `401` nos logs. Identifique a instância vinculada à conexão arquivada e faça a limpeza
diretamente no provider:

- **Evolution API:** consulte primeiro `GET /webhook/find/:instance` com o header `apikey` da
  Evolution. Envie `POST /webhook/set/:instance` preservando a URL retornada e definindo
  `webhook.enabled` como `false`; a API exige a URL mesmo para desativar. Consulte novamente com
  `GET /webhook/find/:instance` e confirme que `enabled` voltou como `false`.
- **Evolution Go:** `POST /instance/disconnect`, com o header `apikey` usando o `instanceToken`
  daquela instância. Isso remove as assinaturas de evento e derruba o socket. Se a instância
  arquivada deve ser removida definitivamente, faça também logout e exclusão, conferindo o
  `instanceId` antes: `DELETE /instance/logout` com o `instanceToken`, depois
  `DELETE /instance/delete/:instanceId` com a chave global.
- **Meta:** a inscrição de webhook pertence à WABA, não a uma conexão individual; não a remova para
  arquivar uma conexão. Os eventos destinados a conexões arquivadas são recusados pelo backend.

Use o `baseUrl` configurado para o provider e não exponha as chaves em logs, histórico de terminal ou
chamadas a serviços de terceiros. Para identificar credenciais ou IDs ausentes, consulte a
configuração da conexão antes de fazer qualquer chamada destrutiva.

## Evolution Go: provisionado pelo sistema, igual à Evolution API

> ⚠️ A **documentação pública** do Evolution Go é incompleta e em pontos divergente do código.
> Valide contra o swagger da sua instância (`/swagger/doc.json`, público) ou contra a fonte
> (`github.com/evolution-foundation/evolution-go`), não contra a doc.

- **`token` é a chave global** (`GLOBAL_API_KEY`), simétrico à Evolution API: o admin informa só
  `baseUrl` + chave global. `instanceId` e `instanceToken` são **UUIDs gerados pelo sistema**
  (`EvolutionGoProvider.systemFields`), estáveis entre edições — nunca digitados.
- **`GET /instance/info/:instanceId`** (chave global) é a fonte de verdade do estado: devolve o
  modelo `Instance`, com `connected`, `jid` (o número, exportado — diferente de `/instance/status`)
  e `qrcode` (persistido) numa chamada só. `ensureInstance()` usa esse mesmo endpoint para decidir
  se precisa criar a instância (`404` ⇒ `POST /instance/create`, também sob chave global, com
  `advancedSettings: { ignoreGroups: true, ignoreStatus: true }` — evento de grupo nunca chega,
  o que resolve na origem o bug de receipt de grupo envenenando o lote de ingest).
- **`POST /instance/connect`** (token da instância) grava a URL do webhook, define as assinaturas e
  **sobe o cliente** — é a chamada que inicia o pareamento de verdade. `registerWebhook()` chama
  `ensureInstance()` antes dela.
- **Sem polling do `/instance/qr`.** O QR chega por duas vias: a leitura de `/instance/info` (se o
  campo persistido acompanhar a rotação) e o evento `QRCode` do webhook, já tratado por
  `applyEvent`/SSE. `GET /instance/qr` não é usado pelo sistema — ele sobe um cliente novo a cada
  chamada, então nunca deve ir a polling.
- **Passkey (WebAuthn) não é suportado.** O modelo `Instance` do `/instance/info` não expõe
  `passkeyOpenUrl`/`passkeyStage`. Contas que exigem passkey mostram CONNECTING sem QR até expirar;
  não há mensagem específica para esse caso.
- **Desconexão de sessão é `DELETE /instance/logout`**, que despareia. `POST /instance/disconnect`
  derruba o socket e apaga as assinaturas de evento da instância: o arquivamento usa essa rota para
  parar webhooks; não a use para o botão normal de desconectar, pois não faz logout do WhatsApp.
- **Instância travada no Evolution Go** (o `StartClient` aborta quando a instância tem `Jid` gravado
  mas o aparelho não está mais no device store dele): a API tem `POST /instance/forcereconnect/:id`
  e `DELETE /instance/delete/:id` sob chave global — a mesma que já fica na config da conexão. O
  arquivamento apaga a instância; recuperação de uma instância ativa ainda é manual (chamar a API à
  mão, ou `delete` + deixar `ensureInstance()` recriar no próximo `connect()`).
- **`subscribe: ['ALL']`** é válido e expande para todos os eventos (só o primeiro item é olhado).
- **O estado do Receipt está no `state` do envelope** (`Read`, `ReadSelf`, `Delivered`), não em
  `data.Type`: `data` é o struct cru do whatsmeow, onde o `ReceiptType` de entrega é **string
  vazia** — ler dali descarta todo DELIVERED.

- Webhook: o `instanceToken` vem **no corpo**.
- Mídia: `POST /message/downloadmedia` com a `Message` gravada; devolve `data.base64` como **data URL
  e sem campo de mimetype** — o tipo sai do prefixo da data URL, senão cairia em
  `application/octet-stream` e o navegador baixaria em vez de exibir.

## Webhook: autenticação por provider

A ordem é chave da URL (nossa) → assinatura nativa do provider → fila. Meta: HMAC-SHA256; Evolution
API: Bearer; Evolution Go: `instanceToken` no corpo.

> **Não use o webhook global do Evolution** (`WEBHOOK_URL` no env dele). Ele dispara **junto** com o
> da instância, chega sem a chave da URL e vira um 401 por evento no log.

## O raw do eco é a fonte canônica da mídia que NÓS enviamos

`createQueued` grava `raw: storableRaw(input)` — sem bytes e sem payload do provider (ele ainda não
existe nesse momento: é o que a resposta do envio devolve depois). Para mídia por **upload** isso é
um problema no Evolution Go: `downloadMedia` exige a `Message` completa e não tem fallback por id
(a Evolution API tem — monta `{ key: { id, fromMe } }` sozinha — por isso o bug só doía no Go). Quem
tem o payload completo é o **eco** que o provider manda de volta no próprio webhook, com
`fromMe: true` e o `Message`/`message` cheio.

O eco pode chegar em duas ordens, e as duas precisam preservar o `raw`:

- **Depois** do envio (`markSent` já gravou nosso `providerMessageId`): o `upsert` de `saveIncoming`
  cai no `update` (mesma `connectionId_providerMessageId`) — grava `raw: storableRaw(event.raw)`
  quando `event.fromMe`, mantendo a nossa linha canônica para id, status e direção.
- **Antes** (a corrida clássica de webhook): o eco ainda não casa com nada nosso e cria a própria
  linha; `markSent` lê o `raw` dela **antes** de apagá-la (`deleteMany`), dentro da mesma transação —
  ler fora da transação abriria uma janela com duas linhas disputando o mesmo `providerMessageId`
  único.

## Presença: contratos confirmados contra a fonte

| Provider | Entrada (webhook) | Saída |
|---|---|---|
| Evolution Go | `event: "ChatPresence"` — `data` é `events.ChatPresence` do whatsmeow achatado: `Chat`/`Sender`/`IsFromMe`/`IsGroup` (de `MessageSource`) + `State` (`"composing"` \| `"paused"`) + `Media` (`"audio"` = gravando nota de voz, `""` = texto) | `POST /message/presence` — `{ number, state, isAudio, delay }`. `delay` é opcional; omitido, o Go manda a atualização uma vez só, sem repetir em background |
| Evolution API | `event: "presence.update"` — repasse 1:1 do Baileys: `{ id, presences: { [participante]: { lastKnownPresence } } }`, com `lastKnownPresence` em `composing` \| `recording` \| `paused` \| `available` \| `unavailable` | `POST /chat/sendPresence/:instance` — `{ number, presence, delay }`. **`delay` é obrigatório no schema** e a Evolution **bloqueia a própria resposta** por esse tempo antes de mandar `paused` sozinha — por isso o adapter manda um valor fixo pequeno (6s, levemente acima do debounce do front), não um valor grande |
| Meta | não existe webhook de digitação | não existe endpoint |

Confirmado contra o swagger público da instância Go (`/swagger/doc.json`) e a fonte dos projetos
(`evolution-foundation/evolution-go`, `evolution-foundation/evolution-api`, e `tulir/whatsmeow` para
os enums de `ChatPresence`/`ChatPresenceMedia`) — não contra a documentação pública do Go, que segue
incompleta (ver aviso em "Evolution Go" acima).

## Adicionar um provider (notas específicas)

- Valor que o sistema gera (UUID de instância, token) é `systemFields?()` — ver `EvolutionGoProvider`
  e `EvolutionApiProvider` como referência.
- O **formulário** de cada provider (`fieldsOf`/`schemasOf`/`initialValues` em
  `messaging-config-tab.tsx`) ainda é hardcoded por provider — um provider novo cai no formulário da
  Meta por fallback silencioso até isso ser resolvido (dívida conhecida).
- Novo provider = nova seção neste arquivo com: webhook/auth, download de mídia, presença, limites de
  template/botões e peculiaridades do swagger/doc oficial.
