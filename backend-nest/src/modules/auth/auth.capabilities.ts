import { Injectable, OnModuleInit } from '@nestjs/common';
import { CapabilityRegistry } from '../capability/capability.registry';
import { EMAIL_CAPABILITY } from 'src/domain/mail/email-template-type.const';

/** Só a ligação: a chave é do auth, o recurso (EMAIL) é de outro módulo. */
@Injectable()
export class AuthCapabilities implements OnModuleInit {
  constructor(private readonly capabilities: CapabilityRegistry) {}

  onModuleInit(): void {
    this.capabilities.requires('SYSTEM_USER_CREATE', [EMAIL_CAPABILITY]);
  }
}
