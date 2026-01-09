import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import {
  I18nModule,
  AcceptLanguageResolver,
  QueryResolver,
  HeaderResolver,
} from 'nestjs-i18n';
import * as path from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './modules/user/user.module';
import { HealthModule } from './modules/health/health.module';
import { LoggingModule } from './modules/logging/logging.module';
import { AuthModule } from './modules/auth/auth.module';
import { RouteModule } from './modules/route/route.module';
import { UserRouteAccessModule } from './modules/user-route-access/user-route-access.module';
import { RoleRouteAccessModule } from './modules/role-route-access/role-route-access.module';
import { SystemConfigurationModule } from './modules/system-configuration/system-configuration.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UserConfigurationModule } from './modules/user-configuration/user-configuration.module';
import { UserConfigurationDefinitionModule } from './modules/user-configuration-definition/user-configuration-definition.module';
import { CompanyModule } from './modules/company/company.module';
import { ProposalModule } from './modules/proposal/proposal.module';
import { ContractDocumentModule } from './modules/contract-document/contract-document.module';
import { ProjectModule } from './modules/project/project.module';
import { StageModule } from './modules/stage/stage.module';
import { ActivityModule } from './modules/activity/activity.module';
import { CommentModule } from './modules/comment/comment.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { ProjectHistoryModule } from './modules/project-history/project-history.module';
import { ContactModule } from './modules/contact/contact.module';
import { ClientLogModule } from './modules/clientLog/clientLog.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // I18n Configuration
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-language']),
      ],
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    LoggingModule,
    AuthModule,
    UserModule,
    HealthModule,
    RouteModule,
    UserRouteAccessModule,
    RoleRouteAccessModule,
    SystemConfigurationModule,
    UserConfigurationDefinitionModule,
    UserConfigurationModule,
    TasksModule,
    CompanyModule,
    ProposalModule,
    ContractDocumentModule,
    ProjectModule,
    StageModule,
    ActivityModule,
    CommentModule,
    ApprovalModule,
    ProjectHistoryModule,
    ContactModule,
    ClientLogModule,
  ],
})
export class AppModule {}
