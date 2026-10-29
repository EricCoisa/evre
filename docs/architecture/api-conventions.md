---
title: Convenções de API
tags: [architecture, backend, frontend, api]
---

# Convenções de API

Como as rotas deste template são desenhadas, e como o contrato chega tipado no frontend. Leia antes de criar ou renomear qualquer endpoint.

O objetivo não é pureza acadêmica — REST no sentido original ([tese do Fielding](https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm)) nem fala de formato de URL. O objetivo é **previsibilidade**: um dev novo (ou um agente) deve conseguir adivinhar o endereço de um recurso sem abrir o Swagger.

## A regra central

> **Segmento de URL identifica uma coisa. Query param filtra, ou carrega um valor que não é identidade.**

O teste: *consigo apontar e dizer "o recurso está neste endereço"?* Sim → segmento. Não → query.

| Intenção | Rota |
|---|---|
| Um item | `GET /recurso/:id` |
| Chave composta (o par **é** a identidade) | `GET /recurso/:aId/:bId` |
| Sub-recurso de um item | `PATCH /recurso/:id/sub` |
| Filtrar a coleção | `GET /recurso?campo=valor` |
| Agir sobre vários por critério | `DELETE /recurso?campo=valor` |
| Do próprio requisitante | `GET /recurso/me` |

Corolários:

- **O método HTTP já é o verbo.** `POST /recurso`, nunca `POST /recurso/criar`.
- **O pai vem antes.** `PATCH /user/:id/profile`, nunca `PATCH /user/profile/:id`.
- **Nada de `get-` no nome.** `GET /user/:id/image`, não `GET /user/:id/get-user-image`.
- **`me` é pseudo-id aceito** para "o recurso do usuário autenticado" — convenção do GitHub, Google e Spotify.

## Colisão de rotas — a armadilha que mais custa caro

O Nest casa rotas na **ordem de declaração dentro do controller**, não por especificidade. Dois paths com a **mesma quantidade de segmentos** disputam o mesmo match, e o primeiro declarado vence. O outro fica inalcançável: sem erro no boot, sem aviso no Swagger, sem falha de teste.

```ts
@Get(':aId/:bId')      // declarado antes
@Get('sub/:aId')       // 2 segmentos também → NUNCA é alcançado
```

Por isso operação em massa vai em **query param na raiz**, não em sub-path: `DELETE /recurso?campo=` tem zero segmentos e não colide com `DELETE /recurso/:aId/:bId`. A ambiguidade some por desenho, não por ordem de declaração.

Quando um módulo tem chave composta, **todo** sub-path de dois segmentos é suspeito. Trave o roteamento com um spec (ver [[testing]]); é o único teste que falha se alguém reordenar as declarações.

Contratos concretos dos módulos de acesso: [[auth-rbac]].

## Valor que contém `/` vai em query, sempre

Caminho de tela, chave de objeto, qualquer coisa com barra: dentro de um segmento exigiria encodar `%2F`, que nginx e Apache **rejeitam por padrão**. Em query param a barra é caractere comum.

Sintoma de que a regra foi violada: alguém removendo ou recolocando barra à mão nos dois lados da chamada.

## Verbo de atualização: `PATCH`, não `PUT`

`PATCH /recurso/:id` é o verbo do template para atualizar um recurso — `feature-flag`, `user`,
`system-configuration`, `messaging-template` e (desde o Ajuste 1) `company` e `proposal` seguem
todos essa convenção. Não há `PUT` de atualização parcial convivendo com `PATCH` no mesmo módulo:
escolha um verbo por módulo e aplique em **todo** sub-recurso dele (`:id`, `:id/layout`,
`:id/contacts/:contactId`, …) — convenção divergente dentro do mesmo controller é o tipo de
inconsistência que a próxima etapa herda e tem que escolher de novo.

`PutApi` continua existindo no decorator para quem precisar de substituição total e idempotente no
sentido estrito do HTTP, mas não é o default deste template.

## `response` é obrigatório em toda rota autenticada

`@GetApi`/`@PostApi`/`@PatchApi`/`@PutApi`/`@DeleteApi` aceitam um bloco `response` (schema do
retorno, usado pelo Swagger e pelo gerador do client). Omitir `response` não impede a rota de
funcionar — ela só sai **sem tipo** do `openapi:export`, e o Orval gera a função do client
retornando `any`/`unknown`.

```ts
@PatchApi({
  path: ':id',
  summary: 'company.update.title',
  body: UpdateCompanyDto,
  status: 'OK',
  authenticated: true,
  roles: ['ADMIN'],
  response: {
    success: [{ status: 'OK', description: 'Company updated', schema: { dto: CompanyDto } }],
  },
})
```

