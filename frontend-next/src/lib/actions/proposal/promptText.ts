 export const promptTemplate = `Crie uma proposta comercial em formato JSON seguindo esta estrutura:

  ## Estrutura do JSON

  {
    "version": "v1",
    "components": [
      // Array de componentes
    ]
  }

  ## Componentes Disponíveis

  ### 1. Title - Títulos
  {
    "object": "Title",
    "value": "Texto do título",
    "level": 1  // Níveis: 1, 2, 3 ou 4
  }

  ### 2. Text - Parágrafos
  {
    "object": "Text",
    "value": "Texto do parágrafo"
  }

  ### 3. Container - Agrupar componentes
  {
    "object": "Container",
    "value": [
      // Outros componentes aqui
    ]
  }

  ### 4. Topic - Tópico com lista
  {
    "object": "Topic",
    "value": {
      "title": "Título do tópico",
      "description": "Descrição opcional",
      "items": [
        "Item 1",
        "Item 2"
      ]
    }
  }

  ### 5. Image - Imagens
  {
    "object": "Image",
    "value": "https://url-da-imagem.com/image.jpg",
    "alt": "Texto alternativo",
    "caption": "Legenda da imagem"
  }

  ### 6. Iframe - Conteúdo incorporado
  {
    "object": "Iframe",
    "value": "https://url-do-iframe.com",
    "title": "Título opcional do iframe",
    "width": "100%", // ou número em px
    "height": 400, // altura em px ou string
    "allow": "fullscreen; clipboard-write", // permissões opcionais
    "className": "classe-css-opcional"
    "modal": true // se true, abre em modal ao clicar
  }

  ## Exemplo Completo

  {
    "version": "v1",
    "components": [
      {
        "object": "Title",
        "value": "Proposta de Desenvolvimento Web",
        "level": 1
      },
      {
        "object": "Text",
        "value": "Apresentamos nossa proposta comercial para desenvolvimento de sistema."
      },
      {
        "object": "Topic",
        "value": {
          "title": "Tecnologias",
          "items": ["Next.js", "NestJS", "PostgreSQL"]
        }
      },
      {
        "object": "Container",
        "value": [
          {
            "object": "Title",
            "value": "Investimento",
            "level": 2
          },
          {
            "object": "Text",
            "value": "R$ 150.000,00"
          }
        ]
      },
      {
        "object": "Iframe",
        "value": "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "title": "Vídeo institucional",
        "height": 400
      }
    ]
  }

  ## Sua Tarefa

  Crie uma proposta comercial completa seguindo este formato. Seja criativo e profissional!`;