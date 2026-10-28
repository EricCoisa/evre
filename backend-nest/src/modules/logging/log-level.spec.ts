import { describe, it, expect } from 'vitest';
import { LogActions } from 'src/domain/logging/log-actions';
import {
  LOG_ACTION_LEVEL,
  LogLevel,
  levelOf,
  passesLevel,
} from 'src/domain/logging/log-level.const';

describe('LOG_ACTION_LEVEL', () => {
  it('cobre toda ação do enum — ação nova sem nível é erro', () => {
    const semNivel = Object.values(LogActions).filter((a) => !(a in LOG_ACTION_LEVEL));
    expect(semNivel).toEqual([]);
  });

  it('login e logout são o ruído de alto volume', () => {
    expect(levelOf(LogActions.LOGIN)).toBe(LogLevel.DEBUG);
    expect(levelOf(LogActions.LOGOUT)).toBe(LogLevel.DEBUG);
  });

  it('eventos de auditoria ficam em WARN', () => {
    expect(levelOf(LogActions.ACCOUNT_LOCKED)).toBe(LogLevel.WARN);
    expect(levelOf(LogActions.PASSWORD_RESET_REQUEST)).toBe(LogLevel.WARN);
    expect(levelOf(LogActions.API_KEY_REVOKED)).toBe(LogLevel.WARN);
  });
});

describe('passesLevel', () => {
  it('mínimo DEBUG grava tudo', () => {
    for (const action of Object.values(LogActions)) {
      expect(passesLevel(action, LogLevel.DEBUG)).toBe(true);
    }
  });

  it('mínimo INFO corta o ruído de login mas mantém o resto', () => {
    expect(passesLevel(LogActions.LOGIN, LogLevel.INFO)).toBe(false);
    expect(passesLevel(LogActions.AI_MESSAGE_SENT, LogLevel.INFO)).toBe(false);
    expect(passesLevel(LogActions.CREATE, LogLevel.INFO)).toBe(true);
    expect(passesLevel(LogActions.ACCOUNT_LOCKED, LogLevel.INFO)).toBe(true);
  });

  it('mínimo WARN deixa só o que auditoria exige', () => {
    expect(passesLevel(LogActions.UPDATE, LogLevel.WARN)).toBe(false);
    expect(passesLevel(LogActions.ACCOUNT_DELETED, LogLevel.WARN)).toBe(true);
  });
});
