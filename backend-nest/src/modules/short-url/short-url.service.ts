import { Injectable } from '@nestjs/common';
import {
  ShortenUrlUseCase,
  type ShortenUrlInput,
  type ShortenUrlOutput,
} from './use-cases/shorten-url.use-case';
import { DeactivateShortUrlUseCase } from './use-cases/deactivate-short-url.use-case';

/** Ponto de entrada para outros módulos encurtarem/desativarem links por injeção — ver docs/backend/use-cases.md. */
@Injectable()
export class ShortUrlService {
  constructor(
    private readonly shortenUrlUseCase: ShortenUrlUseCase,
    private readonly deactivateShortUrlUseCase: DeactivateShortUrlUseCase,
  ) {}

  async shorten(input: ShortenUrlInput): Promise<ShortenUrlOutput> {
    return this.shortenUrlUseCase.execute(input);
  }

  async deactivate(code: string): Promise<void> {
    return this.deactivateShortUrlUseCase.execute(code);
  }
}
