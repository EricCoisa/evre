import { Injectable } from '@nestjs/common';
import { RESERVED_BUTTON_LIST } from 'src/domain/messaging/messaging-buttons.const';
import { ButtonHandlerRegistry } from '../button-handler.registry';
import type { MessagingTemplateButtonsInfoDto } from '../dto/messaging-template-type.dto';

/** Para a tela do tipo: os reservados que dá para liberar e quais chaves já têm handler em código. */
@Injectable()
export class ListTemplateButtonsUseCase {
  constructor(private readonly handlers: ButtonHandlerRegistry) {}

  execute(): MessagingTemplateButtonsInfoDto {
    return {
      reserved: RESERVED_BUTTON_LIST.map((b) => ({
        key: b.key,
        kind: b.kind,
        labelKey: b.labelKey,
        defaultLabel: b.defaultLabel,
        allowUse: b.allowUse,
      })),
      handlers: this.handlers
        .list()
        .map((h) => ({ type: h.type ?? null, button: h.button })),
    };
  }
}
