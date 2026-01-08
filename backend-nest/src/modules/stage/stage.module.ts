import { Module } from '@nestjs/common';
import { StageController } from './stage.controller';
import { StageService } from './stage.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [PrismaModule, LoggingModule],
  controllers: [StageController],
  providers: [StageService],
  exports: [StageService],
})
export class StageModule {}
