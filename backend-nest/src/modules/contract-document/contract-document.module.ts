import { Module } from '@nestjs/common';
import { ContractDocumentController } from './contract-document.controller';
import { ContractDocumentService } from './contract-document.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from '../logging/logging.service';

@Module({
  controllers: [ContractDocumentController],
  providers: [ContractDocumentService, PrismaService, LoggingService],
  exports: [ContractDocumentService],
})
export class ContractDocumentModule {}
