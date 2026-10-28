import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { S3StorageService } from './providers/s3-storage.service';
import { LocalStorageService } from './providers/local-storage.service';
import { SaveStorageConfigurationUseCase } from './use-cases/save-configuration.use-case';
import { CheckStorageHealthUseCase } from './use-cases/check-health.use-case';
import { SystemConfigurationModule } from 'src/modules/system-configuration/system-configuration.module';
import { GetStorageConfigTool } from './ai-tools/get-storage-config.tool';
import { SaveStorageConfigTool } from './ai-tools/save-storage-config.tool';

@Module({
  imports: [SystemConfigurationModule],
  controllers: [StorageController],
  providers: [
    StorageService,
    S3StorageService,
    LocalStorageService,
    SaveStorageConfigurationUseCase,
    CheckStorageHealthUseCase,
    GetStorageConfigTool,
    SaveStorageConfigTool,
  ],
  exports: [StorageService],
})
export class StorageModule {}
