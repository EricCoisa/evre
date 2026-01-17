import { Module } from '@nestjs/common';
import { ApprovalRequestController } from './approval-request.controller';
import { ApprovalRequestService } from './approval-request.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [PrismaModule, LoggingModule],
  controllers: [ApprovalRequestController],
  providers: [ApprovalRequestService],
  exports: [ApprovalRequestService],
})
export class ApprovalRequestModule {}
