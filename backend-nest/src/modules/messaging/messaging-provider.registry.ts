import { Injectable } from '@nestjs/common';
import type { IMessagingService } from 'src/domain/interface/messaging-provider.interface';
import {
  MessagingProviderConst,
  type MessagingProvider,
} from 'src/domain/messaging/messaging.const';
import { EvolutionApiProvider } from './providers/evolution-api.provider';
import { EvolutionGoProvider } from './providers/evolution-go.provider';
import { MetaProvider } from './providers/meta.provider';

/** Único lugar que liga o tipo de provider ao seu adapter. */
@Injectable()
export class MessagingProviderRegistry {
  private readonly adapters: Record<
    MessagingProvider,
    IMessagingService<unknown>
  >;

  constructor(
    evolutionApi: EvolutionApiProvider,
    evolutionGo: EvolutionGoProvider,
    meta: MetaProvider,
  ) {
    this.adapters = {
      [MessagingProviderConst.EVOLUTION_API]: evolutionApi,
      [MessagingProviderConst.EVOLUTION_GO]: evolutionGo,
      [MessagingProviderConst.META]: meta,
    };
  }

  /** `undefined` para tipo desconhecido (dado vindo do banco ou de fora). */
  find(provider: string): IMessagingService<unknown> | undefined {
    return (this.adapters as Record<string, IMessagingService<unknown>>)[
      provider
    ];
  }

  get(provider: MessagingProvider): IMessagingService<unknown> {
    return this.adapters[provider];
  }
}
