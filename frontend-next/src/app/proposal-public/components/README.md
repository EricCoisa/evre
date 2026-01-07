# Componentes de Proposta

Sistema de renderização de propostas baseado em JSON schema.

## Componentes Disponíveis

### 1. Title
Renderiza títulos com diferentes níveis hierárquicos.

```json
{
  "object": "Title",
  "value": "Título Principal",
  "level": 1,
  "className": "text-center"
}
```

**Propriedades:**
- `value` (string, obrigatório): Texto do título
- `level` (1|2|3|4, opcional): Nível hierárquico (padrão: 1)
- `className` (string, opcional): Classes CSS adicionais

---

### 2. Text
Renderiza parágrafos de texto.

```json
{
  "object": "Text",
  "value": "Texto do parágrafo",
  "className": "text-justify"
}
```

**Propriedades:**
- `value` (string | array, obrigatório): Conteúdo do texto ou array de componentes
- `className` (string, opcional): Classes CSS adicionais

---

### 3. Image
Renderiza imagens com legenda.

```json
{
  "object": "Image",
  "value": "https://example.com/image.jpg",
  "alt": "Descrição da imagem",
  "caption": "Legenda da imagem"
}
```

**Propriedades:**
- `value` (string, obrigatório): URL da imagem
- `alt` (string, opcional): Texto alternativo
- `caption` (string, opcional): Legenda
- `className` (string, opcional): Classes CSS adicionais

---

### 4. Topic
Renderiza um tópico destacado com título, descrição e lista de itens.

```json
{
  "object": "Topic",
  "value": {
    "title": "Título do Tópico",
    "description": "Descrição opcional",
    "items": [
      "Item 1",
      "Item 2",
      "Item 3"
    ]
  }
}
```

**Propriedades:**
- `value.title` (string, obrigatório): Título do tópico
- `value.description` (string, opcional): Descrição do tópico
- `value.items` (string[], opcional): Lista de itens
- `className` (string, opcional): Classes CSS adicionais

---

### 5. Container
Agrupa componentes em um container estilizado.

```json
{
  "object": "Container",
  "value": [
    {
      "object": "Title",
      "value": "Título dentro do container"
    },
    {
      "object": "Text",
      "value": "Texto dentro do container"
    }
  ]
}
```

**Propriedades:**
- `value` (string | array, obrigatório): Conteúdo ou array de componentes
- `className` (string, opcional): Classes CSS adicionais

---

## Exemplos Completos

### Exemplo Básico

```json
{
  "version": "v1",
  "components": [
    {
      "object": "Title",
      "value": "Proposta Comercial",
      "level": 1
    },
    {
      "object": "Text",
      "value": "Apresentamos nossa proposta para o projeto."
    }
  ]
}
```

### Exemplo com Tópicos

```json
{
  "version": "v1",
  "components": [
    {
      "object": "Title",
      "value": "Proposta de Desenvolvimento",
      "level": 1
    },
    {
      "object": "Topic",
      "value": {
        "title": "Tecnologias",
        "description": "Stack proposto",
        "items": [
          "Next.js 14",
          "NestJS",
          "PostgreSQL"
        ]
      }
    }
  ]
}
```

### Exemplo com Componentes Aninhados

```json
{
  "version": "v1",
  "components": [
    {
      "object": "Container",
      "value": [
        {
          "object": "Title",
          "value": "Seção Importante",
          "level": 2
        },
        {
          "object": "Text",
          "value": "Conteúdo da seção."
        }
      ]
    }
  ]
}
```

### Exemplo Completo

```json
{
  "version": "v1",
  "components": [
    {
      "object": "Title",
      "value": "Proposta de Software",
      "level": 1
    },
    {
      "object": "Text",
      "value": "Estamos felizes em apresentar nossa proposta."
    },
    {
      "object": "Image",
      "value": "https://images.unsplash.com/photo-1522071820081-009f0129c71c",
      "alt": "Equipe trabalhando",
      "caption": "Nossa equipe"
    },
    {
      "object": "Topic",
      "value": {
        "title": "Fases do Projeto",
        "items": [
          "Fase 1: Planejamento (2 semanas)",
          "Fase 2: Desenvolvimento (8 semanas)",
          "Fase 3: Testes (2 semanas)"
        ]
      }
    },
    {
      "object": "Container",
      "value": [
        {
          "object": "Title",
          "value": "Investimento",
          "level": 3
        },
        {
          "object": "Text",
          "value": "R$ 150.000,00"
        }
      ]
    }
  ]
}
```

## Uso

```tsx
import { ProposalRenderer } from './components/ProposalRenderer';

function ProposalPage() {
  const proposalContent = '{"version":"v1","components":[...]}';
  
  return <ProposalRenderer content={proposalContent} />;
}
```

## Validação

Use a função `isValidComponent` para validar componentes:

```tsx
import { isValidComponent } from './components/proposal-schema';

const component = { object: 'Title', value: 'Teste' };
if (isValidComponent(component)) {
  // Componente válido
}
```
