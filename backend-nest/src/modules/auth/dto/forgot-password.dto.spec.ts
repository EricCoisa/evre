import { ZodValidationPipe } from 'nestjs-zod';
import { ForgotPasswordDto } from './forgot-password.dto';

const pipe = new ZodValidationPipe(ForgotPasswordDto.schema as any);
const parse = (v: unknown) =>
  pipe.transform(v, { type: 'body', metatype: ForgotPasswordDto } as any);

describe('ForgotPasswordDto', () => {
  it('aceita email válido', () => {
    expect(() => parse({ email: 'user@example.com' })).not.toThrow();
  });

  it('rejeita string não-email', () => {
    expect(() => parse({ email: 'not-an-email' })).toThrow();
  });

  it('rejeita email vazio', () => {
    expect(() => parse({ email: '' })).toThrow();
  });

  it('rejeita campo ausente', () => {
    expect(() => parse({})).toThrow();
  });
});
