import { Module } from '@nestjs/common';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { CaptchaController } from './captcha.controller';
import { CaptchaService } from './captcha.service';
import { CaptchaGuard } from './captcha.guard';
import { SaveCaptchaConfigUseCase } from './use-cases/save-captcha-config.use-case';
import { GetCaptchaConfigTool } from './ai-tools/get-captcha-config.tool';
import { SaveCaptchaConfigTool } from './ai-tools/save-captcha-config.tool';
import { CaptchaCapabilities } from './captcha.capabilities';

@Module({
  imports: [SystemConfigurationModule],
  controllers: [CaptchaController],
  providers: [
    CaptchaService,
    CaptchaGuard,
    SaveCaptchaConfigUseCase,
    GetCaptchaConfigTool,
    SaveCaptchaConfigTool,
    CaptchaCapabilities,
  ],
  exports: [CaptchaService, CaptchaGuard],
})
export class CaptchaModule {}
