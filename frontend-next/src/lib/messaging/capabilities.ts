import type { MessagingCapabilities } from '@/lib/actions/messaging/types';

export interface ComposerAbilities {
  text: boolean;
  pickMedia: boolean;
  pickDocument: boolean;
  template: boolean;
  /** Provider aceita áudio gravado E o navegador sabe gravar. */
  voice: boolean;
}

function canSendText(types: string[], outsideServiceWindow: boolean): boolean {
  return types.includes('TEXT') && !outsideServiceWindow;
}

function canPickMedia(types: string[], outsideServiceWindow: boolean): boolean {
  return (types.includes('IMAGE') || types.includes('VIDEO')) && !outsideServiceWindow;
}

function canPickDocument(types: string[], outsideServiceWindow: boolean): boolean {
  return types.includes('DOCUMENT') && !outsideServiceWindow;
}

function canRecordVoice(
  capabilities: MessagingCapabilities | undefined,
  types: string[],
  browserCanRecord: boolean,
  outsideServiceWindow: boolean,
): boolean {
  return !!capabilities?.voiceRecording && types.includes('AUDIO') && browserCanRecord && !outsideServiceWindow;
}

/** Traduz o que o provider anuncia no que o campo de envio pode oferecer. Sem capabilities, nada. */
export function composerAbilities(
  capabilities: MessagingCapabilities | undefined,
  browserCanRecord: boolean,
  /** Fora da janela de atendimento só template: o resto do envio fica travado. */
  outsideServiceWindow = false,
): ComposerAbilities {
  const types = (capabilities?.messageTypes ?? []) as string[];
  return {
    text: canSendText(types, outsideServiceWindow),
    pickMedia: canPickMedia(types, outsideServiceWindow),
    pickDocument: canPickDocument(types, outsideServiceWindow),
    template: types.includes('TEMPLATE'),
    voice: canRecordVoice(capabilities, types, browserCanRecord, outsideServiceWindow),
  };
}
