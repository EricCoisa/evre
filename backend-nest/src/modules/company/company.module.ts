import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { MessagingModule } from '../messaging/messaging.module';
import { FindAllCompanyUseCase } from './use-cases/find-all.use-case';
import { FindOneCompanyUseCase } from './use-cases/find-one.use-case';
import { CreateCompanyUseCase } from './use-cases/create.use-case';
import { UpdateCompanyUseCase } from './use-cases/update.use-case';
import { RemoveCompanyUseCase } from './use-cases/remove.use-case';
import { ListCompanyContactsUseCase } from './use-cases/list-company-contacts.use-case';
import { CreateCompanyContactUseCase } from './use-cases/create-company-contact.use-case';
import { UpdateCompanyContactUseCase } from './use-cases/update-company-contact.use-case';
import { ArchiveCompanyContactUseCase } from './use-cases/archive-company-contact.use-case';
import { CompanyRouteCeiling } from './company.route-ceiling';
import { ListCompaniesTool } from './ai-tools/list-companies.tool';
import { GetCompanyTool } from './ai-tools/get-company.tool';
import { CreateCompanyTool } from './ai-tools/create-company.tool';
import { UpdateCompanyTool } from './ai-tools/update-company.tool';
import { RemoveCompanyTool } from './ai-tools/remove-company.tool';
import { ListCompanyContactsTool } from './ai-tools/list-company-contacts.tool';
import { CreateCompanyContactTool } from './ai-tools/create-company-contact.tool';
import { UpdateCompanyContactTool } from './ai-tools/update-company-contact.tool';
import { ArchiveCompanyContactTool } from './ai-tools/archive-company-contact.tool';

const USE_CASES = [
  FindAllCompanyUseCase,
  FindOneCompanyUseCase,
  CreateCompanyUseCase,
  UpdateCompanyUseCase,
  RemoveCompanyUseCase,
  ListCompanyContactsUseCase,
  CreateCompanyContactUseCase,
  UpdateCompanyContactUseCase,
  ArchiveCompanyContactUseCase,
];

const AI_TOOLS = [
  ListCompaniesTool,
  GetCompanyTool,
  CreateCompanyTool,
  UpdateCompanyTool,
  RemoveCompanyTool,
  ListCompanyContactsTool,
  CreateCompanyContactTool,
  UpdateCompanyContactTool,
  ArchiveCompanyContactTool,
];

@Module({
  imports: [PrismaModule, LoggingModule, MessagingModule],
  controllers: [CompanyController],
  providers: [...USE_CASES, ...AI_TOOLS, CompanyRouteCeiling],
  // Exporte só o que outro módulo injetar.
  exports: [FindOneCompanyUseCase],
})
export class CompanyModule {}
