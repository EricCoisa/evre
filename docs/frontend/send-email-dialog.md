---
title: SendEmailDialog — envio manual de e-mail
tags: [frontend, backend, email, component, agnostic]
---

# SendEmailDialog — envio manual de e-mail

Componente agnóstico de modal para o operador **selecionar um template, preencher as variáveis e enviar um e-mail** a qualquer destinatário sem sair da tela corrente.

Uso inicial: botão por linha na tabela de leads (`/admin/lead`), pré-preenchendo `name` e `message` do lead.

> **Arquivos principais:**
> - Componente: `frontend-next/src/components/send-email-dialog.tsx`
> - Action de envio: `frontend-next/src/lib/actions/email/api.ts → sendEmail()`
> - Endpoint: `POST /api/v1/email/send` (role `ADMIN`)
> - Template HTML: `backend-nest/src/modules/email/template/lead-followup.html`

---

## Fluxo da UI

```
Operador clica no ícone de e-mail na linha do lead
  → SendEmailDialog abre com destinatário pré-preenchido
  → Carrega todos os templates via GET /email/templates
  → Aba "Seguimento de lead" selecionada por padrão
  → Campos "Nome" e "Mensagem" pré-preenchidos com dados do lead
  → Operador edita se necessário + digita o assunto
  → Preview (iframe) atualiza em tempo real
  → Clica em Enviar → POST /email/send → toast de sucesso
```

---

## Componente

```tsx
import { SendEmailDialog } from '@/components/send-email-dialog';

<SendEmailDialog
  open={open}
  onOpenChange={setOpen}
  defaultTo="joao@exemplo.com"
  defaultTemplateType="LEAD_FOLLOWUP"
  defaultVars={{ name: 'João', message: 'Gostaria de saber mais sobre...' }}
/>
```

### Props

| Prop | Tipo | Descrição |
|------|------|-----------|
| `open` | `boolean` | Controla visibilidade do modal |
| `onOpenChange` | `(open: boolean) => void` | Callback de fechar |
| `defaultTo` | `string?` | E-mail do destinatário pré-preenchido |
| `defaultTemplateType` | `string?` | Tipo do template selecionado ao abrir (ex: `'LEAD_FOLLOWUP'`) |
| `defaultVars` | `Record<string, string>?` | Valores iniciais dos campos de variáveis do template |

### Comportamento

- **Templates:** todos os tipos registrados em `EmailTemplateType` aparecem como abas. O operador pode trocar de aba e cada aba guarda seu próprio estado de variáveis.
- **Campos por variável:** para cada `EmailTemplateVariable` do template ativo é renderizado um `Input` (linha única) ou `Textarea` (variáveis `message`, `body`, `content`, `text`). Os `placeholder`s vêm do campo `dummy` da variável.
- **Preview ao vivo:** iframe à direita exibe o HTML do template com os valores atuais interpolados. Suporta blocos `{{#if var}}...{{/if}}` (mesma lógica do backend).
- **Renderização para envio:** os valores são interpolados com escape HTML antes de enviar (`&`, `<`, `>`, `"` escapados), prevenindo XSS no e-mail recebido.
- **Gating:** o botão que abre o dialog fica desabilitado quando `emailOperational === false` (via `useCapability(CAPABILITIES.email)`). Ver [[capabilities]].

---

## Backend — `POST /email/send`

```
POST /api/v1/email/send
Role: ADMIN
Body: { to: string (email), subject: string, html: string }
```

Chama `EmailService.send()` → fila BullMQ `email` → retorno otimista `{ status: true, data: 'queued' }`. Em modo sem fila (dev sem Redis), executa sincronamente.

**Use-case:** `backend-nest/src/modules/email/use-cases/send-email.use-case.ts`

> O endpoint aceita HTML livre — o template é renderizado **no frontend** antes de enviar. Assim o operador pode editar o conteúdo sem uma round-trip extra ao backend.

---

## Template `LEAD_FOLLOWUP`

Tipo registrado em `EmailTemplateType` com arquivo `lead-followup.html`. Aparece na aba "Seguimento de lead" tanto neste dialog quanto no editor de templates em `Settings → Email`.

**Variáveis:**

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `{{name}}` | texto | Nome do contato |
| `{{message}}` | texto (multi-linha) | Mensagem original do contato |

O template é editável pelo admin em Settings → Email (aba "Seguimento de lead") como qualquer outro template do sistema.

---

## Usando o componente em outro módulo

1. **Montar o estado** no `page.tsx` do módulo:

```tsx
const [emailTarget, setEmailTarget] = useState<{ email: string; vars?: Record<string, string> } | null>(null);
```

2. **Passar as props** ao componente:

```tsx
<SendEmailDialog
  open={!!emailTarget}
  onOpenChange={(open) => !open && setEmailTarget(null)}
  defaultTo={emailTarget?.email}
  defaultTemplateType="LEAD_FOLLOWUP"   // ou outro tipo
  defaultVars={emailTarget?.vars}
/>
```

3. **Adicionar o botão** na tabela (mesma convenção do chat):

```tsx
// No getXxxColumns:
onSendEmail?: (item: XxxDto) => void;
emailEnabled?: boolean;
emailOperational?: boolean;

// No cell de actions:
{emailEnabled && onSendEmail && (
  <Button
    size="icon-sm"
    variant="ghost"
    disabled={!emailOperational || !item.email}
    onClick={() => onSendEmail(item)}
  >
    <Mail className="size-4" />
  </Button>
)}
```

4. **Verificar a capability** no page para o `emailOperational`:

```tsx
const { operational: emailOperational } = useCapability(CAPABILITIES.email);
```

---

## Orval — regenerar o cliente após adicionar o endpoint

O `POST /email/send` foi adicionado diretamente ao `customInstance` em `api.ts` para funcionar antes da regereração. Após a primeira execução completa do backend, rode:

```bash
# backend-nest/
npm run openapi:export

# frontend-next/
npm run generate:api
```

Depois substitua a chamada direta ao `customInstance` por `api.emailControllerSend(payload)`.

---

## Referências cruzadas

- [[capabilities]] — como `CAPABILITIES.email` controla o gating do botão
- [[modules]] — inventário do módulo `email` (NestJS)
- [[service-health-gate]] — padrão base de health check que `EMAIL` capability encapsula
