import { Injectable } from '@nestjs/common';
import {
  MessagingConnectionService,
  type ConnectionView,
} from '../messaging-connection.service';

/** Troca a conexão padrão, a que envia quando ninguém escolhe. */
@Injectable()
export class SetDefaultConnectionUseCase {
  constructor(private readonly connections: MessagingConnectionService) {}

  async execute(id: string): Promise<ConnectionView> {
    return this.connections.view(await this.connections.setDefault(id));
  }
}
