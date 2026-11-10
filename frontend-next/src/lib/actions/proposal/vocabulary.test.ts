import { describe, it, expect } from 'vitest';
import ptBRVocabulary from '../locales/pt-BR/vocabulary.json';
import enVocabulary from '../locales/en/vocabulary.json';
import {
  PROPOSAL_STATUSES,
  PUBLICATION_STATES,
  SEND_CHANNELS,
  proposalStatusLabelKey,
  publicationStateLabelKey,
  sendChannelLabelKey,
} from './vocabulary';

/** Resolve uma chave pontuada no JSON do namespace, como o i18next faz. */
function resolve(json: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], json);
}

describe('vocabulary', () => {
  it('devolve chave existente nos dois locales para todo valor de enum', () => {
    const keys = [
      ...PROPOSAL_STATUSES.map(proposalStatusLabelKey),
      ...PUBLICATION_STATES.map(publicationStateLabelKey),
      ...SEND_CHANNELS.map(sendChannelLabelKey),
    ];

    for (const key of keys) {
      expect(resolve(ptBRVocabulary, key), `pt-BR sem ${key}`).toEqual(expect.any(String));
      expect(resolve(enVocabulary, key), `en sem ${key}`).toEqual(expect.any(String));
    }
  });

  it('cai em UNKNOWN quando o valor está fora do enum', () => {
    expect(proposalStatusLabelKey('WAT')).toBe('proposalStatus.UNKNOWN');
    expect(publicationStateLabelKey('')).toBe('publication.UNKNOWN');
    expect(sendChannelLabelKey('FAX')).toBe('sendChannel.UNKNOWN');
    expect(resolve(ptBRVocabulary, 'proposalStatus.UNKNOWN')).toEqual(expect.any(String));
    expect(resolve(enVocabulary, 'publication.UNKNOWN')).toEqual(expect.any(String));
    expect(resolve(ptBRVocabulary, 'sendChannel.UNKNOWN')).toEqual(expect.any(String));
    expect(resolve(enVocabulary, 'sendChannel.UNKNOWN')).toEqual(expect.any(String));
  });
});
