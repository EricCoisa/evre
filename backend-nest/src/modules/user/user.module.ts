import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './user.controller';
import { PhoneAvailabilityGuard } from './phone-availability.guard';

import { PrismaModule } from '../../prisma/prisma.module';
import { UserRouteAccessModule } from '../user-route-access/user-route-access.module';
import { AuthModule } from '../auth/auth.module';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { CryptoModule } from '../../common/infrastructure/crypto/crypto.module';
import { LoggingModule } from '../logging/logging.module';
import { CaptchaModule } from '../captcha/captcha.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationModule } from '../notification/notification.module';
import { VerificationModule } from '../verification/verification.module';

import { FindAllUsersUseCase } from './use-cases/find-all-users.use-case';
import { GetSignupsSeriesUseCase } from './use-cases/get-signups-series.use-case';
import { FindOneUserUseCase } from './use-cases/find-one-user.use-case';
import { UpdateUserUseCase } from './use-cases/update-user.use-case';
import { UpdateProfileUseCase } from './use-cases/update-profile.use-case';
import { UpdatePasswordUseCase } from './use-cases/update-password.use-case';
import { GetUserImageUseCase } from './use-cases/get-user-image.use-case';
import { ExportMyDataUseCase } from './use-cases/export-my-data.use-case';
import { DeleteMyAccountUseCase } from './use-cases/delete-my-account.use-case';
import { RemoveUserUseCase } from './use-cases/remove-user.use-case';
import { GetSystemRolesUseCase } from './use-cases/get-system-roles.use-case';
import { ListUsersTool } from './ai-tools/list-users.tool';
import { FindUserTool } from './ai-tools/find-user.tool';
import { GetMyProfileTool } from './ai-tools/get-my-profile.tool';
import { ListRolesTool } from './ai-tools/list-roles.tool';
import { ListUserStatusesTool } from './ai-tools/list-user-statuses.tool';
import { UpdateUserTool } from './ai-tools/update-user.tool';
import { UserRouteCeiling } from './user.route-ceiling';

const USE_CASES = [
  FindAllUsersUseCase,
  GetSignupsSeriesUseCase,
  FindOneUserUseCase,
  UpdateUserUseCase,
  UpdateProfileUseCase,
  UpdatePasswordUseCase,
  GetUserImageUseCase,
  ExportMyDataUseCase,
  DeleteMyAccountUseCase,
  RemoveUserUseCase,
  GetSystemRolesUseCase,
];

@Module({
  imports: [
    PrismaModule,
    UserRouteAccessModule,
    SystemConfigurationModule,
    forwardRef(() => AuthModule),
    CryptoModule,
    LoggingModule,
    StorageModule,
    // CaptchaModule: /user/signup é gateado por @RequireCaptcha().
    CaptchaModule,
    NotificationModule,
    VerificationModule,
  ],
  controllers: [UserController],
  providers: [
    PhoneAvailabilityGuard,
    ...USE_CASES,
    ListUsersTool,
    FindUserTool,
    GetMyProfileTool,
    ListRolesTool,
    ListUserStatusesTool,
    UpdateUserTool,
    UserRouteCeiling,
  ],
  exports: [FindOneUserUseCase],
})
export class UserModule {}
