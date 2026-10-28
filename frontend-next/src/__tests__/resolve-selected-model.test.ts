import { describe, it, expect } from 'vitest';
import { resolveSelectedModel } from '@/components/agent/chat-view';

/** Testa a reconciliação do seletor de modelo do /agent ao trocar de provider. */
describe('resolveSelectedModel', () => {
  const anthropic = ['claude-opus-4', 'claude-sonnet-4'];
  const openai = ['gpt-5', 'gpt-5-mini'];

  it('primeira carga (nada escolhido) usa o default', () => {
    expect(resolveSelectedModel('', anthropic, 'claude-sonnet-4')).toBe(
      'claude-sonnet-4',
    );
  });

  it('respeita a escolha do usuário enquanto o modelo existir', () => {
    expect(resolveSelectedModel('claude-opus-4', anthropic, 'claude-sonnet-4')).toBe(
      'claude-opus-4',
    );
  });

  it('troca de provider: modelo antigo sumiu da lista → cai no default do novo', () => {
    expect(resolveSelectedModel('claude-opus-4', openai, 'gpt-5')).toBe('gpt-5');
  });

  it('lista vazia (provider não configurado) → default, sem travar no modelo velho', () => {
    expect(resolveSelectedModel('claude-opus-4', [], '')).toBe('');
  });
});
