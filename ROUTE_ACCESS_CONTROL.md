# Sistema de Controle de Acesso a Rotas

## Visão Geral

Este documento descreve o sistema de validação de acesso a rotas implementado no projeto, que opera inteiramente no lado do servidor (server-side).

## Arquitetura da Solução

### 1. Middleware do Next.js (`frontend-next/src/middleware.ts`)

**Função**: Captura o pathname de cada requisição e injeta no header da request.

```typescript
- Intercepta todas as requisições (exceto assets estáticos e API routes)
- Adiciona o header 'x-pathname' com o caminho real da rota
- Permite que componentes server-side acessem o pathname correto
```

**Benefícios**:
- ✅ Solução nativa do Next.js
- ✅ Executa antes de qualquer componente
- ✅ Sem hardcoded paths

### 2. Layout Privado (`frontend-next/src/app/(private)/layout.tsx`)

**Função**: Valida autenticação e acesso antes de renderizar qualquer página privada.

```typescript
- Lê o pathname do header 'x-pathname'
- Chama validateServerAuth(pathname) para validar
- Executa server-side (não expõe lógica ao cliente)
```

### 3. Validação Server-Side (`frontend-next/src/lib/actions/auth/server-auth.ts`)

**Função**: Valida autenticação e permissões de acesso.

**Recursos implementados**:
- ✅ **Cache inteligente**: Evita múltiplas validações da mesma rota
- ✅ **Rotas públicas**: Lista de rotas que não precisam validação
- ✅ **Rotas auth-only**: Rotas que só precisam de autenticação (sem check de permissão)
- ✅ **Limpeza automática de cache**: Mantém apenas as últimas 100 entradas
- ✅ **TTL de 1 segundo**: Cache expira em 1s para manter dados atualizados

**Fluxo de validação**:
```
1. Ignora rotas públicas (/login, /register, etc)
2. Verifica se usuário está autenticado
3. Ignora rotas que só precisam de autenticação (/, /redirect)
4. Verifica cache (TTL: 1s)
5. Se não está em cache, consulta API
6. Atualiza cache
7. Redireciona se não tiver acesso
```

### 4. API Client (`frontend-next/src/lib/actions/access/userRoute/api.ts`)

**Função**: Comunica com o backend para verificar acesso.

```typescript
- Normaliza o path (remove query params e hash)
- Encode do path para evitar problemas com caracteres especiais
- Chama endpoint /user-route-access/checkAccess/{path}
```

### 5. Backend Controller (`backend-nest/src/modules/user-route-access/user-route-access.controller.ts`)

**Função**: Endpoint REST para validação de acesso.

**Endpoint**: `GET /user-route-access/checkAccess/*`
- ✅ Autenticado (requer JWT)
- ✅ Recebe path como wildcard param
- ✅ Decodifica path automaticamente
- ✅ Retorna boolean (true/false)

### 6. Backend Service (`backend-nest/src/modules/user-route-access/user-route-access.service.ts`)

**Função**: Lógica de negócio para validação de acesso.

**Validação multi-camada**:
```typescript
1. Valida se path não está vazio
2. Decodifica path (se necessário)
3. Busca usuário e sua role
4. Busca rota no banco de dados
5. Verifica se rota existe e está ativa
6. Valida acesso por:
   - UserRouteAccess (permissão individual)
   - RoleRouteAccess (permissão da role)
7. Retorna true se qualquer uma das validações passar
```

**Benefícios**:
- ✅ Validação baseada em banco de dados
- ✅ Suporte a permissões individuais e por role
- ✅ Verifica se rota está ativa
- ✅ Sem hardcoded

## Modelo de Dados

### Tabela: `routes`
```prisma
- id: UUID
- path: String (unique) - Ex: "/dashboard", "/user", "/project"
- labelKey: String - Chave i18n para o label
- icon: String? - Nome do ícone
- parentId: String? - ID da rota pai (hierarquia)
- ordem: Int - Ordem de exibição
- isHome: Boolean - Se é a rota home
- isActive: Boolean - Se a rota está ativa
```

### Tabela: `user_route_accesses`
```prisma
- id: UUID
- userId: String - ID do usuário
- routeId: String - ID da rota
- grantedBy: String? - ID de quem concedeu
- createdAt: DateTime
- Constraint: UNIQUE(userId, routeId)
```

