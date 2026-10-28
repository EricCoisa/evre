import { Injectable } from '@nestjs/common';
import { StorageService } from '../storage.service';

@Injectable()
export class CheckStorageHealthUseCase {
  constructor(private readonly storageService: StorageService) {}

  async execute(): Promise<{ operational: boolean; reason?: string }> {
    return this.storageService.checkHealth();
  }
}
