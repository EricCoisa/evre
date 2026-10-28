import { BadRequestException } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  ListContactsQuerySchema,
  ListConversationsQuerySchema,
  ListMessagesQuerySchema,
} from './messaging-query.dto';

/** O pipe é quem valida a query: valor inválido tem de ser 400, nunca um ZodError (500). */
const validate = (schema: ZodSchema, value: unknown) =>
  new ZodValidationPipe(schema).transform(value, { type: 'query' } as never);

describe('queries da mensageria', () => {
  it('list converte a query string em número e mantém os filtros', () => {
    expect(
      validate(ListMessagesQuerySchema, {
        page: '2',
        limit: '5',
        direction: 'INBOUND',
      }),
    ).toMatchObject({
      page: 2,
      limit: 5,
      direction: 'INBOUND',
      pagination: true,
    });
  });

  it('list rejeita direction fora do enum com 400', () => {
    expect(() =>
      validate(ListMessagesQuerySchema, { direction: 'SIDEWAYS' }),
    ).toThrow(BadRequestException);
  });

  it('list clampa limit acima do teto em vez de recusar', () => {
    expect(validate(ListMessagesQuerySchema, { limit: '5000' }).limit).toBe(50);
  });

  it('list rejeita parâmetro repetido (array) com 400', () => {
    expect(() =>
      validate(ListMessagesQuerySchema, { phone: ['1', '2'] }),
    ).toThrow(BadRequestException);
  });

  it('contacts apara a busca', () => {
    expect(
      validate(ListContactsQuerySchema, {
        page: '2',
        limit: '5',
        search: '  Ana  ',
      }),
    ).toMatchObject({ page: 2, limit: 5, search: 'Ana' });
  });

  it('conversations exige o telefone com 400', () => {
    expect(
      validate(ListConversationsQuerySchema, { phone: '5511987654321' }),
    ).toEqual({ phone: '5511987654321' });
    expect(() => validate(ListConversationsQuerySchema, {})).toThrow(
      BadRequestException,
    );
    expect(() => validate(ListConversationsQuerySchema, { phone: '' })).toThrow(
      BadRequestException,
    );
  });
});
