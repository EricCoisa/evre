# Template Base — Monorepo de Templates

Este repositório contém **todos os templates oficiais** utilizados como ponto de partida para novos projetos. Ele funciona como uma **base padronizada**, garantindo consistência entre equipes, velocidade na criação de novos sistemas e facilidade de manutenção.

Quando um novo projeto é iniciado para um cliente, uma cópia do(s) template(s) necessário(s) é criada em um repositório separado, permitindo que o desenvolvimento siga sua própria linha evolutiva sem afetar a base.

---

## 📦 Estrutura Geral do Repositório

```
template/
├── backend-nest/        → API base com NestJS
├── frontend-next/       → Front-end com Next.js (SSR + áreas administrativas)
├── frontend-vite/       → Front-end com React + Vite (SPA leve, sem admin)
├── ui-components/       → Biblioteca compartilhada de componentes React
├── .gitignore           → Configuração global do monorepo
└── readme.md            → Este arquivo
```

Cada template é totalmente **independente** e **não há referências cruzadas** entre eles. A única exceção planejada é o pacote `ui-components`, cujo objetivo é ser consumido tanto pelo template Next quanto pelo template Vite.

---

## 🧱 Objetivo de Cada Template

### 1️⃣ Backend NestJS

API base seguindo arquitetura modular simplificada do NestJS com:

**Estrutura:**
```
src/
├── modules/
│   └── users/
│       ├── users.module.ts
│       ├── users.controller.ts
│       ├── users.service.ts
│       ├── entities/
│       │   └── user.entity.ts
│       └── dto/
│           ├── create-user.dto.ts
│           └── update-user.dto.ts
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
└── config/
```

**Funcionalidades incluídas:**
- Login (JWT access + refresh)
- Gestão de usuários
- Padrão de DTOs com validação
- Prisma ORM configurado
- Tratamento global de erros
- Documentação Swagger
- Estrutura modular clara e simples

**Convenções:**
- Sem complexidade DDD desnecessária
- Controllers finos (apenas recebem requisições)
- Services contêm a lógica de negócio
- Entities representam modelos de dados
- DTOs obrigatórios para validação
- Repositories apenas quando necessário abstrair persistência

Serve como back-end oficial para ambos os templates de front.

---

### 2️⃣ FrontEnd Next.js

Ideal para produtos que exigem:

* Áreas administrativas
* Dashboards
* Rotas públicas com SEO
* SSR/SSG

Inclui:

* Fluxo de login completo
* Proteção de rotas via middleware
* Layout administrativo base
* Gestão de usuários
* React Query configurado

---

## 3️⃣ FrontEnd Vite (React)

Indicado para:

* Aplicações sem parte administrativa
* SPAs rápidas e leves
* Sistemas internos simples

Inclui:

* Login básico
* Proteção de rotas
* React Query + Axios configurados
* Estrutura de pastas minimalista

---

## 4️⃣ Biblioteca de Componentes (UI Kit)

Biblioteca React compartilhada entre os dois templates front-end.

Contém apenas **componentes visuais genéricos**, como:

* Botões
* Inputs
* Modais
* Tabelas
* Skeletons

Não inclui lógica de negócio nem dependências específicas do ambiente (Next, server components, etc.).

---

# 🚀 Como Usar Este Repositório

## 1. Criando um novo projeto para cliente

1. Escolha os templates necessários (backend + algum front).
2. Copie as pastas para um novo repositório separado.
3. Ajuste o nome do projeto, environemnts e configurações.
4. O projeto agora segue sua própria evolução.

---

# 🔄 Mantendo os Templates Alinhados

Toda evolução na base deve ser sincronizada entre:

* backend-nest
* frontend-next
* frontend-vite
* ui-components

Isso garante consistência e acelera o desenvolvimento de todos os futuros projetos.

---

# 📜 Convenções Gerais (Resumo)

* Uso de TypeScript em todos os templates.
* Padrão unificado de tratamento de erros.
* Fluxo de autenticação idêntico entre os front-ends.
* Estrutura de pastas consistente.
* Componentes visuais centralizados no UI Kit.

---

# 📌 Status

Este repositório está em fase de definição da estrutura base.

A próxima etapa é iniciar a implementação dos templates seguindo este documento.
