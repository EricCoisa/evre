# Frontend Next.js - Template

Template frontend moderno com Next.js 15, autenticação JWT segura, e componentes shadcn/ui.

---

## 🚀 Stack Tecnológica

- **Framework**: Next.js 15 (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS
- **Componentes UI**: shadcn/ui
- **Gerenciamento de Estado**: @tanstack/react-query
- **Formulários**: react-hook-form + zod
- **HTTP Client**: Axios (custom ApiClient)
- **Autenticação**: JWT com HttpOnly Cookies

---

## 📁 Estrutura do Projeto

```
frontend-next/
├── src/
│   ├── app/                      # App Router (Next.js 15)
│   │   ├── (auth)/              # Grupo de rotas de autenticação
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/         # Grupo de rotas protegidas
│   │   │   └── dashboard/
│   │   ├── api/                 # API Routes
│   │   │   └── auth/
│   │   │       └── logout/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/              # Componentes React
│   │   └── ui/                  # shadcn/ui components
│   ├── lib/                     # Utilitários e configurações
│   │   ├── api/
│   │   │   ├── api-client.ts   # Cliente HTTP centralizado
│   │   │   └── api-error.ts    # Classe de erro customizada
│   │   ├── auth/
│   │   │   └── client-auth.ts  # Funções de autenticação
│   │   └── http/
│   │       └── axios-instance.ts # Configuração do Axios
│   └── types/                   # Tipos TypeScript globais
├── public/
├── .env.local
├── .eslintrc.json
├── components.json              # Configuração shadcn/ui
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

## 🎯 Funcionalidades

### **Autenticação**

- ✅ Login com email e senha
- ✅ Refresh automático de tokens
- ✅ Logout com revogação de tokens
- ✅ Proteção de rotas (middleware)
- ✅ Redirecionamento automático

### **HTTP Client**

```typescript
// ApiClient centralizado
import { ApiClient } from '@/lib/api/api-client';

// POST
const data = await ApiClient.post<LoginResponse>('/auth/login', credentials);

// GET
const user = await ApiClient.get<User>('/user/me');

// Erros são automaticamente tratados
try {
  await ApiClient.post('/auth/login', { email, password });
} catch (error) {
  if (error instanceof ApiError) {
    console.log(error.statusCode); // 401, 400, etc
    console.log(error.messages);   // Array de mensagens
  }
}
```

### **Componentes UI**

Biblioteca shadcn/ui instalada e configurada:

```bash
# Componentes já instalados
- Button
- Input
- Label
- Form (react-hook-form integration)

# Adicionar novos componentes
npx shadcn@latest add [component-name]
```

---

## 🛠️ Configuração e Instalação

### **1. Variáveis de Ambiente**

Crie o arquivo `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### **2. Instalação**

```bash
npm install
```

### **3. Executar em Desenvolvimento**

```bash
npm run dev
```

Aplicação rodará em: `http://localhost:3000`

### **4. Build de Produção**

```bash
npm run build
```

Para **rodar** o build, use o stack Docker — é o mesmo caminho da produção:

```bash
docker compose up -d --build   # na raiz do monorepo
```

Não existe `npm start` aqui de propósito. O `next.config.ts` usa `output: 'standalone'`,
que gera um pacote em `.next/standalone/` incompleto por natureza (sem `.next/static`,
sem `public` inteiro e sem variáveis de ambiente). Quem o completa é o `Dockerfile`, e
duplicar isso num script local daria duas receitas para manter em sincronia.

---

## 🔧 Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de desenvolvimento
npm run build            # Build de produção
npm run lint             # Executa ESLint

# Componentes UI
npx shadcn@latest add [component]  # Adiciona componente shadcn/ui
npx shadcn@latest add button input # Adiciona múltiplos componentes
```

---

## 📚 Recursos e Documentação

- **Next.js**: https://nextjs.org/docs
- **shadcn/ui**: https://ui.shadcn.com
- **Tailwind CSS**: https://tailwindcss.com
- **React Hook Form**: https://react-hook-form.com
- **Zod**: https://zod.dev
- **TanStack Query**: https://tanstack.com/query

---

## 🤝 Integração com Backend

O frontend está configurado para se comunicar com o backend NestJS:

**Endpoints disponíveis:**

```typescript
POST   /auth/login     # Login
POST   /auth/logout    # Logout
POST   /auth/refresh   # Renovar token
GET    /auth/me        # Dados do usuário logado
```

**Fluxo de autenticação:**

1. Frontend envia credenciais para `/auth/login`
2. Backend valida e define cookies HttpOnly
3. Frontend redireciona para área protegida
4. Axios interceptor renova token automaticamente em 401
5. Logout revoga token do banco e limpa cookies

---

## 🐛 Troubleshooting

### **Erro de CORS**

Verifique se o backend está configurado com:

```typescript
// backend: main.ts
app.enableCors({
  origin: process.env.NEXTAUTH_URL,
  credentials: true,
});
```

---

## 📝 Licença

Este é um template privado para uso interno.

---

## API Code Generation (Orval)

The API client code in `src/lib/generated/` is auto-generated from `backend-nest/openapi.json` using [Orval](https://orval.dev/).

### Regenerating after backend changes

```bash
cd frontend-next
npm run generate:api
```

### Source and output

- **Spec**: `backend-nest/openapi.json` (OpenAPI 3.0.3, maintained manually)
- **Generated output**: `src/lib/generated/` (one directory per API tag)
- **Schemas barrel**: `src/lib/generated/index.schemas.ts/index.ts`
- **Config**: `frontend-next/orval.config.ts`

### Adapter pattern

Each module's `api.ts` is a thin adapter over the generated functions. It:
1. Calls the generated factory (e.g. `getRoute()`) to get typed methods
2. Wraps every call in `ApiResponse<T>` — the shape used by all queries and screens
3. Preserves the same exported function names screens already use

```typescript
// Example: src/lib/actions/access/route/api.ts
import { getRoute } from '@/lib/generated/route/route';
const api = getRoute();

export async function getRoutes(params?: PaginationParams) {
  return wrap(() => api.routeFindAll(params));
}
```

The `wrap()` helper converts resolved promises into `{ success, data, message, status }` and catches axios errors uniformly. Screens and `queries.ts` files never need to change unless a function is renamed.

---

## 🚀 Próximas Melhorias

- [ ] Testes unitários (Jest + React Testing Library)
- [ ] Testes E2E (Playwright)
- [ ] Storybook para componentes
- [ ] Password reset flow
- [ ] 2FA (Two-Factor Authentication)
- [ ] Audit logging no frontend