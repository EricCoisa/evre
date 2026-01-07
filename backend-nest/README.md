# Backend Template – NestJS

## 📌 Visão Geral

Template NestJS robusto e production-ready com autenticação JWT, RBAC, internacionalização (i18n) e documentação Swagger traduzida.

O objetivo é servir como base para novos projetos — ao copiar este template, o backend segue independente sem vínculo com o original.

## 🚀 Tecnologias Utilizadas

- **Node.js v22+**
- **NestJS 11** (arquitetura modular)
- **TypeScript** (strict mode)
- **Prisma ORM** (PostgreSQL)
- **PostgreSQL** (database)
- **JWT Authentication** (access + refresh tokens)
- **Bcrypt** (hash de senhas)
- **Zod** (validação via nestjs-zod)
- **nestjs-i18n** (multi-idioma)
- **Swagger/OpenAPI** (documentação traduzida)
- **Helmet** (segurança HTTP)
- **Throttler** (rate limiting)

## 📂 Estrutura do Projeto

```
backend-nest/
│
├── src/
│   ├── modules/
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── entities/
│   │   │   │   └── user.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-user.dto.ts
│   │   │       └── update-user.dto.ts
│   │   │
│   │   └── auth/
│   │       ├── auth.module.ts
│   │       ├── auth.controller.ts
│   │       ├── auth.service.ts
│   │       ├── strategies/
│   │       └── guards/
│   │
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── utils/
│   │
│   ├── config/
│   │   └── database.config.ts
│   │
│   ├── prisma/ (ou database/)
│   │   └── prisma.service.ts
│   │
│   ├── app.module.ts
│   └── main.ts
│
├── prisma/ (migration files)
├── test/
│
├── docker-compose.yml (opcional)
├── Dockerfile (opcional)
├── package.json
├── tsconfig.json
└── README.md

## 🔑 Funcionalidades Incluídas

### ✔️ Autenticação & Autorização

- **JWT Authentication** (access token 15min, refresh token 7 dias)
- **RBAC** (Role-Based Access Control) com 3 roles: `ADMIN`, `MODERATOR`, `USER`
- **Guards customizados** (JwtAuthGuard, RolesGuard, LocalAuthGuard)
- **Decorators** (@CurrentUser, @Roles, @Public)
- Endpoints separados: `/auth/me` (JWT data) e `/user/profile` (DB data)

### ✔️ Internacionalização (i18n)

- **Multi-idioma** (pt-BR e en)
- Suporte via query parameter (`?lang=en`), header (`X-Language`, `Accept-Language`)
- Traduções para validações, erros e respostas
- **Swagger traduzido dinamicamente** (português e inglês)

### ✔️ Gestão de Usuários

- CRUD completo de usuários
- Validação com Zod schemas
- Criptografia de senhas (bcrypt 10 rounds)
- Endpoints protegidos por role

### ✔️ API Decorators Customizados

- **@GetApi, @PostApi, @PutApi, @PatchApi, @DeleteApi**
- Redução de ~43% de código verboso
- Auto-aplicação de guards, Swagger docs e validações

### ✔️ Arquitetura Modular

- Estrutura escalável por domínios
- Separação clara de responsabilidades
- Type-safe em todo codebase

### ✔️ Segurança

- Helmet (headers HTTP seguros)
- Rate limiting (Throttler: 10 req/min)
- CORS habilitado
- Validação global de DTOs

### ✔️ Documentação Swagger

- Interface interativa em `/api/docs`
- Suporte a múltiplos idiomas (dropdown pt-BR/en)
- Endpoints JSON traduzidos: `/api/docs-json?lang=en`

### ✔️ Observabilidade

- Global exception filter com i18n
- Logging interceptor
- Health check endpoint

### ✔️ Lint + Prettier configurados

Padronização garantida entre projetos derivados do template.

## 🐳 Executando com Docker

```bash
docker-compose up --build
```

A API sobe em:
- 👉 `http://localhost:3000`

Postgres em:
- 👉 `localhost:5432`

## 🧪 Execução sem Docker

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar .env

Crie um arquivo:

```env

```

### 3. Rodar migrations (se usar Prisma)

```bash
npx prisma migrate dev
```

### 4. Iniciar

```bash
npm run start:dev
```

## 📘 Documentação da API

### Swagger UI (Interface Interativa)
- 👉 `http://localhost:3000/api/docs`
- **Trocar idioma**: Acesse `/api/docs-json?lang=en` ou `/api/docs-json?lang=pt-BR` no navegador

