import { LogActions } from './log-actions';

/** Ordem importa: o filtro de runtime grava o que for >= ao mínimo configurado. */
export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
} as const;
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
};

/** Severidade de cada ação; DEBUG é ruído de alto volume, WARN é o que auditoria exige. */
export const LOG_ACTION_LEVEL: Record<LogActions, LogLevel> = {
  [LogActions.LOGIN]: LogLevel.DEBUG,
  [LogActions.LOGOUT]: LogLevel.DEBUG,
  [LogActions.AI_MESSAGE_SENT]: LogLevel.DEBUG,
  [LogActions.AI_TOOL_EXECUTED]: LogLevel.DEBUG,
  [LogActions.MCP_TOOL_CALLED]: LogLevel.DEBUG,
  [LogActions.MCP_CONNECTED]: LogLevel.DEBUG,

  [LogActions.REGISTER]: LogLevel.INFO,
  [LogActions.CREATE]: LogLevel.INFO,
  [LogActions.UPDATE]: LogLevel.INFO,
  [LogActions.DELETE]: LogLevel.INFO,
  [LogActions.DELETE_BY_ROLE]: LogLevel.INFO,
  [LogActions.LOG_CLEANUP]: LogLevel.INFO,
  [LogActions.CREATE_DEFINITION]: LogLevel.INFO,
  [LogActions.UPDATE_DEFINITION]: LogLevel.INFO,
  [LogActions.DELETE_DEFINITION]: LogLevel.INFO,
  [LogActions.SET_CONFIGURATION]: LogLevel.INFO,
  [LogActions.RESET_CONFIGURATION]: LogLevel.INFO,
  [LogActions.RESET_ALL_CONFIGURATIONS]: LogLevel.INFO,
  [LogActions.GRANT]: LogLevel.INFO,
  [LogActions.BULK_GRANT]: LogLevel.INFO,
  [LogActions.REVOKE]: LogLevel.INFO,
  [LogActions.BULK_REVOKE]: LogLevel.INFO,
  [LogActions.GENERATE_INVITE_TOKEN]: LogLevel.INFO,
  [LogActions.ACCEPT_INVITE]: LogLevel.INFO,
  [LogActions.AI_CONVERSATION_REWOUND]: LogLevel.INFO,
  [LogActions.API_KEY_CREATED]: LogLevel.INFO,
  [LogActions.MCP_CLIENT_REGISTERED]: LogLevel.INFO,
  [LogActions.MCP_CONNECTION_REVOKED]: LogLevel.INFO,

  [LogActions.ACCOUNT_LOCKED]: LogLevel.WARN,
  [LogActions.ACCOUNT_DELETED]: LogLevel.WARN,
  [LogActions.PASSWORD_RESET_REQUEST]: LogLevel.WARN,
  [LogActions.PASSWORD_RESET_COMPLETED]: LogLevel.WARN,
  [LogActions.API_KEY_REVOKED]: LogLevel.WARN,
  [LogActions.AI_TOOL_DENIED]: LogLevel.WARN,
  [LogActions.AI_SCOPE_APPROVED]: LogLevel.WARN,
  [LogActions.VERIFICATION_REQUESTED]: LogLevel.WARN,
  [LogActions.VERIFICATION_CONFIRMED]: LogLevel.WARN,
};

export const LOG_MIN_LEVEL_CONFIG_KEY = 'SYSTEM_LOG_MIN_LEVEL';

export function levelOf(action: LogActions): LogLevel {
  return LOG_ACTION_LEVEL[action] ?? LogLevel.INFO;
}

/** `true` quando a ação deve ser gravada no nível mínimo configurado. */
export function passesLevel(action: LogActions, minimum: LogLevel): boolean {
  return LOG_LEVEL_ORDER[levelOf(action)] >= LOG_LEVEL_ORDER[minimum];
}
