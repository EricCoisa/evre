---
title: Captcha (anti-bot)
tags: [backend, auth, captcha, security]
---

# Captcha (anti-bot)

Exigência de captcha em **login**, **cadastro** e **recuperação de senha**, com três providers
suportados e **uma única implementação**. Quem escolhe o provider é o dono do sistema, em
`/settings` → aba **Captcha** — não o código.

Nasce **desligado**: template novo sobe sem captcha e sem ninguém configurar nada.

Ver [[observability]] para os limites de taxa que operam junto, e [[auth-rbac]] para o resto da
autenticação.

## Por que é agnóstico

Os três providers falam o **mesmo protocolo de verificação**: `POST` form-urlencoded com `secret`,
`response` e `remoteip` opcional, devolvendo `{ success, score? }`. Só muda a URL.

É por isso que suportar três custa uma **tabela**, não três integrações, e sem dependência nenhuma:
a verificação é um `fetch` no `CaptchaService`.

`src/domain/auth/captcha.const.ts`:

| Provider | Widget | Particularidade |
|---|---|---|
| `TURNSTILE` (Cloudflare) | visível, auto-resolve | grátis ilimitado, sem cookie do Google |
| `HCAPTCHA` | visível | free tier, foco em privacidade |
| `RECAPTCHA_V3` (Google) | **invisível** | não reprova sozinho — ver o score abaixo |

## Configuração

Quatro chaves em `SystemConfiguration` (ver [[system-configuration]]), seedadas em
`prisma/seeds/system-config.seed.ts`:

| Chave | Tipo | Para quê |
|---|---|---|
| `SYSTEM_CAPTCHA_ENABLED` | BOOLEAN | liga/desliga sem apagar as credenciais |
| `SYSTEM_CAPTCHA_PROVIDER` | ENUM | qual dos três está ativo |
| `SYSTEM_CAPTCHA_SITE_KEY` | STRING | chave pública, vai ao browser |
| `SYSTEM_CAPTCHA_SECRET_KEY` | STRING `secret` | chave privada, nunca sai do backend |

A aba é o `captcha-config-tab.tsx`. O toggle de liga/desliga salva na hora; as **credenciais passam
por um formulário validado**, e nada é gravado se a sonda reprovar — mesma garantia de [[oauth]] e
[[ai]]. O `SYSTEM_CAPTCHA_ENABLED` fica fora desse formulário de propósito: juntá-lo obrigaria a
resolver um captcha só para desligar o captcha.

## Validação das credenciais

`PUT /captcha/config` (ADMIN) valida antes de gravar, via
`CaptchaService.validateConfiguration` → `ProviderResult` → `assertProviderOk`, igual ao resto dos
providers plugáveis do template.

O que dá para validar não é simétrico, e isso define o desenho da tela:

| | Validável? | Como |
|---|---|---|
| **Secret key** | sim, no servidor | o siteverify autentica o secret **antes** de olhar o token, então secret errada devolve `invalid-input-secret` mesmo com token falso — mesma sonda do `OAuthProviderService` |
| **Site key** | não, no servidor | nenhum dos três expõe endpoint que a receba; ela só se prova desenhando o widget |
| **O par** | sim, com token do browser | o token é emitido **pela** site key e conferido **contra** o site do secret; se vierem de sites diferentes, volta `invalid-input-response` |

Por isso o submit da tela resolve o widget **com a site key digitada** (`requestCaptchaToken` em
`hooks/use-captcha.ts`) e manda o token junto com as chaves. Consequências práticas:

- **Site key inválida nem chega ao backend** — o `error-callback` do provider derruba antes, e a tela
  mostra o erro direto.
- **Chaves de projetos diferentes** (o erro mais comum: copiar a site key de um site e o secret de
  outro) voltam com mensagem específica do backend.
- **Sem token** a sonda ainda roda e ainda pega secret errada — só não consegue provar o par. É o
  fallback, não o caminho da tela.

Duas diferenças deliberadas em relação ao `verify()` do fluxo normal:

- **Aqui NÃO falha aberto.** Provider fora do ar reprova a gravação: guardar credencial que ninguém
  conseguiu conferir é pior do que pedir para o admin repetir.
- **Score não entra.** Credencial certa com score baixo continua sendo credencial certa; reprovar a
  configuração por isso travaria o admin sem motivo.

`GET /captcha/providers` (ADMIN) entrega o catálogo com `scriptUrl` de cada provider. A tela desenha
o widget a partir dele, e não de um mapa local — registrar um provider novo não exige tocar no
frontend, mesma regra do `oauth-config-tab.tsx`.

## O fluxo

```
/login | /signup | /forgot-password | /reset-password
   └─▶ GET /captcha/config            (Nest, anônima) → { provider, siteKey, scriptUrl }
   └─▶ useCaptcha() injeta o script e desenha o widget
       submit ─▶ getToken()
          └─▶ header x-captcha-token ─▶ Server Action | route handler ─▶ Nest
                 CaptchaGuard → CaptchaService.verify(token, ip)
                    └─▶ POST siteverify do provider → { success, score? }
```

`GET /captcha/config` é anônima porque a tela de login precisa saber qual widget desenhar **antes**
de existir sessão. Devolve só o que já vai para o browser — o secret key nunca aparece.

## Onde está ligado

`@UseGuards(CaptchaGuard)` + `@RequireCaptcha()` em:

