import { Module } from '@nestjs/common';
import { RouteController } from './route.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { FindAllRoutesUseCase } from './use-cases/find-all.use-case';
import { FindOneRouteUseCase } from './use-cases/find-one.use-case';
import { FindHomeRouteUseCase } from './use-cases/find-home.use-case';
import { FindByPathUseCase } from './use-cases/find-by-path.use-case';
import { CreateRouteUseCase } from './use-cases/create.use-case';
import { UpdateRouteUseCase } from './use-cases/update.use-case';
import { RemoveRouteUseCase } from './use-cases/remove.use-case';
import { ListRoutesTool } from './ai-tools/list-routes.tool';
import { CreateRouteTool } from './ai-tools/create-route.tool';
import { GetRouteTool } from './ai-tools/get-route.tool';
import { GetRouteByPathTool } from './ai-tools/get-route-by-path.tool';
import { UpdateRouteTool } from './ai-tools/update-route.tool';
import { RemoveRouteTool } from './ai-tools/remove-route.tool';
import { RoleHomeService } from './role-home.service';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { AccessPageRouteCeiling } from './access-page.route-ceiling';

@Module({
  imports: [PrismaModule, LoggingModule, SystemConfigurationModule],
  controllers: [RouteController],
  providers: [
    FindAllRoutesUseCase,
    FindOneRouteUseCase,
    FindHomeRouteUseCase,
    FindByPathUseCase,
    CreateRouteUseCase,
    UpdateRouteUseCase,
    RemoveRouteUseCase,
    ListRoutesTool,
    CreateRouteTool,
    GetRouteTool,
    GetRouteByPathTool,
    UpdateRouteTool,
    RemoveRouteTool,
    RoleHomeService,
    AccessPageRouteCeiling,
  ],
  exports: [FindByPathUseCase, RoleHomeService],
})
export class RouteModule {}
