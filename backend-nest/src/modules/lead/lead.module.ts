import { Module } from '@nestjs/common';
import { LeadController } from './lead.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { NotificationModule } from '../notification/notification.module';
import { CaptchaModule } from '../captcha/captcha.module';
import { CreateLeadUseCase } from './use-cases/create-lead.use-case';
import { ListLeadsUseCase } from './use-cases/list-leads.use-case';
import { UpdateLeadStatusUseCase } from './use-cases/update-lead-status.use-case';
import { LeadRouteCeiling } from './lead.route-ceiling';
import { ListLeadsTool } from './ai-tools/list-leads.tool';

const USE_CASES = [
  CreateLeadUseCase,
  ListLeadsUseCase,
  UpdateLeadStatusUseCase,
];

@Module({
  imports: [PrismaModule, LoggingModule, NotificationModule, CaptchaModule],
  controllers: [LeadController],
  providers: [...USE_CASES, LeadRouteCeiling, ListLeadsTool],
})
export class LeadModule {}
