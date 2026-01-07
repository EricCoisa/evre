"use client";

import type { ProposalSchema } from './proposal-schema';

/**
 * Exemplo básico de proposta com título e texto
 */
export const basicProposal: ProposalSchema = {
  version: 'v1',
  components: [
    {
      object: 'Title',
      value: 'Proposta Comercial',
      level: 1,
    },
    {
      object: 'Text',
      value: 'Apresentamos nossa proposta comercial para fornecimento de serviços.',
    },
  ],
};

/**
 * Exemplo completo com todos os tipos de componentes
 */
export const fullProposal: ProposalSchema = {
  version: 'v1',
  components: [
    {
      object: 'Title',
      value: 'Proposta de Desenvolvimento de Software',
      level: 1,
    },
    {
      object: 'Text',
      value:
        'Estamos entusiasmados em apresentar nossa proposta para o desenvolvimento de sua nova plataforma web.',
    },
    {
      object: 'Container',
      value: [
        {
          object: 'Title',
          value: 'Sobre o Projeto',
          level: 2,
        },
        {
          object: 'Text',
          value:
            'O projeto consiste no desenvolvimento de uma plataforma web moderna e responsiva, utilizando as mais recentes tecnologias do mercado.',
        },
      ],
    },
    {
      object: 'Topic',
      value: {
        title: 'Tecnologias Utilizadas',
        description: 'Stack tecnológico proposto para o projeto',
        items: [
          'Next.js 14 para o frontend',
          'NestJS para o backend',
          'PostgreSQL como banco de dados',
          'Prisma ORM',
          'TypeScript em todo o projeto',
        ],
      },
    },
    {
      object: 'Image',
      value: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c',
      alt: 'Equipe trabalhando',
      caption: 'Nossa equipe trabalhando em projetos anteriores',
    },
    {
      object: 'Topic',
      value: {
        title: 'Fases do Projeto',
        description: 'Cronograma planejado de entrega',
        items: [
          'Fase 1: Planejamento e Design (2 semanas)',
          'Fase 2: Desenvolvimento Frontend (4 semanas)',
          'Fase 3: Desenvolvimento Backend (4 semanas)',
          'Fase 4: Integração e Testes (2 semanas)',
          'Fase 5: Deploy e Treinamento (1 semana)',
        ],
      },
    },
    {
      object: 'Container',
      value: [
        {
          object: 'Title',
          value: 'Investimento',
          level: 3,
        },
        {
          object: 'Text',
          value:
            'O investimento total para o desenvolvimento completo da plataforma é de R$ 150.000,00, podendo ser parcelado em até 6x.',
        },
      ],
    },
  ],
};

/**
 * Exemplo com componentes aninhados
 */
export const nestedProposal: ProposalSchema = {
  version: 'v1',
  components: [
    {
      object: 'Title',
      value: 'Consultoria em TI',
      level: 1,
    },
    {
      object: 'Container',
      value: [
        {
          object: 'Text',
          value: [
            {
              object: 'Title',
              value: 'Serviços Inclusos',
              level: 3,
            },
            {
              object: 'Text',
              value: 'Nossa consultoria oferece uma gama completa de serviços.',
            },
          ],
        },
      ],
    },
    {
      object: 'Topic',
      value: {
        title: 'Benefícios',
        items: [
          'Redução de custos operacionais',
          'Aumento da produtividade',
          'Segurança da informação',
          'Suporte técnico especializado',
        ],
      },
    },
  ],
};
