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

@Module({
  imports: [PrismaModule, LoggingModule, MessagingModule],
  controllers: [CompanyController],
  providers: [...USE_CASES, CompanyRouteCeiling],
  // Exporte só o que outro módulo injetar.
  exports: [FindOneCompanyUseCase],
})
export class CompanyModule {}
