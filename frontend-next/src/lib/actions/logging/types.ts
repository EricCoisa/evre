export interface Logging {
  id: string;
  module: LogModule;
  action: string;
  message: string;
  metadata?: string | null;
  performedById?: string | null;
  createdAt: Date;
  performedBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export enum LogModule {
  USER = 'USER',
  AUTH = 'AUTH',
  SYSTEM = 'SYSTEM',
  HEALTH = 'HEALTH'
};