import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface WebhookProject {
  id: string;
  token: string;
  companyId: string;
}

export const WebhookProjectData = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): WebhookProject => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ project?: WebhookProject }>();
    if (!request.project || typeof request.project !== 'object') {
      throw new Error('Project data not found on request');
    }
    return request.project;
  },
);
