import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailService } from './email.service';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { EmailController } from './email.controller';
import { EmailProcessor } from './email.processor';
import { SaveEmailConfigurationUseCase } from './use-cases/save-configuration.use-case';
import { CheckEmailHealthUseCase } from './use-cases/check-health.use-case';
import { ListEmailTemplatesUseCase } from './use-cases/list-templates.use-case';
import { ResendEmailService } from './provider/resend.provider';
import { NodemailerEmailService } from './provider/nodemailer.provider';
import { GetEmailConfigTool } from './ai-tools/get-email-config.tool';
import { SaveEmailConfigTool } from './ai-tools/save-email-config.tool';
import { EmailCapabilities } from './email.capabilities';

@Module({
  imports: [
    PrismaModule,
    SystemConfigurationModule,
    BullModule.registerQueue({ name: 'email' }),
  ],
  providers: [
    EmailService,
    ResendEmailService,
    NodemailerEmailService,
    EmailProcessor,
    SaveEmailConfigurationUseCase,
    CheckEmailHealthUseCase,
    ListEmailTemplatesUseCase,
    GetEmailConfigTool,
    SaveEmailConfigTool,
    EmailCapabilities,
  ],
  exports: [
    EmailService,
    SaveEmailConfigurationUseCase,
    CheckEmailHealthUseCase,
  ],
  controllers: [EmailController],
})
export class EmailModule {}
