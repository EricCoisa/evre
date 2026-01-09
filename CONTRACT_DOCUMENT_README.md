# Módulo ContractDocument

## 📋 Visão Geral

O módulo **ContractDocument** foi criado para gerenciar documentos de acordo estruturados que representam contratos entre partes. Este módulo:

- ✅ **NÃO** é um contrato jurídico válido
- ✅ Serve para registrar intenção e compromisso
- ✅ É versionável e editável
- ✅ Usa JSON semântico para armazenar conteúdo
- ✅ Permite geração futura de PDF
- ✅ Pode evoluir para contrato jurídico real

## 🏗️ Arquitetura

### Backend (NestJS + Prisma)

#### Estrutura de Arquivos

```
backend-nest/
├── prisma/
│   └── schema.prisma                    # Model ContractDocument
├── src/
│   ├── domain/
│   │   └── contract-document/
│   │       ├── contract-document.entity.ts
│   │       └── contractStatus.const.ts
│   └── modules/
│       └── contract-document/
│           ├── contract-document.module.ts
│           ├── contract-document.controller.ts
│           ├── contract-document.service.ts
│           └── dto/
│               ├── create-contract-document.dto.ts
│               ├── update-contract-document-content.dto.ts
│               └── contract-document.dto.ts
```

#### Model Prisma

```prisma
enum ContractStatus {
  DRAFT      // Rascunho - editável
  SENT       // Enviado - aguardando aceitação
  ACCEPTED   // Aceito - finalizado
  ARCHIVED   // Arquivado
}

model ContractDocument {
  id                    String
  projectId             String         // Obrigatório
  proposalId            String?        // Opcional
  name                  String
  version               Int            // Versionamento explícito
  status                ContractStatus
  contentSchemaVersion  String
  content               String         // JSON semântico
  createdAt             DateTime
  updatedAt             DateTime

  project               Project
  proposal              Proposal?
}
```

#### Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/contract-documents` | Lista todos os contratos (com paginação) |
| GET | `/contract-documents/:id` | Busca contrato por ID |
| GET | `/contract-documents/project/:projectId` | Busca contratos de um projeto |
| POST | `/contract-documents` | Cria novo contrato |
| PUT | `/contract-documents/:id/content` | Atualiza conteúdo (somente DRAFT) |
| POST | `/contract-documents/:id/send` | Envia contrato (DRAFT → SENT) |
| POST | `/contract-documents/:id/accept` | Aceita contrato (SENT → ACCEPTED) |
| POST | `/contract-documents/:id/archive` | Arquiva contrato |

#### Regras de Negócio

1. **Criação**:
   - Deve estar vinculado a um `Project` existente
   - Pode referenciar uma `Proposal` (opcional)
   - Conteúdo deve ser JSON válido
   - Status inicial: `DRAFT`
   - Versão inicial: `1`

2. **Edição**:
   - Apenas contratos em `DRAFT` podem ser editados
   - Atualiza `name` e/ou `content`
   - Valida JSON antes de salvar

3. **Fluxo de Status**:
   - `DRAFT` → `SENT` (enviar)
   - `SENT` → `ACCEPTED` (aceitar)
   - Qualquer status → `ARCHIVED` (arquivar)

### Frontend (Next.js/React)

#### Estrutura de Arquivos

```
frontend-next/
└── src/
    ├── lib/
    │   └── actions/
    │       └── contract-document/
    │           ├── types.ts
    │           ├── api.ts
    │           └── queries.ts
    └── app/
        └── (private)/
            └── contract-document/
                ├── page.tsx                           # Listagem
                ├── components/
                │   └── contract-document-columns.tsx
                └── [id]/
                    ├── page.tsx                       # Server Component
                    └── components/
                        └── contract-document-detail-client.tsx
```

#### Páginas

1. **Listagem** (`/contract-document`):
   - Tabela com paginação, busca e filtros
   - Ações: visualizar, enviar, aceitar, arquivar
   - Modal de criação com formulário

2. **Detalhe** (`/contract-document/[id]`):
   - Informações do contrato
   - Visualização/edição do conteúdo JSON
   - Ações contextuais baseadas no status

## 📝 Estrutura do Conteúdo JSON

### Exemplo Semântico

```json
{
  "parties": {
    "provider": {
      "name": "Empresa Fornecedora",
      "cnpj": "00.000.000/0000-00",
      "address": "..."
    },
    "client": {
      "name": "Cliente",
      "cnpj": "11.111.111/0001-11",
      "address": "..."
    }
  },
  "scope": {
    "description": "Desenvolvimento de sistema web"
  },
  "deliverables": [
    {
      "title": "Sistema completo",
      "description": "Aplicação web responsiva"
    }
  ],
  "timeline": {
    "start": "2026-02-01",
    "end": "2026-08-31"
  },
  "payment": {
    "amount": "R$ 50.000,00",
    "terms": "Pagamento em 5 parcelas mensais"
  },
  "terms": [
    {
      "title": "Propriedade Intelectual",
      "content": "..."
    }
  ],
  "disclaimer": "Documento gerado automaticamente para validação. NÃO possui validade jurídica."
}
```

## 🔄 Relação com Proposal

- ContractDocument **NÃO substitui** Proposal
- Pode **referenciar** uma Proposal via `proposalId`
- Proposal é comercial; ContractDocument é acordo formal
- Ambos são editáveis e versionáveis
- Ambos usam JSON para conteúdo

## 🚀 Evolução Futura

### Fase 1 (Atual)
- ✅ CRUD básico
- ✅ Versionamento
- ✅ JSON semântico
- ✅ Fluxo de status simples

### Fase 2 (Próxima)
- [ ] Geração de PDF a partir do JSON
- [ ] Integração com LLM para geração/revisão
- [ ] Histórico de alterações
- [ ] Assinatura digital básica

### Fase 3 (Futuro)
- [ ] Validação jurídica assistida
- [ ] Templates de cláusulas
- [ ] Workflow de aprovações múltiplas
- [ ] Integração com sistemas externos

## ⚠️ O Que NÃO Fazer

❌ **NÃO** criar validação jurídica automática  
❌ **NÃO** assumir validade legal do documento  
❌ **NÃO** misturar lógica de Proposal com Contract  
❌ **NÃO** criar cláusulas fixas/obrigatórias  
❌ **NÃO** adicionar assinatura digital sem planejamento

## 🧪 Testes

### Fluxo Básico de Teste

1. Criar um contrato (DRAFT)
2. Editar o conteúdo JSON
3. Enviar o contrato (SENT)
4. Aceitar o contrato (ACCEPTED)
5. Arquivar se necessário

### Validações

- JSON inválido deve retornar erro claro
- Apenas DRAFT pode ser editado
- Status transitions devem seguir o fluxo

## 📚 Referências

- Inspirado no módulo `Proposal`
- Segue convenções do projeto (ver `IA_context/`)
- Usa padrões de service/controller/dto do NestJS
- Usa DataTable e Form components do frontend
