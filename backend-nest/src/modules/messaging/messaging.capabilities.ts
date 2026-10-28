import { Injectable, OnModuleInit } from '@nestjs/common';
import { CapabilityRegistry } from '../capability/capability.registry';
import { MessagingConnectionStateService } from './messaging-connection-state.service';
import {
  MESSAGING_CAPABILITY,
  MessagingFeatureFlag,
} from 'src/domain/messaging/messaging.const';

@Injectable()
export class MessagingCapabilities implements OnModuleInit {
  constructor(
    private readonly capabilities: CapabilityRegistry,
    private readonly state: MessagingConnectionStateService,
  ) {}

  onModuleInit(): void {
    this.capabilities.register(MESSAGING_CAPABILITY, {
      flags: [MessagingFeatureFlag.ROOT],
      check: () => this.state.checkAnyOperational(),
    });
  }
}
