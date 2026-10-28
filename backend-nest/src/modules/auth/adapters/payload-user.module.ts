import { Module, Global } from '@nestjs/common';
import { PayloadUserRepository } from './payload-user.repository';

/** Módulo global que fornece o PayloadUserRepository. */
@Global()
@Module({
  providers: [PayloadUserRepository],
  exports: [PayloadUserRepository],
})
export class PayloadUserModule {}
