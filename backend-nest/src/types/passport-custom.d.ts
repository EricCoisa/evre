/** Tipos ambiente para `passport-custom`, que não publica os próprios nem tem pacote `@types`. */
declare module 'passport-custom' {
  import type { Request } from 'express';

  export type VerifyCallback = (
    err: Error | null,
    user?: unknown,
    info?: unknown,
  ) => void;

  export type VerifyFunction = (req: Request, done: VerifyCallback) => void;

  export class Strategy {
    constructor(verify: VerifyFunction);
    constructor(options: Record<string, unknown>, verify: VerifyFunction);
    name: string;
    authenticate(req: Request, options?: unknown): void;
  }
}
