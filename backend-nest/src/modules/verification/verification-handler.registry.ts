import { Injectable, Logger } from '@nestjs/common';

export interface VerificationHandlerContext {
  userId: string;
  /** Email/telefone que o código confirmou (snapshot de `VerificationCode.target`). */
  target: string;
}

export type VerificationHandler = (
  ctx: VerificationHandlerContext,
) => Promise<void>;

/** Quem reage a uma confirmação bem-sucedida de um purpose, para o caso não-bloqueante. */
@Injectable()
export class VerificationHandlerRegistry {
  private readonly logger = new Logger(VerificationHandlerRegistry.name);
  private readonly entries = new Map<string, VerificationHandler[]>();

  /** Devolve a função que desfaz o registro (útil em testes). */
  register(purpose: string, handler: VerificationHandler): () => void {
    const list = this.entries.get(purpose) ?? [];
    list.push(handler);
    this.entries.set(purpose, list);
    this.logger.log(`Handler de verificação registrado: ${purpose}`);
    return () => {
      const current = this.entries.get(purpose);
      if (!current) return;
      const index = current.indexOf(handler);
      if (index >= 0) current.splice(index, 1);
    };
  }

  /** Sem handler registrado não é erro — o purpose pode depender só do VerificationGuard. */
  async invoke(
    purpose: string,
    ctx: VerificationHandlerContext,
  ): Promise<void> {
    const handlers = this.entries.get(purpose) ?? [];
    for (const handler of handlers) {
      await handler(ctx);
    }
  }
}
