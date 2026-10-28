import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { I18nContext } from 'nestjs-i18n';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { UserStatusConst } from 'src/domain/auth/userStatus.const';

@AiToolDef()
@Injectable()
export class ListUserStatusesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_user_statuses',
    description: 'Lista os status de usuário disponíveis no sistema.',
    inputSchema: z.object({}),
    invalidates: [],
  };

  execute(_input: unknown, _ctx: AiToolContext) {
    const i18n = I18nContext.current();
    return Promise.resolve(
      Object.values(UserStatusConst).map((status) => ({
        value: status,
        label: i18n?.t(`user.statuses.${status}`) ?? status,
      })),
    );
  }
}
