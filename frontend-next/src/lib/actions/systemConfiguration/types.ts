export interface SystemConfiguration<T>{
  id: string;
  labelKey: string;
  valueType: string;
  value: T;
  updatedAt: Date;
}

export interface UpdateSystemConfigurationDto<T> {
  labelKey: string;
  value: T;
}

export enum EmailProvider {
  RESEND = 'RESEND',
  SMTP = 'SMTP'
}