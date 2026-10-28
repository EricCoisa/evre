import { Injectable } from '@nestjs/common';
import { RESERVED_LIST } from 'src/domain/messaging/messaging-variables.const';
import type { MessagingTemplateVariableDto } from '../dto/messaging-template-type.dto';

@Injectable()
export class ListTemplateVariablesUseCase {
  execute(): MessagingTemplateVariableDto[] {
    return RESERVED_LIST.map((v) => ({
      name: v.name,
      type: v.type,
      labelKey: v.labelKey,
      allowUse: v.allowUse,
      dummy: v.dummy,
      sensitive: !!v.sensitive,
      callerProvided: !v.fromContext,
    }));
  }
}
