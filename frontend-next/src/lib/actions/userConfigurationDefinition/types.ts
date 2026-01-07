export interface UserConfigurationsDefinitions<T>{
  id: string;
  labelKey: string;
  valueType: string;
  defaultValue: T;
  isRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateUserConfigurationsDefinitionsDto<T> {
  labelKey: string;
  defaultValue: T;
}