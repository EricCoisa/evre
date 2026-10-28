import { Injectable, Logger } from '@nestjs/common';
import type {
  ButtonHandler,
  ButtonMatch,
} from 'src/domain/messaging/messaging-buttons.const';

/** Registro dos handlers que reagem ao toque do cliente num botão com chave. */
@Injectable()
export class ButtonHandlerRegistry {
  private readonly logger = new Logger(ButtonHandlerRegistry.name);
  private readonly entries: { match: ButtonMatch; handler: ButtonHandler }[] =
    [];

  /** Devolve a função que desfaz o registro (útil em testes e em módulos que se desligam). */
  register(match: ButtonMatch, handler: ButtonHandler): () => void {
    const entry = { match, handler };
    this.entries.push(entry);
    this.logger.log(
      `Handler de botão registrado: ${match.type ?? '*'}/${match.button}`,
    );
    return () => {
      const index = this.entries.indexOf(entry);
      if (index >= 0) this.entries.splice(index, 1);
    };
  }

  handlersFor(typeKey: string | null, buttonKey: string): ButtonHandler[] {
    return this.entries
      .filter(
        ({ match }) =>
          match.button === buttonKey &&
          (match.type === undefined || match.type === typeKey),
      )
      .map(({ handler }) => handler);
  }

  /** Para a tela do tipo mostrar "handler registrado: sim/não" por botão. */
  list(): ButtonMatch[] {
    return this.entries.map(({ match }) => ({ ...match }));
  }
}
