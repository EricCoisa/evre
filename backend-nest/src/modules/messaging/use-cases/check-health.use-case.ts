import { Injectable } from '@nestjs/common';
import { MessagingConnectionService } from '../messaging-connection.service';
import {
  MessagingConnectionStateService,
  type Health,
} from '../messaging-connection-state.service';

@Injectable()
export class CheckConnectionHealthUseCase {
  constructor(
    private readonly connections: MessagingConnectionService,
    private readonly state: MessagingConnectionStateService,
  ) {}

  async execute(connectionId: string): Promise<Health> {
    return this.state.health(await this.connections.get(connectionId));
  }
}
