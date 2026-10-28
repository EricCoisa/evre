import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReservedButtonKey } from 'src/domain/messaging/messaging-buttons.const';
import { ButtonHandlerRegistry } from './button-handler.registry';
import { MessagingEventsService } from './messaging-events.service';

/** Comportamento embutido dos botões reservados, válido para qualquer tipo de template. */
@Injectable()
export class ReservedButtonHandlers implements OnModuleInit {
  constructor(
    private readonly registry: ButtonHandlerRegistry,
    private readonly prisma: PrismaService,
    private readonly events: MessagingEventsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      { button: ReservedButtonKey.OPT_OUT },
      async (event) => {
        // Idempotente: tocar duas vezes mantém o primeiro `optOutAt`.
        const { count } = await this.prisma.messagingContact.updateMany({
          where: { phone: event.phone, optOut: false },
          data: { optOut: true, optOutAt: new Date() },
        });
        if (count > 0) this.events.emit({ type: 'contacts' });
      },
    );
  }
}
