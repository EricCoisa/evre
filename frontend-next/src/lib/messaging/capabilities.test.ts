import { describe, expect, it } from 'vitest';
import type { MessagingCapabilities } from '@/lib/actions/messaging/types';
import { composerAbilities } from './capabilities';

const caps = (over: Partial<MessagingCapabilities>): MessagingCapabilities => ({
  provider: 'EVOLUTION_API',
  messageTypes: ['TEXT'],
  template: {
    approval: false,
    providerOwnedBody: [],
    components: { header: [], footer: false, buttons: [] },
  },
  voiceRecording: false,
  typing: { inbound: false, outbound: false },
  serviceWindowHours: null,
  ...over,
});

describe('composerAbilities', () => {
  it('sem capabilities nada é oferecido', () => {
    expect(composerAbilities(undefined, true)).toEqual({
      text: false, pickMedia: false, pickDocument: false, template: false, voice: false,
    });
  });

  it('segue os tipos anunciados', () => {
    const a = composerAbilities(caps({ messageTypes: ['TEXT', 'DOCUMENT'] }), true);
    expect(a).toMatchObject({ text: true, pickDocument: true, pickMedia: false, template: false });
    expect(composerAbilities(caps({ messageTypes: ['TEXT', 'VIDEO'] }), true).pickMedia).toBe(true);
  });

  it('voz exige o provider, o tipo AUDIO e o navegador', () => {
    const withAudio = caps({ messageTypes: ['TEXT', 'AUDIO'], voiceRecording: true });
    expect(composerAbilities(withAudio, true).voice).toBe(true);
    expect(composerAbilities(withAudio, false).voice).toBe(false);
    expect(composerAbilities({ ...withAudio, voiceRecording: false }, true).voice).toBe(false);
    expect(composerAbilities({ ...withAudio, messageTypes: ['TEXT'] }, true).voice).toBe(false);
  });

  it('fora da janela de atendimento só o template continua', () => {
    const abilities = composerAbilities(
      caps({ messageTypes: ['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'TEMPLATE'], voiceRecording: true }),
      true,
      true,
    );
    expect(abilities).toEqual({
      text: false,
      pickMedia: false,
      pickDocument: false,
      template: true,
      voice: false,
    });
  });
});
