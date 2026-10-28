import { SetMetadata } from '@nestjs/common';

export const AI_TOOL_KEY = 'AI_TOOL';
export const AiToolDef = (): ClassDecorator => SetMetadata(AI_TOOL_KEY, true);
