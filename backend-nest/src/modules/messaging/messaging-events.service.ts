import { randomUUID } from 'crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';
import type { MessagingPresenceState } from 'src/domain/interface/messaging-provider.interface';

const CHANNEL = 'messaging:events';
/** Abaixo do timeout de ociosidade de proxies/balanceadores (60s é o mais comum). */
const KEEPALIVE_MS = 25_000;
/** Abaixo da validade do access token (15 min): fecha antes dele vencer, nunca no meio do stream. */
const LIFETIME_MS = 10 * 60_000;

/** Descreve o que mudou, sem o conteúdo, para o navegador saber qual consulta refazer. */
export type MessagingRealtimeEvent =
  | { type: 'connection' }
  | { type: 'messages' }
  | { type: 'contacts' }
  | { type: 'templates' }
  | {
      type: 'presence';
      connectionId: string;
      phone: string;
      state: MessagingPresenceState;
    };

/** Empurra mudanças de mensageria para quem está com a tela aberta, via SSE e Redis. */
@Injectable()
export class MessagingEventsService implements OnModuleInit {
  private readonly subject = new Subject<MessagingRealtimeEvent>();
  private readonly origin = randomUUID();

  constructor(private readonly redis: RedisService) {}

  async onModuleInit(): Promise<void> {
    await this.redis.subscribe(CHANNEL, (raw) => {
      try {
        const message = JSON.parse(raw) as {
          origin?: string;
          event?: MessagingRealtimeEvent;
        };
        if (message.event && message.origin !== this.origin) {
          this.subject.next(message.event);
        }
      } catch {
        // Mensagem de outro formato no canal: ignorada.
      }
    });
  }

  emit(event: MessagingRealtimeEvent): void {
    this.subject.next(event);
    void this.redis.publish(
      CHANNEL,
      JSON.stringify({ origin: this.origin, event }),
    );
  }

  stream(): Observable<MessagingRealtimeEvent> {
    return this.subject.asObservable();
  }

  /** Liga uma conexão SSE aos eventos e devolve a função que desfaz tudo quando o cliente sai. */
  attach(write: (chunk: string) => void, end: () => void): () => void {
    write(': connected\n\n');
    const subscription = this.stream().subscribe((event) =>
      write(`data: ${JSON.stringify(event)}\n\n`),
    );
    const keepalive = setInterval(() => write(': ping\n\n'), KEEPALIVE_MS);
    const lifetime = setTimeout(() => {
      write('data: {"type":"end"}\n\n');
      end();
    }, LIFETIME_MS);
    return () => {
      clearInterval(keepalive);
      clearTimeout(lifetime);
      subscription.unsubscribe();
    };
  }
}