| Rota | Por quê |
|---|---|
| `POST /user/signup` | é a rota que mais justifica o recurso — cadastro em massa por bot |
| `POST /user/signup/confirm` | conclusão do cadastro por senha |
| `POST /auth/login` | brute force de senha |
| `POST /auth/forgot-password` | bombardeio de e-mail |
| `POST /auth/reset-password` | alteração de credencial |
| `POST /auth/accept-invite` | aplicação de role e consumo de convite |
| `POST /auth/oauth/:provider/authorize-url` | início do fluxo externo |
| `POST /auth/oauth/signup/complete` | consentimento final, termos e criação da conta |

No login a ordem é **`CaptchaGuard` antes do `LocalAuthGuard`**: sem isso um bot queima bcrypt e
ainda conta tentativa contra o lockout de uma conta alheia antes de ser recusado.

O callback OIDC não pede CAPTCHA novamente: seu início já foi validado antes do redirect ao provider.

## Decisões operacionais

### Desligado libera; ligado e inválido bloqueia

Quando a chave de habilitação está desligada ou ausente, `verify()` não exige CAPTCHA. Se o recurso
está ligado mas provider/credenciais estão incompletos, a operação protegida falha fechada com erro
operacional genérico. É também por isso que o guard **não** é o `FeatureFlagGuard` de [[feature-flags-backend]]:
aquele devolve 404 quando a feature está off, e 404 no `/auth/login` seria absurdo. A rota existe de
qualquer jeito; o captcha só acrescenta uma exigência.

### Fail-closed quando o provider cai

Timeout de 5 s no siteverify; erro de rede bloqueia a operação com 503 e um warning sem token/secret
no log. O operador deve recuperar o provider ou desligar conscientemente o CAPTCHA antes de retomar
os fluxos protegidos. Senha, lockout por conta e throttle por IP continuam independentes.

O `CaptchaGuard` preserva a indisponibilidade como erro operacional; não libera autenticação quando
não conseguiu validar o desafio.

### reCAPTCHA v3 reprova por score, não por `success`

A v3 responde `success: true` **para bot também**, e devolve um `score` de 0 a 1. Quem decide o corte
é a aplicação. Sem o piso (`minScore: 0.5` no registro) ligar reCAPTCHA v3 aceitaria 100% dos bots —
é a pegadinha clássica da v3, e tem spec cobrindo exatamente esse caso.

Turnstile e hCaptcha não mandam `score`; o piso só é avaliado em quem manda.

## O lado do frontend

`hooks/use-captcha.ts` esconde a diferença entre os três: o formulário chama `getToken()` no submit e
não sabe quem respondeu.

- **Turnstile e hCaptcha** desenham widget e entregam o token por callback.
- **reCAPTCHA v3** não desenha nada; o token nasce no `grecaptcha.execute()` do submit.
- O token é de **uso único**: `getToken()` zera e reseta o widget, senão um segundo submit (erro de
  senha, por exemplo) reenviaria token morto e levaria 403.
- Se o script/widget não gerar token, o formulário bloqueia o submit; o backend também falha fechado.

O token viaja no header `x-captcha-token`, nunca no corpo: nenhum DTO ou schema zod conhece captcha,
e ligar/desligar o recurso não mexe em contrato. Ver [[server-actions]] para a camada de saída.

O `remoteip` mandado ao siteverify é o IP real do usuário, que só existe porque o front repassa o
`X-Forwarded-For` — ver [[observability]].

## Tools do agente

| Tool | O quê |
|---|---|
| `get_captcha_config` | `enabled`, provider, site key **+ o catálogo de providers com os ids válidos** (sem isso o modelo chutaria o `provider` no save). Secret key só como presença |
| `save_captcha_config` | reusa o use-case do `PUT /captcha/config` — valida a secret key no provider antes de gravar |

Ambas `roles: ['ADMIN']`; a escrita exige `system-configuration:write`.

Duas limitações que a descrição da tool declara ao modelo:

- **Sem o `token` do widget**, que só o browser resolve, a validação cobre apenas a secret
  key — a site key entra sem conferência cruzada. Teste a tela de login depois de trocar.
- **A tool não liga nem desliga o captcha.** `SYSTEM_CAPTCHA_ENABLED` fica fora do use-case
  validado (ver acima) e continua acessível por `update_system_configuration`.

## Adicionar um provider

1. Uma entrada em `src/domain/auth/captcha.const.ts` (`verifyUrl` + `scriptUrl`, mais `minScore` se
   ele pontuar em vez de reprovar).
2. O id novo no `options` de `SYSTEM_CAPTCHA_PROVIDER`, em `prisma/seeds/system-config.seed.ts`.
3. Label em `frontend-next/src/locales/*/labelKey.json`.

A tela de configuração não precisa ser tocada: a lista dela vem de `GET /captcha/providers`.

Se o provider tiver API de browser diferente de `render(el, {sitekey, callback})` ou
`execute(siteKey)`, o `use-captcha.ts` também precisa de um ramo. Os três atuais cabem nesses dois.

## O que captcha NÃO resolve

Captcha para **bot anônimo em volume**. Não para:

- **Brute force distribuído** — fazenda de resolução custa ~US$1/1000 e rodar IP é grátis. Quem
  segura isso é o lockout por conta (`validate-user.use-case.ts`, 5 tentativas → 15 min).
- **Bombardeio de e-mail** — quem segura é a janela por destinatário no
  `request-password-reset.use-case.ts`.
- **DoS** — throttler limita abuso por cliente; saturação se resolve na borda. Ver [[observability]].

Ligar captcha sem essas três camadas é trocar defesa real por teatro.
