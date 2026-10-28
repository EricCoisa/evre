import { BadRequestException } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { PresignedUrlQuerySchema } from './presigned-url-query.dto';

/** O pipe é quem valida a query: valor inválido tem de ser 400, nunca um ZodError (500). */
const validate = (value: unknown) =>
  new ZodValidationPipe(PresignedUrlQuerySchema).transform(value, {
    type: 'query',
  } as never);

describe('PresignedUrlQuerySchema', () => {
  it('aceita a public URL salva', () => {
    expect(
      validate({ key: 'http://localhost:3001/uploads/avatars/u1.jpg' }),
    ).toEqual({ key: 'http://localhost:3001/uploads/avatars/u1.jpg' });
  });

  it('aceita uma key crua (sem URL)', () => {
    expect(validate({ key: 'avatars/u1.jpg' })).toEqual({
      key: 'avatars/u1.jpg',
    });
  });

  it('rejeita key com path traversal com 400', () => {
    expect(() => validate({ key: '../../../etc/passwd' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      validate({ key: 'http://localhost:3001/uploads/../../../etc/passwd' }),
    ).toThrow(BadRequestException);
  });

  it('rejeita key vazia com 400', () => {
    expect(() => validate({ key: '' })).toThrow(BadRequestException);
  });
});
