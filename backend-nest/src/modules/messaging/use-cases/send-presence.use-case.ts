import { Injectable } from '@nestjs/common';
import { MessagingService } from '../messaging.service';
import type { SendPresenceDto } from '../dto/send-presence.dto';

@Injectable()
export class SendPresenceUseCase {
  constructor(private readonly messagingService: MessagingService) {}

  async execute(dto: SendPresenceDto): Promise<void> {
    await this.messagingService.sendPresence(dto.phone, dto.state, {
      connectionId: dto.connectionId,
    });
  }
}
