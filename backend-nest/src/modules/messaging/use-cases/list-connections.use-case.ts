import { Injectable } from '@nestjs/common';
import {
  MessagingConnectionService,
  type ConnectionView,
} from '../messaging-connection.service';

@Injectable()
export class ListConnectionsUseCase {
  constructor(private readonly connections: MessagingConnectionService) {}

  async execute(query?: { archived?: boolean }): Promise<ConnectionView[]> {
    return (await this.connections.list(query)).map((connection) =>
      this.connections.view(connection),
    );
  }
}
