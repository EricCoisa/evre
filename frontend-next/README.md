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
NEXT_PUBLIC_API_URL=http://localhost:3002
```

### **2. Instalação**

```bash
npm install
```

### **3. Executar em Desenvolvimento**

```bash
npm run dev
```

Aplicação rodará em: `http://localhost:3002`

### **4. Build de Produção**

```bash
npm run build
npm run start
```

---

## 🔧 Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de desenvolvimento
npm run build            # Build de produção
npm run start            # Inicia servidor de produção
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
  origin: process.env.FRONTEND_URL,
  credentials: true,
});
```

---

## 📝 Licença

Este é um template privado para uso interno.

---

## 🚀 Próximas Melhorias

- [ ] Testes unitários (Jest + React Testing Library)
- [ ] Testes E2E (Playwright)
- [ ] Storybook para componentes
- [ ] Password reset flow
- [ ] 2FA (Two-Factor Authentication)
- [ ] Audit logging no frontend