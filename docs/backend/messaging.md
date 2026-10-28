---
title: Mensageria (WhatsApp)
tags: [backend, messaging, whatsapp, bullmq, sse]
---

# Mensageria

O módulo `backend-nest/src/modules/messaging/` envia e recebe WhatsApp sem expor ao restante da
aplicação qual provider está ativo. Um aceite do provider não garante entrega: o status final chega
por webhook.

Há **dois usos** e eles pedem contratos diferentes:

- **Chat operado por humano** (`/comunicacao`): o operador clicou em enviar e precisa ver o erro.
  Usa `send()`, que lança.
- **Canal para outros módulos** (como o de e-mail): a mensagem é um extra e não pode derrubar o
  fluxo principal. Usa `trySend()`, que devolve `null` com a flag desligada, sem conexão ou sem
  credencial válida. Um cadastro não deve falhar porque o WhatsApp não está configurado.

## Conexões

Uma **conexão** (`MessagingConnection`) é um número de WhatsApp acessado por um provider. O contato
(`MessagingContact`) é a pessoa, identidade **global** pelo telefone — o mesmo contato responde em
qualquer conexão. Quem é por conexão é a **conversa** (`MessagingConversation`, par `connectionId` +
`contactId`): duas conexões com a mesma pessoa são duas conversas, para não interleavear contexto nem
responder pelo número usado por último. Mensagens (`MessagingMessage`) referenciam `connectionId` e
`contactId` diretamente.

Credenciais ficam em `config`, na estrutura de cada provider, com os segredos cifrados pela mesma
cifra do `SystemConfiguration`. **Não há fallback de variáveis de ambiente.** Editáveis na aba
Mensageria de `/settings`, em stepper: servidor → credenciais → pareamento.

Por ora cada provider tem no máximo uma conexão — regra do use-case, não do banco, para liberar mais
de uma sem migração.

### A regra do número

A conexão pertence a **um** número, fixado no primeiro pareamento (ou na primeira validação, nos
providers que informam o número da conta). Depois disso ela só reconecta com o mesmo número: sessão
de outro número é **desfeita no provider** e a conexão volta a desconectada com o motivo
(`PHONE_MISMATCH`, ou `PHONE_IN_USE` quando o número já é de outra conexão).

Isso existe porque conversas e mensagens pendem de `connectionId`. Trocar o número de uma conexão
viva faria o chat responder conversas antigas por um número que o contato nunca procurou.

### Conexão padrão

A marcada como `isDefault` é quem envia quando ninguém informa a conexão (outro módulo, tool de IA,
API sem `connectionId`). No máximo uma, garantida por índice único parcial. A primeira conexão nasce
padrão; sem nenhuma marcada, o envio cai na mais antiga.

Na tela é um switch sempre visível, desabilitado na que já é padrão: desligar não cabe, porque sem
nenhuma padrão o envio sem conexão informada fica sem alvo. Marcar outra é o que troca.

### Arquivar: é assim que se troca de provider ou de número

Provider e número são **imutáveis** numa conexão em uso. A saída é arquivar
(`DELETE /messaging/connections/:id`), que:

1. marca `archivedAt` primeiro, para rejeitar novos webhooks antes da limpeza remota;
2. desativa a inscrição do webhook no provider (best-effort);
3. despareia e apaga a instância quando o provider oferece essa operação (best-effort — falhas
   remotas não impedem arquivar);
4. tira a conexão de `list()`, do `resolve()` e das telas;
5. **libera o número** (`phone = null`): a coluna é única, mas o Postgres aceita vários NULL;
6. se era a padrão, promove a mais antiga das que sobram, na mesma transação.

Não é DELETE porque `messaging_messages` e `messaging_conversations` referenciam a conexão com
`onDelete: Restrict` — e o histórico de conversa é o ativo do módulo. Arquivada continua sendo
resolvida por `get()` (o histórico e a mídia dela seguem legíveis), mas `resolve()` a recusa para
envio.

**Restaurar** (`POST /messaging/connections/:id/restore`) reverte: valida as credenciais de novo
(a mesma conferência da criação), recusa se já existe outra conexão ativa do mesmo provider e, nos
providers que informam o número sem parear, exige que seja o mesmo número anterior. Reativa a
conexão, religa a inscrição do webhook e o histórico (mensagens e conversas) continua o mesmo de
antes de arquivar.