### Swagger JSON Traduzido
- Português: `http://localhost:3000/api/docs-json?lang=pt-BR`
- English: `http://localhost:3000/api/docs-json?lang=en`

### Documentação i18n
- Ver `I18N.md` para guia completo de internacionalização

## 🎯 Como usar este template em novos projetos

1. **Renomeie o projeto** (ex.: `empresaX-api`):
   - Ajuste `package.json`
   - Ajuste `.env.example`
   - Ajuste o `README.md`

2. **Atualize informações específicas do cliente**

3. **Comece a desenvolver funcionalidades do projeto final**

## 🧩 Padrões e Convenções

### Estrutura de Módulos
- **Módulos**: Cada domínio em `/src/modules/nome-do-modulo`
- `*.module.ts` - Módulo NestJS
- `*.controller.ts` - Endpoints HTTP (usa decorators customizados)
- `*.service.ts` - Lógica de negócio (injeta I18nService quando necessário)
- `dto/` - DTOs com Zod schemas
- `strategies/` - Estratégias Passport (auth)
- `guards/` - Guards customizados
- `decorators/` - Decorators reutilizáveis

### Decorators Customizados
```typescript
@GetApi({ 
  summary: 'user.profile.title',
  authenticated: true 
})
@PostApi({ 
  summary: 'auth.register.title',
  roles: ['ADMIN'],
  body: RegisterDto 
})
```

### Controllers
- **Finos** - apenas recebem requests e chamam services
- **Type-safe** - usam interfaces `AuthenticatedUser`, `UserPayload`
- Mensagens de resposta traduzidas via `this.i18n.t('key')`

### Services
- Contêm lógica de negócio
- Injetam `I18nService` para mensagens traduzidas
- Lançam exceptions com chaves de tradução

### Validação
- Zod schemas via `nestjs-zod`
- Mensagens de erro traduzidas automaticamente
- Pipe global aplicado

### Internacionalização
- Chaves de tradução em `src/i18n/{lang}/*.json`
- Formato: `categoria.subcategoria.mensagem`
- Interpolação: `this.i18n.t('key', { args: { name: 'valor' } })`

### Autenticação
- JWT com 2 tokens (access + refresh)
- Roles: `ADMIN`, `MODERATOR`, `USER`
- Separação: auth/me (JWT) vs users/profile (DB)

## 📦 Scripts Úteis

| Script | Descrição |
|--------|----------|
| `npm run start:dev` | Desenvolvimento (watch mode + Prisma generate) |
| `npm run build` | Build de produção |
| `npm run start:prod` | Executa build de produção |
| `npm run lint` | ESLint com auto-fix |
| `npm run format` | Prettier (formatar código) |
| `npm run test` | Rodar testes |
| `npx prisma generate` | Gerar Prisma Client |
| `npx prisma migrate dev` | Criar/aplicar migrations |
| `npx prisma studio` | Interface visual do banco |

## 🌍 Multi-idioma (i18n)

### Idiomas Suportados
- Português (pt-BR) - padrão
- English (en)

### Como usar
```typescript
// Em services
constructor(private i18n: I18nService) {}

throw new NotFoundException(
  this.i18n.t('user.not_found')
);
```

### Trocar idioma nas requisições
- Query: `GET /api/user?lang=en`
- Header: `X-Language: en`
- Header: `Accept-Language: en`

### Adicionar novo idioma
1. Criar pasta `src/i18n/es/`
2. Copiar estrutura de `pt-BR/`
3. Traduzir arquivos JSON
4. Adicionar resolver em `app.module.ts`

## 🔐 RBAC (Controle de Acesso)

### Roles Disponíveis
- `ADMIN` - Acesso total
- `MODERATOR` - Moderação de conteúdo
- `USER` - Usuário comum

### Proteger Endpoints
```typescript
@GetApi({
  path: 'admin-only',
  summary: 'Apenas admins',
  roles: ['ADMIN']  // ✅ Auto-aplica guards
})
```

### Obter Usuário Autenticado
```typescript
@GetApi({ authenticated: true })
getProfile(@CurrentUser() user: AuthenticatedUser) {
  // user.id, user.email, user.role
}
```
## 📝 Licença

Este template é livre para uso dentro dos projetos internos e de clientes.

---

**Desenvolvido com ❤️ usando NestJS**