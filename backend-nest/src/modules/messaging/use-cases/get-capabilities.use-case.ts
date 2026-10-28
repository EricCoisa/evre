import { Injectable } from '@nestjs/common';
import type { MessagingCapabilities } from 'src/domain/interface/messaging-provider.interface';
import type { MessagingProvider } from 'src/domain/messaging/messaging.const';
import { MessagingConnectionService } from '../messaging-connection.service';
import { MessagingConnectionStateService } from '../messaging-connection-state.service';

export type GetCapabilitiesOutput = MessagingCapabilities & {
  provider: MessagingProvider;
  connectionId: string;
};

@Injectable()
export class GetCapabilitiesUseCase {
  constructor(
    private readonly connections: MessagingConnectionService,
    private readonly state: MessagingConnectionStateService,
  ) {}

  async execute(connectionId: string): Promise<GetCapabilitiesOutput> {
    return this.state.capabilities(await this.connections.get(connectionId));
  }
}
