import { Injectable, OnModuleInit } from '@nestjs/common';
import { CapabilityRegistry } from '../capability/capability.registry';
import { SystemConfigurationService } from '../system-configuration/system-configuration.service';
import {
  CAPTCHA_CAPABILITY,
  captchaConfigKeys,
} from 'src/domain/auth/captcha.const';

@Injectable()
export class CaptchaCapabilities implements OnModuleInit {
  constructor(
    private readonly capabilities: CapabilityRegistry,
    private readonly sysConfig: SystemConfigurationService,
  ) {}

  onModuleInit(): void {
    this.capabilities.register(CAPTCHA_CAPABILITY, {
      flags: [],
      check: () =>
        this.sysConfig.allFilled([
          captchaConfigKeys.siteKey,
          captchaConfigKeys.secretKey,
        ]),
    });
    this.capabilities.requires(captchaConfigKeys.enabled, [CAPTCHA_CAPABILITY]);
  }
}
