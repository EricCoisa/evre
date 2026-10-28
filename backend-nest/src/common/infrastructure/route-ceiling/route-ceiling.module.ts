import { Global, Module } from '@nestjs/common';
import { RouteCeilingRegistry } from './route-ceiling.registry';

@Global()
@Module({
  providers: [RouteCeilingRegistry],
  exports: [RouteCeilingRegistry],
})
export class RouteCeilingModule {}
