import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailService } from './email.service';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { EmailController } from './email.controller';

@Module({
  imports: [PrismaModule, SystemConfigurationModule],
  providers: [EmailService],
  exports: [EmailService],
  controllers: [EmailController],
})
export class EmailModule {}