Evolution API desativa o webhook com `POST /webhook/set/:instance` (`enabled: false`). Evolution Go
limpa as assinaturas de eventos com `POST /instance/disconnect`, além do logout e exclusão da
instância. Providers sem remoção de webhook por conexão (como Meta) não recebem essa chamada.

Conexões arquivadas **antes desta mudança** não repetem a limpeza ao serem arquivadas novamente.
Se uma instância antiga ainda enviar eventos, desative a assinatura manualmente no provider; o
backend já rejeita eventos dessas conexões. O procedimento por provider está em
[[messaging-providers#limpeza manual de conexões arquivadas antes da mudança]].

## Providers

Providers suportados (comparativo e peculiaridades em [[messaging-providers]]): `EVOLUTION_API`,
`EVOLUTION_GO` e `META`.

Os adapters implementam `IMessagingProvider`. `session` ausente = o provider não tem o que parear e
a UI esconde o QR; é o caso de providers com número já verificado na conta.

`send()` aceita `TEXT`, `IMAGE`, `VIDEO`, `DOCUMENT`, `AUDIO` e `TEMPLATE`. `capabilities()` informa os
tipos suportados, o modo de template (nativo com aprovação ou texto interpolado) e botões, sem
chamada de rede. Os contratos não implicam paridade de regras.

No chat `/comunicacao`, o editor converte negrito, itálico, tachado e monoespaçado para a sintaxe
WhatsApp (`*texto*`, `_texto_`, `~texto~`, ```` ```texto``` ````). Os espaços entre palavras são
sempre enviados sem formatação; ao serializar, cada palavra formatada recebe seus próprios
delimitadores para evitar que estilos adjacentes se sobreponham.

**Janela de atendimento** (`capabilities.serviceWindowHours`, `null` = sem janela): em provider que a
declara, mensagem livre (texto/mídia) só vale até N horas após a última mensagem **recebida**
(`MessagingConversation.lastInboundAt`). O servidor recusa em `createQueued` (400, antes de gravar) e
o chat trava campo, anexo e voz, deixando só o template. Template não passa por essa regra.

Salvar configuração valida primeiro o schema Zod e depois consulta o próprio provider; só grava se
ambas as etapas passarem. Segredos enviados em branco mantêm o valor existente.

### Saúde

Saudável = credencial válida **e**, nos providers com sessão, instância conectada. Credencial boa
com a sessão caída aceitaria o envio e falharia no provider — por isso o ramo "só credencial" vale
exclusivamente para provider sem `session`. Cache Redis de 300s, invalidado ao salvar
configuração, arquivar ou receber evento de conexão.


## Contatos, conversas, mensagens e opt-out

`MessagingContact` é a pessoa: `phone` é **globalmente único** (identidade independente de para qual
dos nossos números ela escreveu). `MessagingConversation` é a thread — par `connectionId` +
`contactId`, único — e guarda o `lastMessageAt` daquela conversa e o `lastInboundAt` (última
mensagem **recebida** nela, base da janela de atendimento). `upsertContact` faz os dois upserts juntos
a cada envio/recebimento. `name` é editável, `pushName` vem do WhatsApp.

Criar um contato sem conversa (`POST /messaging/contacts`, `CreateContactUseCase`) grava só a pessoa
— antes de qualquer mensagem trocada. Telefone duplicado é **409** (`messaging.contact_exists`); a
checagem e a escrita são por `phone`, que é a chave única da tabela.

`MessagingMessage` guarda inbound e outbound na mesma tabela, com `connectionId` + `contactId` como
foreign keys diretas (`onDelete: Restrict`) e o telefone vem do contato relacionado.
`providerMessageId` é único **por conexão** (o id do provider só é único dentro de quem o gerou) e
serve para deduplicar webhooks e correlacionar status. A mensagem é persistida antes do envio; o job
outbound carrega apenas `{ messageId }`.

A tela de contatos lista a pessoa (`MessagingContactDto.conversationCount` conta as conversas dela;
`lastConnectionId` é a da mais recente — só um ponto de partida quando há mais de uma). Abrir a
conversa certa entre várias é o papel de `GET /messaging/conversations?phone=`
(`MessagingConversationSummaryDto`, mais recente primeiro) — o seletor do chat decide por ele.

**Opt-out é por número, não por conexão**: a facade recusa envio para um telefone com `optOut` em
qualquer conversa. É deliberado — quem pediu para não ser contatado não pediu para uma linha só.

Telefone é armazenado só com dígitos. `normalizePhone()` remove o sufixo WhatsApp e canoniza o nono
dígito brasileiro; preserve a mesma função em qualquer integração que leia ou grave contatos.

## Mídia: sob demanda, nada no storage

**Nenhum byte de mídia vai para o storage da aplicação.** O arquivo é buscado no provider quando a
tela pede (`GET /messaging/messages/:id/media`) e repassado em stream, com suporte a byte-range
(RFC 9110 §14). Mimetypes não seguros para exibição são servidos como anexo (`Content-Disposition:
attachment`), nunca inline — um `text/html` enviado por um contato não pode executar na origem do
painel.

O adapter de cada provider sabe baixar a mídia (endpoint e formato variam; ver [[messaging-providers]]).

`MessagingMessage.mediaUrl` só é gravado quando **nós** enviamos por link. Arquivo recebido, ou
enviado por upload, não é persistido em lugar nenhum — o upload atravessa o backend em memória e vai
direto ao provider (por isso envio com anexo não passa pela fila: os bytes não estão no banco para
um retry reler).

### O raw do eco é a fonte canônica da mídia que NÓS enviamos

Para mídia enviada por **upload**, alguns providers só baixam de volta com o payload completo, que
existe apenas no **eco** do webhook (`fromMe: true`). `saveIncoming` e `markSent` preservam esse
`raw` nas duas ordens de chegada (eco antes/depois do envio). Detalhe e motivo: [[messaging-providers]].

## Filas, webhook e tempo real

- `messaging`: dispatch outbound; até cinco tentativas com backoff exponencial.
- `messaging-inbound`: normaliza e persiste mensagens e status recebidos.
- `messaging-buttons`: roda os handlers do toque do cliente num botão (ver [Botões tipados](#botões-tipados-e-eventos-de-toque)).
  Fila própria para que um handler lento ou quebrado nunca faça o lote de ingestão falhar e reprocessar mensagens.

O webhook público é servido pelo **proxy do frontend** em `/api/messaging/webhook`, não pelo host
interno do backend. A ordem é: chave da URL (nossa) → assinatura nativa do provider → fila (o mecanismo de assinatura é de
cada provider). A chave é validada antes do corpo ser parseado, para não deixar um chamador anônimo
forçar o parse de um payload grande só para receber 401.

De qual conexão o evento é: pelo `?connection=` da URL que registramos — sempre presente, já que o
id da instância é nosso (UUID gerado pelo sistema). Sem ele, só quando existe uma conexão única.

> Detalhes de autenticação do webhook por provider (e o que **não** configurar): [[messaging-providers]].

Eventos repetidos são deduplicados. Status sem mensagem outbound correspondente lança erro para a
fila tentar de novo, evitando perder uma atualização que chegou antes do dispatch gravar o id.

O registro automático do webhook é best-effort: erro não apaga a configuração, mas é mostrado ao
administrador com a URL para registro manual. Em desenvolvimento, o override público
(`SYSTEM_MESSAGING_WEBHOOK_PUBLIC_URL`) precisa apontar para o frontend/túnel — é **global**, por
isso fica num campo único da aba e não no formulário de cada conexão.

**Tempo real por SSE**, sem polling: `GET /messaging/events` empurra o que mudou sem o conteúdo
(`connection`, `messages`, `contacts`) e o navegador decide qual consulta refazer. Isso mantém o
canal sem dados de conversa. O webhook pode ser processado por um processo e a tela estar conectada
em outro, então o evento também passa pelo Redis pub/sub, com `origin` para não entregar duas vezes
no processo que emitiu. Uma conexão SSE por aba, encerrada pelo servidor a cada 10 minutos (abaixo
da validade do access token) por um evento `end`; o cliente reconecta na hora, sem o backoff usado em
erro de verdade — a reautorização acontece na reconexão, nunca no meio de um stream aberto. A ponte
cookie→Bearer que expõe essa rota ao navegador é genérica, ver [[frontend-auth]].

## Presença (digitando)

Indicador de "digitando"/"gravando áudio", nos dois sentidos. Entrada (contato digitando) e saída
(operador digitando) são capabilities **independentes** — `MessagingCapabilities.typing: { inbound,
outbound }` — porque um provider pode ter uma sem a outra.

Não é WebSocket, e não entra em fila: entrada reaproveita o SSE de "Tempo real" acima (uma terceira
categoria de evento, `{ type: 'presence', connectionId, phone, state }`), saída é **POST debounced**
a cada ~5s enquanto o operador digita. O indicador do WhatsApp expira em ~25s e é renovado por
chamadas repetidas — socket não compraria nada que o POST periódico já não resolva.

Presença é **estado efêmero**, não "algo mudou, refaça a consulta": o front nunca passa esse evento
por `invalidateQueries` — vai para estado local do componente (`useTypingIndicator`), com TTL de 10s
no cliente, porque o `PAUSED` pode nunca chegar (aba fechada do outro lado, webhook perdido). No
backend, `ReceiveWebhookUseCase` decide ANTES de enfileirar: se o corpo só produz eventos
`PRESENCE`, chama `MessagingService.emitPresence` direto e responde, sem passar pelo
`messaging-inbound` (5 tentativas com backoff) — reprocessar um "parou de digitar" do segundo
anterior não faz sentido, e falhar aqui é só descartar.

Contratos de webhook/endpoint de cada provider: [[messaging-providers]].

## Templates e variáveis

Um **tipo de template** declara as variáveis; o **template** (key + idioma) escolhe um tipo e só pode
usar o que o tipo oferece. Um tipo oferece dois grupos, ambos em `MessagingTemplateType.variables`:

- **Custom**: o operador declara (`name`, `type`, `required`, `default`, `sensitive`). O chamador
  informa o valor em `values`.
- **Reservadas**: declaradas em código, **uma única vez**, em
  `backend-nest/src/domain/messaging/messaging-variables.const.ts`. O operador as libera no tipo por
  checkbox (a linha vira `{ name, reserved: true }`); só as liberadas valem naquele tipo. O dev da
  reservada decide tudo na declaração: `type`, `example` (aprovação), `dummy` (preview), `fallback`,
  `onMissing` (`fallback` ou `error`), `allowUse`, `sensitive`, `fromContext` (dado de origem no
  contato) e `normalize` (dado bruto → texto final, validando).

**Adicionar uma reservada** = uma entrada em `RESERVED_VARIABLES` + a chave em `ReservedVariableKey`
(sem declaração, não compila) + o rótulo `variable.<nome>` nos locales do front
(`frontend-next/src/locales/*/messaging.json`). API, preview, submissão ao provider e validação leem da
declaração. O spec do arquivo cobre o contrato de cada reservada.

### O tipo é o contrato dos templates

Quem decide se um template é válido é **o servidor**, num só lugar
(`conformTemplateToType`, em `providers/template-conformance.util.ts`) — criar, editar e reavaliar
passam por ele, independentemente do que o front validar:

- toda `{{ variável }}` do texto (corpo, header, footer, URL) existe no tipo (custom, reservada
  liberada ou link do sistema);
- toda variável **obrigatória** do tipo é usada no texto;
- botões: espaços obrigatórios presentes, do `kind` certo, URL do tipo; autenticação ignora botões;
- `key` (letra inicial; letras, números e `_`) e `language` (`pt`, `pt-BR`) têm formato validado no DTO.

**Alterar o tipo reavalia os templates dele.** Só variáveis e botões são o contrato (renomear o tipo não
mexe em nada). Cada template é checado contra o contrato novo: o que deixou de cumpri-lo fica
**inválido** (`invalidatedAt` + `invalidReason`, "Requer ajuste" na tela) e **não envia nem é
submetido ao provider** até ser salvo de novo — salvar revalida e libera; o que continua válido não
muda, e um inválido que volta a cumprir o contrato é liberado sozinho. A tela pede confirmação antes
de gravar uma mudança de contrato num tipo em uso. Mudar a base de um link do sistema reescreve a URL
dos templates e marca a submissão como `outOfSync`.

**Excluir tipo em uso é recusado** (409 listando os templates) e o botão fica desabilitado
(`templatesCount` vem na listagem). Para sair, remova os templates ou mude o tipo deles.

### Regras de aprovação do provider

Providers com `template.approval` recusam templates por regras de redação. As que dá para saber de
antemão vivem em **um só módulo** (`providers/meta-template-rules.ts`) e rodam na **submissão** e em
`POST /messaging/templates/check-meta`, nunca ao salvar no catálogo. Erro bloqueia a submissão;
aviso só informa. O front não duplica a regra: traduz `code` + `params`. Catálogo de regras e como
adicionar uma: [[messaging-providers]].

### Enviar template a partir de outro módulo

Importe `MessagingModule` e injete `MessagingService`:

```ts
await messaging.sendTemplate(
  {
    key: 'ORDER_UPDATE',          // ou templateId; language padrão pt-BR
    phone,
    values: { order_id: '42' },   // variáveis custom do tipo
    reserved: { [ReservedVariableKey.FIRST_NAME]: user.name }, // chave + dado BRUTO
  },
  { userId },
);
// trySendTemplate(...) devolve null em vez de lançar (mensagem como extra)
```

Reservada: o chamador passa a chave e o dado bruto; `normalize` da declaração formata (`first_name`
extrai o primeiro nome, uma data vira o formato da declaração). Sem `reserved`, vale o contexto
(`fromContext`, hoje o contato do telefone) e depois o `fallback`/erro. **`reserved` só existe na API
interna**: o `POST /messaging/messages` não o repassa, então quem usa o HTTP nunca escolhe o valor
de uma reservada, e ela vence o que vier em `values`.

O envio respeita o opt-out (o template pode furá-lo com `bypassOptOut`) e, em conexão com aprovação
de template, exige o template aprovado.

**Nunca texto cru**: placeholder sem valor derruba o envio (400) em vez de mandar `{{ nome }}` ao
destinatário.

### Variável `sensitive`

Para valores que não podem ficar legíveis (ex.: código de verificação), marque `sensitive` na
variável custom (ou na declaração da reservada). O histórico (`text`/`raw`) guarda `••••••`; o valor
real viaja só no job da fila (`removeOnFail` de 1h) e no provider. Consequências: a linha mascarada
não pode ser reenviada sem o conteúdo original, o eco do provider não sobrescreve o `raw`, e a tool de
IA **recusa** template com variável sensível (o valor passaria pela conversa). Limite conhecido: o
eco do provider que chega antes do id pode gravar o texto real em uma linha temporária, removida no
envio.

### Botões tipados e eventos de toque

Mesma premissa das reservadas: o **tipo** é o contrato (para o dev), o **template** só escolhe o
texto, e o módulo que envia informa **chave + valor**. `MessagingTemplateType.buttons` guarda os
espaços; `backend-nest/src/domain/messaging/messaging-buttons.const.ts` é o registro único dos
**reservados** (`ReservedButtonKey` / `RESERVED_BUTTONS`; hoje `opt_out`, com comportamento embutido).

Dois tipos de espaço — só `QUICK_REPLY` gera evento, porque é a única resposta que o provider devolve com payload:

| Espaço | Quem define | Envio | Evento |
|---|---|---|---|
| `QUICK_REPLY` | chave no tipo; texto no template | payload = `chave` ou `chave:dado` | webhook devolve o payload → handler |
| `URL` (link do sistema) | `urlBase` fixa no tipo; texto no template | sufixo por envio (`buttons: { chave: 'token' }`) | nenhum (o clique vai ao navegador) |

**Link do usuário continua sendo botão livre** no template (sem `slot`): escrito por quem cria o
template, sem chave e sem evento. Botão do tipo é o que o sistema controla.

Envio — reservado por enum, custom por nome, como em `reserved`/`values`:

```ts
await messaging.sendTemplate(
  {
    key: 'ORDER_UPDATE', phone,
    values: { order_id: '42' },
    buttons: { details: 'ref-9', track: 'tok_abc', [ReservedButtonKey.OPT_OUT]: true },
  },
  { correlation: { type: 'order', id: '42' } },   // devolvida ao handler
);
```

- Chave que o template não tem é **400** (typo não passa calado). Link do sistema sem sufixo é 400.
- `buttons` existe só na API interna: o `POST /messaging/messages` não o repassa. Por isso template
  com link do sistema não pode ser enviado pelo chat.
- Sufixo `sensitive` é mascarado no histórico, como variável `sensitive`. **O payload vai ao aparelho
  do cliente: nunca ponha segredo nele**; o contexto de negócio viaja em `correlation`.
- O template guarda, em cada botão do tipo, só o `slot` e o texto; a URL é sempre a do tipo
  (`urlBase{{ chave }}`), reescrita se a base mudar (a submissão fica `outOfSync`). O payload nunca é
  salvo — nasce no envio, sem passar pela aprovação do provider.
- Tipo: espaço **em uso** por template não pode ser removido nem mudar de `kind` (409 listando quem
  usa). A chave de um botão URL não pode colidir com nome de variável (dividem o `{{ nome }}`).
- Categoria `AUTHENTICATION` ignora botões nossos (o provider usa o próprio fluxo de código).

**Do toque ao handler**

1. Webhook → `messaging-inbound` → `saveIncoming` grava a mensagem de entrada com
   `replyToProviderMessageId` (`context.id`) e chama `MessagingButtonEventService.capture`.
2. `capture` decodifica o payload (formato diferente = ignora; vira só texto no chat), acha a
   mensagem **nossa** respondida (→ `templateId`, tipo, `correlation`) e grava `MessagingButtonEvent`.
   `messageId` é único: webhook reentregue não duplica.
3. O evento entra na fila `messaging-buttons` (5 tentativas, backoff exponencial). O processor roda
   os handlers de `(tipo, botão)` e marca `PROCESSED`; sem handler = `IGNORED`; erro = `FAILED`
   (+ retentativa). **Handlers precisam ser idempotentes** — o cliente pode tocar várias vezes.

Registrar um handler (em `onModuleInit` do seu módulo; `MessagingModule` exporta o registro):

```ts
registry.register({ type: 'ORDER_UPDATE', button: 'details' }, async (event) => {
  // event: { typeKey, buttonKey, data, phone, connectionId, templateId,
  //          originalMessageId, correlation, messageId, at }
});
```

`type` ausente vale para qualquer tipo (é o caso dos reservados, registrados por
`ReservedButtonHandlers`). `GET /messaging/template-buttons` expõe os reservados e os handlers
registrados — a tela do tipo mostra "handler registrado: sim/não" por botão.

**Limites**: botões interativos dependem da capability `components.buttons` do provider (varia por provider;
ver [[messaging-providers]]). Sem ela o botão vira texto e o cliente responde digitando, sem
evento. A tela desabilita a criação de botões livres sem conexão que os envie, mas os botões do tipo
continuam editáveis (são o contrato). Quem consome eventos precisa tolerar a **ausência** de resposta.

### Agente de IA

`list_whatsapp_templates` mostra os templates e, por template, o que o agente informa (`values` e
`reserved.provide`), o que o sistema preenche (`reserved.auto`), o tipo, se está inválido e
`sendableByAgent` (falso se inválido ou com link do sistema, cujo sufixo só o código informa).
`list_whatsapp_template_types` expõe o contrato dos tipos **somente leitura** — o agente nunca cria
nem altera tipo (contrato de código; alterar invalida templates). `send_whatsapp_template` envia
(sem `buttons`/`correlation`: isso é API interna). Mensagem livre fora da janela de atendimento é
recusada; a descrição das tools avisa o agente.

**Criar template pelo agente** são duas tools separadas, cada uma com aprovação do scope
`messaging:write`: `create_whatsapp_template` grava só o **rascunho** (mesma validação do servidor,
tipo pela chave, sem `bypassOptOut`) e devolve `metaRules` (erros/avisos da Meta); só
`submit_whatsapp_template` envia ao provider (ação externa, mesma checagem de regras de erro da
submissão manual). Tipos continuam só leitura.
Ver [[ai-tools]].

## API

Todas as rotas de operador são ADMIN-only. `MESSAGING` é o kill-switch; `MESSAGING_CONTACTS` e
`MESSAGING_CHAT` são filhas e herdam o estado do pai.

| Método | Rota | Feature flag | Uso |
|---|---|---|---|
| `POST` | `/messaging/messages` | `MESSAGING` | Enfileira envio; segue disponível para envio transacional sem a UI de chat. |
| `POST` | `/messaging/presence` | `MESSAGING_CHAT` | Avisa o provider que o operador está digitando/gravando. Efêmero: nada é gravado; provider sem a capability é aceito e ignorado. |
| `GET` | `/messaging/messages` | `MESSAGING_CHAT` | Histórico paginado por conexão/telefone/direção. |
| `GET` | `/messaging/messages/:id/media` | `MESSAGING_CHAT` | Mídia sob demanda, com byte-range. |
| `GET` | `/messaging/contacts` | `MESSAGING_CONTACTS` | Busca por telefone/nome, ordenada por atividade. |
| `POST` | `/messaging/contacts` | `MESSAGING_CONTACTS` | Cria o contato pelo telefone, sem conversa (409 se já existe). |
| `GET` | `/messaging/conversations` | `MESSAGING_CONTACTS` | Threads de um telefone (`?phone=`), para o seletor de conversa. |
| `GET` | `/messaging/contacts/:id/photo` | `MESSAGING_CONTACTS` | Foto renovada (a URL do CDN expira). |
| `PATCH` | `/messaging/contacts/:id` | `MESSAGING_CONTACTS` | Atualiza nome e opt-out. |
| `GET` | `/messaging/events` | `MESSAGING` | Stream SSE de mudanças. |
| `GET`, `POST` | `/messaging/connections` | — | Lista e cria conexão. |
| `PUT` | `/messaging/connections/:id` | — | Edita credenciais (provider e número são imutáveis). |
| `DELETE` | `/messaging/connections/:id` | — | **Arquiva**: tira de uso e libera o número. |
| `POST` | `/messaging/connections/:id/restore` | — | Restaura uma conexão arquivada (revalida credenciais e número). |
| `PUT` | `/messaging/connections/:id/default` | — | Define a conexão padrão. |
| `GET` | `/messaging/connections/:id/capabilities` | `MESSAGING_CHAT` | Tipos disponíveis, modo de template, voz e presença (digitando). |
| `GET` | `/messaging/connections/:id/health` | — | Estado operacional. |
| `POST`, `GET`, `DELETE` | `/messaging/connections/:id/session` | — | Conectar (QR), consultar e desparear. |
| `POST` | `/messaging/templates/check-meta` | `MESSAGING_TEMPLATES` | Confere um rascunho contra as regras de aprovação do provider (nada é gravado). |
| `GET` | `/messaging/template-buttons` | `MESSAGING_TEMPLATES` | Botões reservados liberáveis e handlers de botão registrados em código. |
| `GET`, `POST` | `/messaging/webhook` | `MESSAGING` | Handshake do provider e eventos; público, autenticado por chave/assinatura. |

`POST /messaging/messages` usa `messaging:write`; leitura usa `messaging:read`. Credenciais e
payloads crus de webhook não são retornados pelas tools de IA.
No corpo do envio, `phone` é obrigatório e `connectionId` é opcional; quando omitido, a conexão
padrão envia a mensagem.

> A flag `MESSAGING` nasce **sem roles associadas**, igual a `OAUTH_LOGIN`: flag sem allowlist
> devolve `enabled` puro para qualquer `roleName`, inclusive o vazio de chamada de sistema (cron,
> job) e do webhook anônimo. Associar uma role aqui faz o inbound e todo envio automático pararem em
> silêncio. Quem controla acesso às telas é o `RoleRouteAccess`, não esta flag.

## Frontend

`frontend-next/src/app/(private)/(admin)/comunicacao/` lista contatos e abre uma janela por
conversa, chaveada por `connectionId:phone`. As janelas ficam abertas em paralelo; thread, composer
e stream SSE são compartilhados.

**A conexão da conversa é a que responde.** Com duas conexões configuradas, um contato que escreveu
por um provider recebe a resposta por ele — a conexão padrão só vale para quem envia sem
escolher. Capability e health controlam quais tipos podem ser enviados e se o composer fica
habilitado.

## Adicionar um provider

1. Declare o schema de config e `messagingCapabilities`; implemente `use()` e `capabilities()`.
2. Exponha `session` só se o provider pareia; `accountPhone` só se ele informa o número sem
   pareamento.
3. Valor que o sistema gera (UUID de instância, token) é `systemFields?()`, nunca campo do DTO
   admin-facing.
4. Registre o adapter em `messaging-provider.registry.ts` — é a única linha que liga tipo a adapter.
5. Acrescente o valor ao enum Prisma e ao `messaging.const.ts`, e rode a migration.
6. Escreva specs cobrindo payloads de webhook, capabilities e sessão.
7. Documente o provider em [[messaging-providers]].

O formulário de cada provider na aba de configuração ainda tem partes hardcoded; detalhes e dívida
conhecida em [[messaging-providers]].

Não adicione configuração de provider à tabela de mensagens: ela é da conexão.