Sem isso, o adapter do frontend (`lib/actions/<feature>/api.ts`) precisa de
`as unknown as Promise<T>` em cada função — o cast que `wrapAs` ([[server-actions]]) existe
justamente para centralizar, quando o tipo do Orval é incompatível de propósito (paginação,
campo genérico). `response` faltando não é esse caso: é tipo nenhum, e o cast vira obrigatório só
para compensar um decorator incompleto. Declare `response` em toda rota nova — é o que mantém o
client gerado tipado sem cast manual.

## Status codes

`status:` no decorator controla o `@HttpCode`. Declare **sempre** — sem ele o Nest usa o default do método (201 para POST, 200 para o resto), e o contrato passa a depender de um detalhe implícito.

| Situação | Código |
|---|---|
| Criou um recurso novo endereçável | `CREATED` (201) |
| Devolve representação ou dado derivado | `OK` (200) |
| Não há corpo útil a devolver | `NO_CONTENT` (204) |

Para `DELETE` a regra é:

> **204** quando o corpo seria só confirmação ou eco da entrada. **200** quando devolve dado que o cliente não tem como derivar.

`{ message: 'removido' }` é confirmação — o status já disse isso. `{ id, revoked: true }` é eco — o cliente mandou o id. `{ count: 12 }` é dado real: só o servidor sabe quantos caíram. Os dois primeiros viram 204; o terceiro fica 200.

> [!warning] `status` e `response.success` são campos independentes
> `status:` define o código real; `response.success[].status` define o que o Swagger documenta. Se divergirem, o `openapi.json` mente e o client gerado nasce com o tipo errado. Mantenha os dois iguais.

O use-case pode continuar retornando `{ message }` mesmo com 204 — o Express descarta o corpo, e as tools de IA (que chamam o use-case direto, sem HTTP) seguem recebendo a confirmação. Ver [[ai-tools]].

## Declare todo parâmetro que o handler lê

Parâmetro lido do request cru (`@Req()`) sem `queries:` no decorator **não existe para o OpenAPI**. Consequência em cadeia: o Orval gera uma função sem onde passar aquele valor, e quem chama é obrigado a montar a URL à mão — o que reintroduz path cravado (ver abaixo).

```ts
// ruim: o contrato não sabe que existe ?token=
async check(@Req() req: Request) { const token = req.query.token; }

// bom
@GetApi({ queries: [{ name: 'token', required: true, type: String }] })
async check(@Query('token') token: string) {}
```

Query param que decide o alvo de uma escrita precisa de **validação obrigatória**: `deleteMany({ where: { campo: undefined } })` no Prisma significa *sem filtro* — apaga a tabela. Valide com Zod antes de chamar o use-case.

## Nenhum path do backend escrito à mão no frontend

Todo endereço vem de artefato gerado. Duas formas, conforme o que a camada pode usar:

| Camada | Usa |
|---|---|
| `lib/actions/**` (server actions) | as **funções geradas** pelo Orval |
| `middleware.ts`, `app/api/**` (edge, cookies, streaming) | as **constantes** de `lib/generated/paths.ts` |

As duas saem do mesmo `npm run generate:api`. Detalhes do pipeline em [[http-client-orval]].

Isso é verificado, não confiado: `frontend-next/src/__tests__/api-paths.test.ts` falha se aparecer path cravado na camada de chamada, ou se `paths.ts` estiver fora de sincronia com o `openapi.json`.

## O que fica fora deste padrão, de propósito

| Superfície | Por quê |
|---|---|
| `auth/*` | Fluxo de sessão não é CRUD. Convenção própria, amplamente aceita. |
| `health/*` | Convenção k8s (`live`/`ready`). |
| `mcp`, `oauth`, `.well-known/*` | Ditados por especificação externa (MCP, RFC 6749/8414/9728). Forçá-los a virar recurso quebraria a interoperabilidade. Ver [[mcp]]. |

Não "conserte" essas.

## Dois desvios deliberados da ortodoxia

Ambos são convenção do template: siga-os em módulo novo, não os "conserte".

- **`DELETE /recurso?campo=` para lote.** A leitura ortodoxa é que `DELETE` age sobre um recurso só, e o guia de API do Google usaria um método customizado (`POST /recurso:batchDelete`). Aqui é query param: `:verbo` é sintaxe que nenhum outro endpoint do template usa, e coerência interna vale mais que aderência a um guia externo.
- **`GET .../me?path=` devolvendo boolean.** Um GET idealmente devolve representação de recurso, não `true`. A alternativa — devolver a coleção filtrada e o cliente checar se veio vazia — jogaria regra de autorização para o cliente, num caminho que decide acesso a todas as telas privadas.

## Mudou o contrato?

```bash
cd backend-nest  && npm run openapi:export
cd frontend-next && npm run generate:api
```

O TypeScript aponta os call-sites quebrados. Rode os specs de roteamento do módulo tocado e o `api-paths.test.ts`.
