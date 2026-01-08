import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { EmailModule } from '../email/email.module';

import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';

@Module({
  imports: [PrismaModule, LoggingModule, EmailModule, SystemConfigurationModule],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
