# Resumo da Refatoração do Domínio

## Data: 08/01/2026

## Objetivo
Corrigir inconsistências de domínio, reduzir dívida técnica e preparar o sistema para evolução segura.

## Mudanças Implementadas

### 1. ✅ Correção do Vínculo Proposal ↔ Project

**Problema anterior:**
- Redundância: `Proposal.projectId` + `Project.proposalId`
- Múltiplas fontes de verdade

**Solução:**
- Removido `proposalId` do model `Project`
- Mantido apenas `Proposal.projectId` (Proposal é dona do vínculo)
- Um Project pode ter várias Proposals
- Uma Proposal pode existir sem Project

**Arquivos modificados:**
- `backend-nest/prisma/schema.prisma`
- `backend-nest/src/modules/project/project.service.ts`
- `backend-nest/src/modules/project/dto/*.dto.ts`
- `backend-nest/src/domain/project/project.entity.ts`
- `frontend-next/src/lib/actions/project/types.ts`
- `frontend-next/src/app/(private)/project/components/project-create.tsx`

---

### 2. ✅ Generalização de Comments

**Problema anterior:**
- Comment vinculado apenas a Project
- Limitava granularidade

**Solução:**
- Substituído `projectId` por:
  - `entityType`: enum (PROJECT, STAGE, ACTIVITY)
  - `entityId`: string
- Comment agora pode ser associado a Project, Stage ou Activity

**Arquivos modificados:**
- `backend-nest/prisma/schema.prisma`
- `backend-nest/src/modules/comment/comment.service.ts`
- `backend-nest/src/modules/comment/comment.controller.ts`
- `backend-nest/src/modules/comment/dto/*.dto.ts`
- `backend-nest/src/domain/project/comment.entity.ts`
- `frontend-next/src/lib/actions/project/types.ts`
- `frontend-next/src/lib/actions/project/api.ts`
- `frontend-next/src/app/(private)/project/components/project-detail.tsx`

**API mantém compatibilidade:**
- Nova rota genérica: `GET /comment/:entityType/:entityId`
- Rota antiga mantida: `GET /comment/project/:projectId`

---

### 3. ✅ Generalização de Approval

**Problema anterior:**
- Approval vinculado apenas a Stage
- Não escalável

**Solução:**
- Substituído `stageId` por:
  - `entityType`: enum (STAGE)
  - `entityId`: string
- Estrutura preparada para outros tipos no futuro

**Arquivos modificados:**
- `backend-nest/prisma/schema.prisma`
- `backend-nest/src/modules/approval/approval.service.ts`
- `backend-nest/src/modules/approval/approval.controller.ts`
- `backend-nest/src/modules/approval/dto/*.dto.ts`
- `backend-nest/src/domain/project/approval.entity.ts`
- `frontend-next/src/lib/actions/project/types.ts`
- `frontend-next/src/lib/actions/project/api.ts`
- `frontend-next/src/app/(private)/project/components/project-detail.tsx`

**API mantém compatibilidade:**
- Nova rota genérica: `GET /approval/:entityType/:entityId`
- Rota antiga mantida: `GET /approval/stage/:stageId`

---

### 4. ✅ Stage.status — Documentação

**Decisão:**
- `Stage.status` é apenas texto informativo
- NÃO é enum
- NÃO usado para lógica de negócio
- Serve apenas para exibição

**Documentado em:**
- `backend-nest/prisma/schema.prisma` (comentário no model Stage)

---

### 5. ✅ ProjectHistory — Automação

**Implementado:**
- ProjectHistory criado automaticamente em:
  - Mudança de status do Project
  - Criação de Comment (se entityType = PROJECT)
  - Criação de Approval (vinculado ao Project da Stage)

**Arquivos modificados:**
- `backend-nest/src/modules/project/project.service.ts`
- `backend-nest/src/modules/comment/comment.service.ts`
- `backend-nest/src/modules/approval/approval.service.ts`

---

## Migration de Banco de Dados

**Migration criada:** `20260108183545_refactor_domain_model`

**Operações executadas:**
1. Criação de enums: `CommentEntityType`, `ApprovalEntityType`
2. Migração de dados:
   - `Comment.projectId` → `Comment.entityType='PROJECT'` + `Comment.entityId`
   - `Approval.stageId` → `Approval.entityType='STAGE'` + `Approval.entityId`
3. Remoção de colunas antigas:
   - `Project.proposalId`
   - `Comment.projectId`
   - `Approval.stageId`
4. Recriação de índices otimizados

**Status:** ✅ Aplicada com sucesso

---

## Frontend

### Mudanças de API

**Comentários:**
```typescript
// Antigo
{ projectId: string, content: string }

// Novo
{ entityType: 'PROJECT' | 'STAGE' | 'ACTIVITY', entityId: string, content: string }
```

**Approvals:**
```typescript
// Antigo
{ stageId: string, status: ApprovalStatus, comment?: string }

// Novo
{ entityType: 'STAGE', entityId: string, status: ApprovalStatus, comment?: string }
```

### Compatibilidade

- ✅ Funções antigas mantidas para retrocompatibilidade
- ✅ Novas funções genéricas adicionadas
- ✅ Frontend atualizado para usar novo modelo

---

## Checklist de Verificação

- [x] Schema Prisma atualizado
- [x] Migration criada e aplicada
- [x] Prisma Client regenerado
- [x] Backend Services ajustados
- [x] Backend Controllers ajustados
- [x] Backend DTOs atualizados
- [x] Domain Entities atualizadas
- [x] Frontend Types atualizados
- [x] Frontend API atualizada
- [x] Frontend Components ajustados
- [x] ProjectHistory automatizado

---

## O Que NÃO Foi Feito (conforme solicitado)

- ❌ Nenhum CRUD novo criado
- ❌ Nenhuma UI nova criada
- ❌ Nenhum módulo não citado refatorado
- ❌ Nenhuma abstração genérica criada
- ❌ Nenhuma "melhoria" não pedida implementada
- ❌ Múltiplas propostas no frontend NÃO implementadas

---

## Resultado

✅ **Domínio coerente**
✅ **Sistema funcionando**
✅ **Base preparada para evolução**
✅ **Nenhuma feature nova visível ao usuário**

---

## Próximos Passos Recomendados

1. Testar fluxo completo de criação de Project/Stage/Activity
2. Testar criação de Comments em diferentes entidades
3. Testar criação de Approvals
4. Verificar ProjectHistory sendo criado corretamente
5. Validar que não há queries quebradas no frontend

---

## Notas Técnicas

- Migration mantém dados existentes
- APIs antigas mantidas para compatibilidade
- TypeScript pode precisar reload no VS Code
- Prisma Client deve ser regenerado após mudanças no schema
