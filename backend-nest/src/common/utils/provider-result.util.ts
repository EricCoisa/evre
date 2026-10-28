import { BadRequestException } from '@nestjs/common';
import type { ProviderResult } from 'src/domain/interface/provider-result';

/** Converte um `ProviderResult` de falha em `BadRequestException`. */
export function assertProviderOk(result: ProviderResult): void {
  if (!result.status) throw new BadRequestException(result.data);
}
