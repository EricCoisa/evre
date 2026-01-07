import { ApiQueryOptions } from '@nestjs/swagger';

export const commonPaginationQueries: ApiQueryOptions[] = [
  {
    name: 'page',
    required: false,
    type: Number,
    description: 'Número da página',
    example: 1,
  },
  {
    name: 'limit',
    required: false,
    type: Number,
    description: 'Quantidade de itens por página (máximo 100)',
    example: 10,
  },
  {
    name: 'pagination',
    required: false,
    type: Boolean,
    description: 'Habilitar/desabilitar paginação',
    example: true,
  },
  {
    name: 'search',
    required: false,
    type: String,
    description: 'Termo de busca',
    example: '',
  },
  {
    name: 'filter',
    required: false,
    type: Object,
    description: 'Filtros adicionais',
    example: {},
  },
];
