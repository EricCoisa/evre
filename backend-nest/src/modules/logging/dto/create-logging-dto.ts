import { LogActions } from 'src/domain/logging/log-actions';
import { LogModule } from 'src/domain/logging/logModule.const';

export interface CreateLogParams {
  module: LogModule;
  action: LogActions;
  message: string;
  metadata?: Record<string, any>;
  // performedById?: string | null;
}