### Tabela: `role_route_accesses`
```prisma
- roleId: UserRole (ADMIN, USER, MODERATOR)
- routeId: String - ID da rota
- Constraint: PRIMARY KEY(roleId, routeId)
```

## Fluxo Completo

```
[Usuário acessa /dashboard]
         ↓
[Middleware] → Adiciona x-pathname: /dashboard
         ↓
[Layout] → Lê x-pathname
         ↓
[validateServerAuth]
    ↓
    ├─ Verifica se é rota pública → Sim → ✅ Permite
    │
    ├─ Verifica token → Não tem → 🚫 Redireciona /login
    │
    ├─ Verifica se é rota auth-only → Sim → ✅ Permite
    │
    ├─ Verifica cache → Tem e válido → ✅/🚫 Usa cache
    │
    └─ Não tem cache → Consulta API
              ↓
    [Backend checkAccess]
              ↓
    ├─ Decodifica path
    ├─ Busca user.role
    ├─ Busca route
    ├─ Verifica isActive
    ├─ Verifica UserRouteAccess
    ├─ Verifica RoleRouteAccess
    └─ Retorna boolean
              ↓
    [Frontend] → Atualiza cache → ✅/🚫 Permite ou Redireciona
```

## Configurações

### Rotas Públicas (não precisam validação)
```typescript
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password'];
```

### Rotas Auth-Only (só precisam autenticação)
```typescript
const AUTH_ONLY_ROUTES = ['/', '/redirect'];
```

### Cache
```typescript
TTL: 1000ms (1 segundo)
Max entries: 100
Cleanup: Remove 50 mais antigas quando ultrapassa 100
```

## Segurança

✅ **Server-Side**: Toda validação ocorre no servidor
✅ **Sem exposição de lógica**: Cliente não tem acesso à lógica de validação
✅ **Cache por usuário**: Cache usa token+path para isolar usuários
✅ **Validação multi-camada**: User + Role + Route active status
✅ **Decode automático**: Previne ataques com caracteres especiais
✅ **Guards**: Validações de entrada em todos os níveis

## Manutenção

### Como adicionar nova rota protegida:
1. Criar entrada na tabela `routes`
2. Criar entrada em `role_route_accesses` (permissão padrão por role)
3. Opcionalmente criar entrada em `user_route_accesses` (permissão individual)
4. ✅ Pronto! Sem código adicional necessário

### Como desabilitar temporariamente uma rota:
```sql
UPDATE routes SET isActive = false WHERE path = '/rota';
```

### Como dar acesso individual a um usuário:
```typescript
// Via API
POST /user-route-access/grant
{
  "userId": "uuid",
  "routeId": "uuid"
}
```

## Performance

- **Cache local**: Evita chamadas desnecessárias à API
- **TTL curto**: Mantém dados atualizados (1s)
- **Lazy validation**: Só valida quando necessário
- **Queries otimizadas**: Índices no banco de dados

## Logs e Auditoria

Todas as operações de grant/revoke são logadas em `system_log`:
- Módulo: `USER_ROUTE_ACCESS`
- Actions: `GRANT`, `REVOKE`, `BULK_REVOKE`
- Metadata: userId, routeId, email, path, etc

## Troubleshooting

### Problema: Usuário não consegue acessar rota que deveria ter permissão
**Solução**:
1. Verificar se rota existe: `SELECT * FROM routes WHERE path = '/path'`
2. Verificar se rota está ativa: `isActive = true`
3. Verificar permissão por role: `SELECT * FROM role_route_accesses WHERE routeId = '...'`
4. Verificar permissão individual: `SELECT * FROM user_route_accesses WHERE userId = '...' AND routeId = '...'`
5. Limpar cache (aguardar 1s ou reiniciar)

### Problema: Validação sendo chamada múltiplas vezes
**Solução**: Implementado cache com TTL de 1s

### Problema: Pathname sempre vem como "/"
**Solução**: Implementado middleware que injeta x-pathname

## Próximos Passos (Opcionais)

- [ ] Implementar hierarchical routes (validação de rotas pai)
- [ ] Adicionar permissões granulares (read, write, delete)
- [ ] Implementar cache distribuído (Redis)
- [ ] Adicionar rate limiting por usuário
- [ ] Implementar audit trail detalhado
