export interface UserConfiguration<T = unknown> {
  id: string;
  labelKey: string;
  valueType: string;
  value: T;
  isRequired: boolean;
}

export interface SetUserConfigurationDto<T = unknown> {
  definitionId: string;
  value: T;
}

export const userRoleColors: Record<string, React.CSSProperties> = {
  ADMIN: { backgroundColor: 'var(--warning)', color: 'var(--warning-foreground)' },
  MODERATOR: { backgroundColor: 'var(--info)', color: 'var(--info-foreground)' },
  USER: { backgroundColor: 'var(--success)', color: 'var(--success-foreground)' },
};