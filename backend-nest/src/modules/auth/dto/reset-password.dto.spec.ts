import { ZodValidationPipe } from 'nestjs-zod';
import { ResetPasswordDto } from './reset-password.dto';

const pipe = new ZodValidationPipe(ResetPasswordDto.schema as any);
const parse = (v: unknown) =>
  pipe.transform(v, { type: 'body', metatype: ResetPasswordDto } as any);

describe('ResetPasswordDto', () => {
  it('aceita token e senha forte', () => {
    expect(() =>
      parse({ token: 'abc', password: 'SenhaForte@1' }),
    ).not.toThrow();
  });

  it('rejeita senha vazia', () => {
    expect(() => parse({ token: 'abc', password: '' })).toThrow();
  });

  it('rejeita senha sem caractere especial', () => {
    expect(() => parse({ token: 'abc', password: 'SenhaFraca1' })).toThrow();
  });

  it('rejeita senha sem maiúscula', () => {
    expect(() => parse({ token: 'abc', password: 'senhafraca@1' })).toThrow();
  });

  it('rejeita senha com menos de 8 caracteres', () => {
    expect(() => parse({ token: 'abc', password: 'Ab@1' })).toThrow();
  });

  it('rejeita token vazio', () => {
    expect(() => parse({ token: '', password: 'SenhaForte@1' })).toThrow();
  });
});
