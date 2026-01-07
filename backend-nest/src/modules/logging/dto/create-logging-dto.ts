import { LogActions } from 'src/common/types/logging.types';
import { LogModule } from 'src/domain/logging/logModule.const';

export interface CreateLogParams {
  module: LogModule;
  action: LogActions;
  message: string;
  metadata?: Record<string, any>;
  // performedById?: string | null;
}
