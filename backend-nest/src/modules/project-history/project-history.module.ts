import { Module } from '@nestjs/common';
import { ProjectHistoryController } from './project-history.controller';
import { ProjectHistoryService } from './project-history.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectHistoryController],
  providers: [ProjectHistoryService],
  exports: [ProjectHistoryService],
})
export class ProjectHistoryModule {}
